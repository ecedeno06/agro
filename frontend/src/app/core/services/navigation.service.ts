import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private readonly apiBaseUrl = `${environment.apiUrl}/navigation`;

  readonly menu = signal<any[]>([]);
  readonly permissions = signal<Record<string, string[]>>({});

  async loadNavigation(): Promise<void> {
    const token = localStorage.getItem('agro_session_token');
    if (!token) return;

    try {
      // Cargar menú dinámico
      const menuRes = await fetch(`${this.apiBaseUrl}/menu`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (menuRes.ok) {
        const menuData = await menuRes.json();
        this.menu.set(menuData);
      }

      // Cargar mapeo de permisos
      const permRes = await fetch(`${this.apiBaseUrl}/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (permRes.ok) {
        const permData = await permRes.json();
        this.permissions.set(permData);
      }
    } catch (error) {
      console.error('Error al cargar la estructura de navegación y permisos:', error);
    }
  }

  // Verifica si el usuario actual tiene un permiso en particular sobre una ruta
  hasPermission(ruta: string, codigoPermiso: string): boolean {
    const perms = this.permissions()[ruta];
    if (!perms) return false;
    return perms.includes(codigoPermiso);
  }

  clear(): void {
    this.menu.set([]);
    this.permissions.set({});
  }
}
