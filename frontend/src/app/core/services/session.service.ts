import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SessionService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly apiBaseUrl = environment.apiUrl;

  /** Usuario autenticado actual. Antes vivía duplicado dentro de DashboardComponent. */
  readonly user = signal<any | null>(null);

  /** Indica si el usuario actual es SUPERADMIN con identidad firmada verificada */
  readonly isSuperadmin = computed(() => this.user()?.isSuperadmin === true);

  readonly canManageUsers = computed(() => {
    const u = this.user();
    if (!u) return false;
    const isSuper = u.isSuperadmin === true || u.email === 'superadmin@agro.com';
    const hasRole = u.rol === 'admin' || u.rol === 'adm' || u.rol === 'superadmin' || u.rol === 'secretaria' || u.rol === 'sec';
    return isSuper || hasRole;
  });

  /** Carga el usuario desde localStorage (llamar al iniciar la app/dashboard). */
  loadUserFromStorage(): boolean {
    const userStr = localStorage.getItem('agro_session_user');
    if (!userStr) return false;
    try {
      this.user.set(JSON.parse(userStr));
      return true;
    } catch {
      return false;
    }
  }

  setUser(user: any): void {
    this.user.set(user);
    localStorage.setItem('agro_session_user', JSON.stringify(user));
  }

  /** Refresca el perfil contra el backend (fuente de verdad). */
  async fetchFreshUserProfile(): Promise<void> {
    const token = localStorage.getItem('agro_session_token');
    if (!token) return;

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.usuario) this.setUser(data.usuario);
      } else if (response.status === 401) {
        // Solo cerrar sesión si el token es inválido o expiró
        this.cerrarSesion('token_invalido');
      } else {
        // Errores 500, 503, 404, etc.: no cerrar sesión, el servidor puede estar reiniciando
        console.warn(`[Session] fetchFreshUserProfile respondió ${response.status} — se ignora para no cerrar sesión.`);
      }
    } catch (error) {
      // Error de red (servidor caído, sin conexión): no cerrar sesión
      console.warn('[Session] No se pudo conectar con el servidor para refrescar perfil:', error);
    }
  }

  // Tiempos en milisegundos (se cargan del backend, con fallbacks)
  private inactivityLimit = 15 * 60 * 1000;       // 15 minutos
  private warningBefore = 2 * 60 * 1000;           // Aviso 2 min antes
  private refreshInterval = 10 * 60 * 1000;        // Refresh cada 10 min

  /** Signal que indica si se debe mostrar el modal de advertencia */
  readonly showExpiryWarning = signal(false);

  readonly countdownText = signal('00:00');
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private expireTimestamp = 0;

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  private readonly activityEvents = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'];
  private boundResetTimer = this.resetInactivityTimer.bind(this);
  private initialized = false;

  /** Cargar configuración de sesión desde el backend */
  private async loadConfig(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/session-config`);
      if (response.ok) {
        const config = await response.json();
        this.inactivityLimit = config.inactivityLimitMs;
        this.warningBefore = config.warningBeforeMs;
        this.refreshInterval = config.refreshIntervalMs;
      }
    } catch (e) {
      console.error('Error al cargar la configuración de sesión del backend:', e);
    }
  }

  /** Inicializar listeners y timers. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Resetear estados del modal para evitar fugas de estados anteriores
    this.showExpiryWarning.set(false);
    this.countdownText.set('00:00');

    // Cargar la configuración dinámica desde el backend
    await this.loadConfig();

    // Escuchar actividad de usuario
    this.activityEvents.forEach(event =>
      document.addEventListener(event, this.boundResetTimer, { passive: true })
    );

    // Iniciar timer de inactividad
    this.resetInactivityTimer();

    // Iniciar refresh periódico
    this.refreshTimer = setInterval(() => this.refreshSession(), this.refreshInterval);
  }

  /** Limpiar todos los listeners y timers */
  ngOnDestroy(): void {
    this.cleanup();
  }

  cleanup(): void {
    this.activityEvents.forEach(event =>
      document.removeEventListener(event, this.boundResetTimer)
    );

    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.clearCountdown();

    this.showExpiryWarning.set(false);
    this.countdownText.set('00:00');
    this.initialized = false;
  }

  /** Resetea el timer de inactividad cada vez que el usuario interactúa */
  private resetInactivityTimer(): void {
    if (this.showExpiryWarning()) {
      return;
    }

    this.clearCountdown();

    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

    // Calcular timestamp de expiración exacta
    this.expireTimestamp = Date.now() + this.inactivityLimit;

    // Timer para mostrar advertencia
    this.warningTimer = setTimeout(() => {
      this.showExpiryWarning.set(true);
      this.startCountdown();
    }, this.inactivityLimit - this.warningBefore);

    // Timer para cerrar sesión
    this.inactivityTimer = setTimeout(() => {
      this.cerrarSesion('inactividad');
    }, this.inactivityLimit);
  }

  private startCountdown(): void {
    this.clearCountdown();
    this.updateCountdown();
    this.countdownTimer = setInterval(() => this.updateCountdown(), 1000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private updateCountdown(): void {
    const remainingMs = this.expireTimestamp - Date.now();
    if (remainingMs <= 0) {
      this.countdownText.set('00:00');
      this.clearCountdown();
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');
    this.countdownText.set(`${pad(minutes)}:${pad(seconds)}`);
  }

  /** Extender sesión manualmente */
  extenderSesion(): void {
    this.showExpiryWarning.set(false);
    this.resetInactivityTimer();
    this.refreshSession();
  }

  /** Cerrar sesión: llamar al backend, limpiar y redirigir */
  async cerrarSesion(razon: string = 'logout_usuario'): Promise<void> {
    const token = localStorage.getItem('agro_session_token');

    if (token) {
      try {
        await fetch(`${this.apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ razon })
        });
      } catch (e) {
        console.error('Error al cerrar sesión en servidor:', e);
      }
    }

    this.cleanup();
    this.user.set(null);
    localStorage.removeItem('agro_session_token');
    localStorage.removeItem('agro_session_user');
    localStorage.removeItem('agro_session_start_time');
    localStorage.removeItem('agro_session_expires_in');
    localStorage.removeItem('agro_session_expires_at');
    this.router.navigate(['/login']);
  }

  /** Renovar sesión en el servidor */
  private async refreshSession(): Promise<void> {
    const token = localStorage.getItem('agro_session_token');
    if (!token) return;

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/refresh-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        this.cerrarSesion('expiracion_token');
      }
    } catch (e) {
      console.error('Error al renovar sesión:', e);
    }
  }

  /** Método especial de demostración para forzar la inactividad */
  triggerDemoInactivity(): void {
    console.log('⏱️ Demo: Forzando inactividad de sesión (60 segundos)...');
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

    // Configurar expiración en 60 segundos
    this.expireTimestamp = Date.now() + 60 * 1000;
    this.showExpiryWarning.set(true);
    this.startCountdown();

    this.inactivityTimer = setTimeout(() => {
      console.log('⏱️ Demo: Tiempo expirado, cerrando sesión...');
      this.cerrarSesion('inactividad');
    }, 60 * 1000);
  }
}
