import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly apiBaseUrl = environment.apiUrl;

  readonly isDark = this.themeService.isDark;
  toggleTheme(): void { this.themeService.toggle(); }

  readonly email = signal('');
  readonly password = signal('');
  readonly otp = signal('');

  onEmailChange(newEmail: string): void {
    this.email.set(newEmail);
    if (this.pistaRecuperada()) {
      this.pistaRecuperada.set('');
    }
    if (this.pistaMsgError()) {
      this.pistaMsgError.set('');
    }
  }
  
  // Flujo de estados del inicio de sesión con OTP/2FA
  readonly currentStep = signal<'login' | 'otp-2fa' | 'prompt-enable' | 'setup-2fa' | 'prompt-disable' | 'confirm-disable' | 'select-rol' | 'forgot-password' | 'change-password-obligatorio'>('login');
  
  // Señales auxiliares para recuperación de contraseña y cambio obligatorio
  readonly recoveryEmail = signal('');
  readonly nuevaPassword = signal('');
  readonly confirmarPassword = signal('');
  readonly pista = signal('');
  readonly similitudPorcentaje = signal(0);
  readonly maxSimilitud = signal(70);
  readonly successMsg = signal('');
  readonly errorMsg = signal('');
  readonly loading = signal(false);
  readonly pistaRecuperada = signal('');
  readonly pistaMsgError = signal('');

  // Visibilidad de contraseñas
  readonly showPassword = signal(false);
  readonly showNuevaPassword = signal(false);
  readonly showConfirmarPassword = signal(false);

  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleShowNuevaPassword(): void {
    this.showNuevaPassword.update(v => !v);
  }

  toggleShowConfirmarPassword(): void {
    this.showConfirmarPassword.update(v => !v);
  }

  async togglePista(): Promise<void> {
    if (this.pistaRecuperada()) {
      this.pistaRecuperada.set('');
      return;
    }

    const emailStr = this.email().trim();
    if (!emailStr) {
      this.pistaMsgError.set('Por favor, ingrese su correo electrónico primero.');
      setTimeout(() => this.pistaMsgError.set(''), 3000);
      return;
    }

    try {
      this.pistaMsgError.set('');
      this.pistaRecuperada.set('');
      const response = await fetch(`${this.apiBaseUrl}/auth/pista?email=${encodeURIComponent(emailStr)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'No se pudo obtener la pista.');
      }
      this.pistaRecuperada.set(data.pista);
    } catch (err: any) {
      this.pistaMsgError.set(err.message || 'Error al obtener la pista.');
      setTimeout(() => this.pistaMsgError.set(''), 3000);
    }
  }

  // Señales auxiliares para enrolamiento de 2FA
  readonly qrCode = signal('');
  readonly secretKey = signal('');
  readonly confirmCode = signal('');
  readonly disableCode = signal('');
  
  // Almacenamiento temporal de sesión a la espera de confirmación de 2FA
  private readonly activeSessionData = signal<{ token: string; usuario: any; expiresIn?: number } | null>(null);

  // Roles disponibles
  readonly rolesDisponibles = signal<any[]>([]);
  readonly rolSeleccionado  = signal<any | null>(null);

  readonly canConfirmarRol = computed(() => this.rolSeleccionado() !== null);
  readonly idUsuario = signal('');

  async ngOnInit(): Promise<void> {
    this.cargarConfiguracionSimilitud();
    const token = localStorage.getItem('agro_session_token');
    const userStr = localStorage.getItem('agro_session_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.debeCambiarPassword) {
          this.email.set(user.email || '');
          this.idUsuario.set(String(user.idUsuario || ''));
          this.currentStep.set('change-password-obligatorio');
        } else {
          this.router.navigate(['/dashboard']);
        }
      } catch (e) {
        console.error('Error in login ngOnInit:', e);
      }
    }
  }

  private async cargarConfiguracionSimilitud(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/session-config`);
      if (response.ok) {
        const config = await response.json();
        if (config.hintMaxSimilarity) {
          this.maxSimilitud.set(Number(config.hintMaxSimilarity));
        }
      }
    } catch (e) {
      console.error('Error al cargar session-config:', e);
    }
  }

  readonly canSubmitRecovery = computed(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.recoveryEmail().trim());
  });

  readonly isEmailValido = computed(() => {
    const mail = this.email().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(mail);
  });

  validarSimilitud(): void {
    const pwd = this.nuevaPassword().toLowerCase().trim();
    const pst = this.pista().toLowerCase().trim();

    if (!pwd || !pst) {
      this.similitudPorcentaje.set(0);
      return;
    }

    const dist = this.calcularLevenshtein(pwd, pst);
    const maxLen = Math.max(pwd.length, pst.length);
    const sim = Math.round((1 - (dist / maxLen)) * 100);
    this.similitudPorcentaje.set(sim);
  }

  private calcularLevenshtein(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  readonly canSubmitChangePasswordObligatorio = computed(() => {
    const pass = this.nuevaPassword().trim();
    const conf = this.confirmarPassword().trim();
    const pst = this.pista().trim();

    if (pst.length > 0 && this.similitudPorcentaje() > this.maxSimilitud()) {
      return false;
    }
    return pass.length > 0 && pass === conf;
  });

  readonly canSubmitLogin = computed(() => {
    const mail = this.email().trim();
    const pass = this.password().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(mail) && pass.length > 0;
  });

  readonly canSubmitOtp = computed(() => {
    const code = this.otp().trim();
    return /^\d{6}$/.test(code);
  });

  readonly canSubmitConfirm2fa = computed(() => {
    const code = this.confirmCode().trim();
    return /^\d{6}$/.test(code);
  });

  readonly canSubmitDisableCode = computed(() => {
    const code = this.disableCode().trim();
    return /^\d{6}$/.test(code);
  });

  async onSubmitLogin(): Promise<void> {
    if (!this.canSubmitLogin() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.email().trim(),
          password: this.password()
        })
      });

      const data = await this.handleJsonResponse(response);

      this.idUsuario.set(data.idUsuario || (data.usuario && data.usuario.idUsuario) || '');

      // Manejo de flujos especiales (similar a mascotas)
      if (data.requires2FA) {
        this.currentStep.set('otp-2fa');
      } else if (data.requiresRolSelection) {
        this.rolesDisponibles.set(data.roles ?? []);
        this.currentStep.set('select-rol');
      } else {
        if (data.token) {
          this.finalizarYGuardarSesion(data.token, data.usuario, data.expiresIn);
        }
      }
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error de conexión con el servidor');
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmitOtp2fa(): Promise<void> {
    if (!this.canSubmitOtp() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/2fa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idUsuario: this.idUsuario(),
          code: this.otp().trim()
        })
      });

      const data = await this.handleJsonResponse(response);

      if (data.requiresRolSelection) {
        this.rolesDisponibles.set(data.roles ?? []);
        this.currentStep.set('select-rol');
      } else if (data.success && data.token) {
        this.finalizarYGuardarSesion(data.token, data.usuario, data.expiresIn);
      }
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Código de seguridad incorrecto');
    } finally {
      this.loading.set(false);
    }
  }

  async iniciarEnrolamiento(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/2fa/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idUsuario: this.idUsuario() })
      });
      const data = await this.handleJsonResponse(response);
      this.qrCode.set(data.qrCode);
      this.secretKey.set(data.secret);
      this.currentStep.set('setup-2fa');
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error al configurar el doble factor');
    } finally {
      this.loading.set(false);
    }
  }

  async activar2FA(): Promise<void> {
    if (!this.canSubmitConfirm2fa() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/2fa/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idUsuario: this.idUsuario(),
          secret: this.secretKey(),
          code: this.confirmCode().trim()
        })
      });

      await this.handleJsonResponse(response);

      const session = this.activeSessionData();
      if (session) {
        session.usuario.twoFactorEnabled = true;
        this.finalizarYGuardarSesion(session.token, session.usuario, session.expiresIn);
      }
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Código incorrecto. Verifique e intente de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  confirmarDesactivacion(): void {
    this.errorMsg.set('');
    this.disableCode.set('');
    this.currentStep.set('confirm-disable');
  }

  async desactivar2FA(): Promise<void> {
    if (!this.canSubmitDisableCode() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/2fa/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idUsuario: this.idUsuario(),
          code: this.disableCode().trim()
        })
      });

      await this.handleJsonResponse(response);

      const session = this.activeSessionData();
      if (session) {
        session.usuario.twoFactorEnabled = false;
        this.finalizarYGuardarSesion(session.token, session.usuario, session.expiresIn);
      }
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Código incorrecto. No se desactivó el doble factor.');
    } finally {
      this.loading.set(false);
    }
  }

  omitirAccion2fa(): void {
    const session = this.activeSessionData();
    if (session) {
      this.finalizarYGuardarSesion(session.token, session.usuario, session.expiresIn);
    }
  }

  private finalizarYGuardarSesion(token: string, usuario: any, expiresIn?: number): void {
    localStorage.setItem('agro_session_token', token);
    localStorage.setItem('agro_session_user', JSON.stringify(usuario));
    localStorage.setItem('agro_session_start_time', String(Date.now()));
    if (expiresIn) {
      localStorage.setItem('agro_session_expires_in', String(expiresIn));
      localStorage.setItem('agro_session_expires_at', String(Date.now() + expiresIn));
    }
    
    if (usuario && usuario.debeCambiarPassword) {
      this.currentStep.set('change-password-obligatorio');
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  private async handleJsonResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('El servidor no respondió con JSON válido.');
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.mensaje || 'Error en el servidor');
    }
    return data;
  }

  regresar(): void {
    this.currentStep.set('login');
    this.otp.set('');
    this.confirmCode.set('');
    this.disableCode.set('');
    this.errorMsg.set('');
    this.rolesDisponibles.set([]);
    this.rolSeleccionado.set(null);
    this.activeSessionData.set(null);
  }

  async confirmarRol(): Promise<void> {
    const rol = this.rolSeleccionado();
    if (!rol || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/select-rol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idUsuario: this.idUsuario(),
          rol: rol.rol,
          idRegistro: rol.idRegistro,
          idCapitulo: rol.idCapitulo
        })
      });
      const data = await this.handleJsonResponse(response);
      if (data.token) {
        this.rolesDisponibles.set([]);
        this.rolSeleccionado.set(null);
        this.finalizarYGuardarSesion(data.token, data.usuario, data.expiresIn);
      }
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error al seleccionar el rol');
    } finally {
      this.loading.set(false);
    }
  }

  private getHeaders(): Record<string, string> {
    const token = localStorage.getItem('agro_session_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  goToForgotPassword(): void {
    this.successMsg.set('');
    this.errorMsg.set('');
    this.recoveryEmail.set(this.email().trim());
    this.currentStep.set('forgot-password');
  }

  async solicitarRecuperacion(): Promise<void> {
    if (!this.canSubmitRecovery() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.recoveryEmail().trim() })
      });

      const data = await this.handleJsonResponse(response);

      this.successMsg.set(data.message || data.mensaje || 'Se ha enviado una contraseña temporal.');
      this.email.set(this.recoveryEmail().trim());
      this.currentStep.set('login');
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error al solicitar la recuperación');
    } finally {
      this.loading.set(false);
    }
  }

  async guardarNuevaPasswordObligatoria(): Promise<void> {
    if (!this.canSubmitChangePasswordObligatorio() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    const passwordActual = this.password();
    const nuevoPassword = this.nuevaPassword().trim();
    const pista = this.pista().trim();

    try {
      const response = await fetch(`${this.apiBaseUrl}/usuarios/cambiar-password`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ passwordActual, nuevoPassword, pista })
      });

      const data = await this.handleJsonResponse(response);

      const userStr = localStorage.getItem('agro_session_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.debeCambiarPassword = false;
        localStorage.setItem('agro_session_user', JSON.stringify(user));
      }

      this.currentStep.set('login');
      this.email.set('');
      this.password.set('');
      this.nuevaPassword.set('');
      this.confirmarPassword.set('');
      
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error al actualizar la contraseña');
    } finally {
      this.loading.set(false);
    }
  }
}
