import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavigationService } from '../../core/services/navigation.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  host: {
    '[class.collapsed]': 'collapsed()'
  }
})
export class SidebarComponent {
  readonly navService = inject(NavigationService);

  readonly collapsed = signal(false);
  readonly activeSubmenu = signal<number | null>(null);

  toggleCollapsed(): void {
    this.collapsed.set(!this.collapsed());
  }

  @Input() canManageUsers = false;

  @Input({ required: true }) submenuOpenProductos!: boolean;
  @Output() submenuOpenProductosChange = new EventEmitter<boolean>();

  @Input({ required: true }) submenuOpenConfiguracion!: boolean;
  @Output() submenuOpenConfiguracionChange = new EventEmitter<boolean>();

  @Input({ required: true }) isDark!: boolean;
  @Output() themeToggle = new EventEmitter<void>();

  @Output() logoutRequested = new EventEmitter<void>();
  @Output() triggerInactivity = new EventEmitter<void>();

  /** Normaliza la ruta que viene del backend (puede venir con o sin '/' inicial) */
  rutaMenu(ruta: string): string[] {
    const normalized = ruta?.startsWith('/') ? ruta.substring(1) : ruta;
    return ['/dashboard', normalized];
  }

  toggleSubmenu(id: number): void {
    this.activeSubmenu.set(this.activeSubmenu() === id ? null : id);
  }

  getIconUrl(icono: string): string {
    if (!icono) return '';
    // Ícono subido (base64): se usa tal cual, no es una ruta de archivo.
    if (icono.trim().startsWith('data:image/')) return icono.trim();
    let cleaned = icono.trim().replace(/\\/g, '/');
    if (cleaned.startsWith('public/')) {
      cleaned = cleaned.substring(6); // Convierte public/assets/... a /assets/...
    }
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      return cleaned;
    }
    // Si solo se ingresó el nombre del archivo (ej. "paises.png" o "seguridad.svg")
    if (!cleaned.includes('/')) {
      return `/assets/icons/${cleaned}`;
    }
    // Si se ingresó "icons/paises.png"
    if (cleaned.startsWith('icons/')) {
      return `/assets/${cleaned}`;
    }
    // Si se ingresó "assets/icons/paises.png" sin slash inicial
    if (!cleaned.startsWith('/')) {
      cleaned = '/' + cleaned;
    }
    return cleaned;
  }

  isUrlIcon(icono: string): boolean {
    if (!icono) return false;
    const lower = icono.trim().toLowerCase();
    return lower.startsWith('data:image/') ||
           lower.startsWith('http://') ||
           lower.startsWith('https://') ||
           lower.startsWith('/') ||
           lower.includes('/') ||
           lower.endsWith('.png') ||
           lower.endsWith('.svg') ||
           lower.endsWith('.jpg') ||
           lower.endsWith('.jpeg') ||
           lower.endsWith('.webp') ||
           lower.endsWith('.gif');
  }

  toggleSubmenuProductos(): void {
    this.submenuOpenProductosChange.emit(!this.submenuOpenProductos);
  }

  toggleSubmenuConfiguracion(): void {
    this.submenuOpenConfiguracionChange.emit(!this.submenuOpenConfiguracion);
  }

  toggleTheme(): void {
    this.themeToggle.emit();
  }

  logout(): void {
    this.logoutRequested.emit();
  }
}
