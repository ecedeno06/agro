import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { SessionService } from '../../core/services/session.service';
import { NavigationService } from '../../core/services/navigation.service';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { InactividadComponent } from '../inactividad/inactividad.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SelectorFotoComponent } from '../../core/components/selector-foto/selector-foto.component';
import { environment } from '../../../environments/environment';

/**
 * Shell del dashboard: sidebar + topbar + <router-outlet>.
 * Cada página (monitoreo, usuarios, perfil, etc.) vive en su propia ruta hija
 * y ya NO se instancia acá dentro de un @switch.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, InactividadComponent, SelectorFotoComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  readonly sessionService = inject(SessionService);
  readonly navigationService = inject(NavigationService);

  readonly submenuOpenProductos = signal(false);
  readonly submenuOpenConfiguracion = signal(false);

  readonly isDark = this.themeService.isDark;
  toggleTheme(): void { this.themeService.toggle(); }

  readonly user = this.sessionService.user;
  readonly canManageUsers = this.sessionService.canManageUsers;

  // Reloj de sesión activa
  readonly sessionDurationText = signal('00:00:00');
  private timerId: any = null;

  // Sección activa (última parte de la URL bajo /dashboard/**), usada solo para el título de la topbar
  private readonly currentSeccion = signal<string>('');

  readonly seccionActivaInfo = computed(() => {
    const seccion = this.currentSeccion();
    const menu = this.navigationService.menu();
    if (!menu || !seccion) return null;

    for (const m of menu) {
      if (m.ruta?.replace(/^\//, '') === seccion) return { nombre: m.nombre, icono: m.icono };
      for (const sub of m.submenu ?? []) {
        if (sub.ruta?.replace(/^\//, '') === seccion) return { nombre: sub.nombre, icono: sub.icono };
      }
    }
    return null;
  });

  private updateCurrentSeccion(): void {
    // Extrae el segmento de ruta bajo /dashboard/** (ej. /dashboard/usuarios -> 'usuarios')
    const url = this.router.url.split('?')[0].split('#')[0];
    const match = url.match(/^\/dashboard\/([^/]+)/);
    this.currentSeccion.set(match ? match[1] : '');
  }

  ngOnInit(): void {
    this.updateCurrentSeccion();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.updateCurrentSeccion();
    });

    const token = localStorage.getItem('agro_session_token');
    const loaded = this.sessionService.loadUserFromStorage();

    if (!token || !loaded) {
      this.logout();
      return;
    }

    this.sessionService.fetchFreshUserProfile();

    // Inicializar el timer de inactividad de sesión
    this.sessionService.init();

    // Cargar la estructura de navegación y permisos dinámicos
    this.navigationService.loadNavigation();

    // Inicializar el reloj de sesión activa transcurrida
    let startTime = Number(localStorage.getItem('agro_session_start_time'));
    if (!startTime || isNaN(startTime)) {
      startTime = Date.now();
      localStorage.setItem('agro_session_start_time', String(startTime));
    }
    this.updateSessionTimer(startTime);
    this.timerId = setInterval(() => this.updateSessionTimer(startTime), 1000);
  }

  ngOnDestroy(): void {
    this.sessionService.cleanup();
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  private updateSessionTimer(startTime: number): void {
    const elapsedMs = Date.now() - startTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');
    this.sessionDurationText.set(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
  }

  private readonly apiBaseUrl = environment.apiUrl;

  readonly showUserMenu = signal(false);
  readonly avatarToast = signal<string>('');
  readonly avatarToastError = signal<boolean>(false);
  private avatarToastTimer: any = null;

  toggleUserMenu(): void {
    this.showUserMenu.update(v => !v);
  }

  closeUserMenu(): void {
    this.showUserMenu.set(false);
  }

  logout(): void {
    this.showUserMenu.set(false);
    this.sessionService.cerrarSesion('logout_usuario');
  }

  /** Devuelve las iniciales del nombre del usuario */
  getUserInitials(): string {
    const u = this.user();
    if (!u) return '?';
    const nombre = (u.nombre || '').trim();
    const apellidos = (u.apellidos || '').trim();
    const first = nombre.charAt(0).toUpperCase();
    const second = apellidos ? apellidos.charAt(0).toUpperCase() : (nombre.charAt(1) || '').toUpperCase();
    return `${first}${second}` || '?';
  }

  /** El selector ya redujo/comprimió la imagen (canvas, máx. 300px, JPEG) antes de emitirla. */
  async onFotoPerfilCambiada(base64: string): Promise<void> {
    await this.uploadAvatar(base64);
  }

  /** El selector ya pidió confirmación antes de emitir esto. */
  async onFotoPerfilEliminada(): Promise<void> {
    await this.removeAvatar();
  }

  /** Botón directo del menú (fuera del selector): pide su propia confirmación. */
  async confirmarQuitarAvatar(): Promise<void> {
    if (!confirm('¿Eliminar tu foto de perfil?')) return;
    await this.removeAvatar();
  }

  /** Sube el avatar al backend y actualiza la sesión */
  private async uploadAvatar(base64: string): Promise<void> {
    const token = localStorage.getItem('agro_session_token');
    try {
      const res = await fetch(`${this.apiBaseUrl}/usuarios/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatar: base64 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar avatar.');

      // Actualizar el usuario en sesión
      const currentUser = this.user();
      if (currentUser) {
        const updated = { ...currentUser, avatar: base64 };
        this.sessionService.setUser(updated);
      }
      this.showUserMenu.set(false);
      this.showAvatarToast('✅ Foto de perfil actualizada.');
    } catch (err: any) {
      this.showAvatarToast(err.message || 'Error al subir imagen.', true);
    }
  }

  /** Elimina el avatar del usuario */
  async removeAvatar(): Promise<void> {
    const token = localStorage.getItem('agro_session_token');
    try {
      const res = await fetch(`${this.apiBaseUrl}/usuarios/avatar`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al eliminar avatar.');

      const currentUser = this.user();
      if (currentUser) {
        const updated = { ...currentUser, avatar: null };
        this.sessionService.setUser(updated);
      }
      this.showUserMenu.set(false);
      this.showAvatarToast('✅ Foto de perfil eliminada.');
    } catch (err: any) {
      this.showAvatarToast(err.message || 'Error al eliminar avatar.', true);
    }
  }

  private showAvatarToast(msg: string, isError = false): void {
    if (this.avatarToastTimer) clearTimeout(this.avatarToastTimer);
    this.avatarToast.set(msg);
    this.avatarToastError.set(isError);
    this.avatarToastTimer = setTimeout(() => this.avatarToast.set(''), 3500);
  }

  getIconUrl(icono: string): string {
    if (!icono) return '';
    return icono.replace(/\\/g, '/').replace(/^public\//, '/');
  }

  isUrlIcon(icono: string): boolean {
    if (!icono) return false;
    const normalized = this.getIconUrl(icono);
    const lower = normalized.toLowerCase().trim();
    return lower.startsWith('data:image/') ||
           lower.startsWith('http://') ||
           lower.startsWith('https://') ||
           lower.startsWith('/') ||
           lower.endsWith('.png') ||
           lower.endsWith('.svg') ||
           lower.endsWith('.jpg') ||
           lower.endsWith('.jpeg') ||
           lower.endsWith('.webp') ||
           lower.endsWith('.gif');
  }
}
