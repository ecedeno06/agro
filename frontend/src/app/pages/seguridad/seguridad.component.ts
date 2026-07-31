import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-seguridad',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './seguridad.component.html',
  styleUrls: ['./seguridad.component.scss']
})
export class SeguridadComponent implements OnInit {
  readonly sessionService = inject(SessionService);
  private readonly apiBaseUrl = environment.apiUrl;

  readonly user = this.sessionService.user;

  readonly activeSeguridadTab = signal<'password' | 'two-factor'>('password');

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/session-config`);
      if (response.ok) {
        const config = await response.json();
        if (config.hintMaxSimilarity) {
          this.maxSimilitud.set(Number(config.hintMaxSimilarity));
        }
      }
    } catch (e) {
      console.error('Error al cargar configuracion de similitud:', e);
    }
  }

  // --- Formulario de cambio de contraseña ---
  readonly passwordActual = signal('');
  readonly nuevoPassword = signal('');
  readonly confirmarPassword = signal('');
  readonly pista = signal('');
  readonly similitudPorcentaje = signal(0);
  readonly maxSimilitud = signal(70);
  readonly pwdErrorMsg = signal('');
  readonly pwdSuccessMsg = signal('');
  readonly pwdLoading = signal(false);

  readonly showPasswordActual = signal(false);
  readonly showNuevoPassword = signal(false);
  readonly showConfirmarPassword = signal(false);

  toggleShowPasswordActual(): void { this.showPasswordActual.update(v => !v); }
  toggleShowNuevoPassword(): void { this.showNuevoPassword.update(v => !v); }
  toggleShowConfirmarPassword(): void { this.showConfirmarPassword.update(v => !v); }

  readonly canSubmitChangePassword = computed(() => {
    const act = this.passwordActual().trim();
    const newP = this.nuevoPassword().trim();
    const conf = this.confirmarPassword().trim();
    const pst = this.pista().trim();

    if (pst.length > 0 && this.similitudPorcentaje() > this.maxSimilitud()) {
      return false;
    }
    return act.length > 0 && newP.length > 0 && newP === conf;
  });

  validarSimilitud(): void {
    const pwd = this.nuevoPassword().toLowerCase().trim();
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
            matrix[i - 1][j - 1] + 1, // Sustitución
            matrix[i][j - 1] + 1,     // Inserción
            matrix[i - 1][j] + 1      // Eliminación
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  async realizarCambioPassword(): Promise<void> {
    if (!this.canSubmitChangePassword() || this.pwdLoading()) return;

    this.pwdLoading.set(true);
    this.pwdErrorMsg.set('');
    this.pwdSuccessMsg.set('');

    const token = localStorage.getItem('agro_session_token');
    try {
      const response = await fetch(`${this.apiBaseUrl}/usuarios/cambiar-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          passwordActual: this.passwordActual(),
          nuevoPassword: this.nuevoPassword().trim(),
          pista: this.pista().trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.mensaje || 'Error al cambiar contraseña');
      }

      this.pwdSuccessMsg.set(data.message || 'Contraseña cambiada exitosamente.');
      this.passwordActual.set('');
      this.nuevoPassword.set('');
      this.confirmarPassword.set('');
      this.pista.set('');
      this.similitudPorcentaje.set(0);
    } catch (error: any) {
      this.pwdErrorMsg.set(error.message || 'Ocurrió un error al cambiar la contraseña.');
    } finally {
      this.pwdLoading.set(false);
    }
  }

  // --- Flujo 2FA ---
  readonly show2faSetup = signal(false);
  readonly show2faDisable = signal(false);
  readonly qrCode = signal('');
  readonly secretKey = signal('');
  readonly confirmCode = signal('');
  readonly disableCode = signal('');
  readonly error2faMsg = signal('');
  readonly success2faMsg = signal('');
  readonly loading2fa = signal(false);

  readonly canSubmitConfirm2fa = computed(() => /^\d{6}$/.test(this.confirmCode().trim()));
  readonly canSubmitDisable2fa = computed(() => /^\d{6}$/.test(this.disableCode().trim()));

  async iniciarSetup2FA(): Promise<void> {
    this.error2faMsg.set('');
    this.success2faMsg.set('');
    this.confirmCode.set('');
    this.loading2fa.set(true);

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/2fa/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idUsuario: this.user()?.idUsuario })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.mensaje || 'Error al iniciar configuración 2FA');
      }

      this.qrCode.set(data.qrCode);
      this.secretKey.set(data.secret);
      this.show2faSetup.set(true);
      this.show2faDisable.set(false);
    } catch (error: any) {
      this.error2faMsg.set(error.message || 'Error al conectar con el servidor 2FA.');
    } finally {
      this.loading2fa.set(false);
    }
  }

  async activar2FA(): Promise<void> {
    if (!this.canSubmitConfirm2fa() || this.loading2fa()) return;

    this.loading2fa.set(true);
    this.error2faMsg.set('');
    this.success2faMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/2fa/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idUsuario: this.user()?.idUsuario,
          secret: this.secretKey(),
          code: this.confirmCode().trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.mensaje || 'Código incorrecto. No se activó el 2FA.');
      }

      this.success2faMsg.set('Autenticación de Doble Factor (2FA) activada correctamente.');
      this.sessionService.setUser({ ...this.user(), twoFactorEnabled: true });

      this.show2faSetup.set(false);
      this.confirmCode.set('');
    } catch (error: any) {
      this.error2faMsg.set(error.message || 'Error al validar el código 2FA.');
    } finally {
      this.loading2fa.set(false);
    }
  }

  iniciarDesactivacion2FA(): void {
    this.error2faMsg.set('');
    this.success2faMsg.set('');
    this.disableCode.set('');
    this.show2faDisable.set(true);
    this.show2faSetup.set(false);
  }

  async desactivar2FA(): Promise<void> {
    if (!this.canSubmitDisable2fa() || this.loading2fa()) return;

    this.loading2fa.set(true);
    this.error2faMsg.set('');
    this.success2faMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/2fa/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idUsuario: this.user()?.idUsuario,
          code: this.disableCode().trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.mensaje || 'Código incorrecto. No se desactivó el 2FA.');
      }

      this.success2faMsg.set('Autenticación de Doble Factor (2FA) desactivada correctamente.');
      this.sessionService.setUser({ ...this.user(), twoFactorEnabled: false });

      this.show2faDisable.set(false);
      this.disableCode.set('');
    } catch (error: any) {
      this.error2faMsg.set(error.message || 'Error al desactivar el 2FA.');
    } finally {
      this.loading2fa.set(false);
    }
  }

  cancelarFlujo2fa(): void {
    this.show2faSetup.set(false);
    this.show2faDisable.set(false);
    this.confirmCode.set('');
    this.disableCode.set('');
    this.error2faMsg.set('');
  }
}
