import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, computed, inject, ElementRef, Renderer2, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { SessionService } from '../../../core/services/session.service';

export interface Capitulo {
  id_capitulo: number;
  nombre_capitulo: string;
}

export interface UserRoleItem {
  idRegistro: number;
  idUsuario: number;
  idRol: number;
  idCapitulo: number | null;
  nombreCapitulo: string | null;
  activo: boolean;
  fechaCreacion: string;
  codigo: string;
  descripcion: string;
}

export interface RoleCatalogOption {
  idRol: number;
  codigo: string;
  descripcion: string;
  activo: boolean;
}

@Component({
  selector: 'app-usuario-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuario-tab.component.html',
  styleUrls: ['./usuario-tab.component.scss']
})
export class UsuarioTabComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() user!: any;
  @Input() personasNaturales: any[] = [];
  @Input() juntaDirectiva: any[] = [];
  @Input() errorJuntaMsg: string = '';
  @Input() exitoJuntaMsg: string = '';
  @Input() nuevaJuntaMiembroId: any = null;
  @Input() nuevaJuntaRolId: any = null;
  @Input() loading: boolean = false;

  readonly activeSubTab = signal<'generales' | 'roles'>('generales');
  readonly sessionService = inject(SessionService);
  private readonly renderer = inject(Renderer2);

  private readonly apiBaseUrl = environment.apiUrl;

  // El menú de acciones (⋮) se mueve a document.body (ver ngAfterViewInit)
  // porque la tabla y el panel "Detalle del Usuario" que la envuelve tienen
  // overflow-x/backdrop-filter, que recortan o "atrapan" cualquier posición
  // absolute/fixed que quede anidada dentro de ellos.
  @ViewChild('actionsDropdown') actionsDropdownRef?: ElementRef<HTMLElement>;

  readonly rolesAsignados = signal<UserRoleItem[]>([]);
  readonly catalogoRoles = signal<RoleCatalogOption[]>([]);
  readonly selectedRolId = signal<number | null>(null);

  // Capítulo destino al asignar un rol: solo lo elige el SUPERADMIN. Para el
  // resto de roles el backend asigna automáticamente el capítulo de su sesión.
  readonly capitulos = signal<Capitulo[]>([]);
  readonly selectedCapituloId = signal<number | null>(null);

  readonly rolesLoading = signal(false);
  readonly rolesErrorMsg = signal('');
  readonly rolesSuccessMsg = signal('');

  // Menú de acciones (⋮) por fila: solo una fila abierta a la vez.
  readonly openMenuItem = signal<UserRoleItem | null>(null);
  readonly menuPosition = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  // Roles disponibles para asignar: un rol solo se excluye si el usuario ya
  // lo tiene en el MISMO capítulo (backend lo permite en capítulos distintos,
  // ver asignarRolUsuario). Para no-superadmin todo ocurre en su propio
  // capítulo, así que basta con mirar el código de rol.
  readonly rolesDisponibles = computed(() => {
    const cat = this.catalogoRoles();
    const asignados = this.rolesAsignados();
    const esSuperadmin = this.sessionService.isSuperadmin();
    const capituloObjetivo = esSuperadmin ? this.selectedCapituloId() : null;

    const asignadosEnMismoCapitulo = new Set(
      asignados
        .filter(item => {
          if (!esSuperadmin) return true;
          if (capituloObjetivo == null) return false;
          return Number(item.idCapitulo) === Number(capituloObjetivo);
        })
        .map(item => Number(item.idRol))
    );

    return cat.filter(item => (item.activo !== false) && !asignadosEnMismoCapitulo.has(Number(item.idRol)));
  });

  ngOnInit(): void {
    this.cargarDatosRoles();
    if (this.sessionService.isSuperadmin()) {
      this.cargarCapitulos();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && !changes['user'].firstChange) {
      this.cargarDatosRoles();
    }
  }

  ngAfterViewInit(): void {
    if (this.actionsDropdownRef) {
      this.renderer.appendChild(document.body, this.actionsDropdownRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.actionsDropdownRef) {
      this.renderer.removeChild(document.body, this.actionsDropdownRef.nativeElement);
    }
  }

  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async cargarDatosRoles(): Promise<void> {
    if (!this.user || !this.user.idUsuario) return;
    try {
      this.rolesLoading.set(true);
      this.rolesErrorMsg.set('');

      await Promise.all([
        this.cargarRolesUsuario(),
        this.cargarCatalogoRoles()
      ]);
    } catch (error: any) {
      console.error('Error al cargar roles del usuario:', error);
      this.rolesErrorMsg.set('Error al cargar la lista de roles del usuario.');
    } finally {
      this.rolesLoading.set(false);
    }
  }

  async cargarRolesUsuario(): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/usuarios/${this.user.idUsuario}/roles`, {
      headers: this.getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      this.rolesAsignados.set(data);
    }
  }

  async cargarCatalogoRoles(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/usuarios/roles-catalogo`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data.map((item: any) => ({
          ...item,
          idRol: Number(item.idRol || item.idrol)
        })) : [];
        this.catalogoRoles.set(list);
      }
    } catch (e) {
      console.error('Error al cargar catálogo de roles:', e);
    }
  }

  async cargarCapitulos(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/maintenance/chapters`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        this.capitulos.set(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error al cargar catálogo de capítulos:', e);
    }
  }

  async asignarRol(): Promise<void> {
    const idRol = this.selectedRolId();
    if (!idRol || !this.user?.idUsuario) {
      this.rolesErrorMsg.set('Seleccione un rol del catálogo.');
      return;
    }

    if (this.sessionService.isSuperadmin() && !this.selectedCapituloId()) {
      this.rolesErrorMsg.set('Seleccione el capítulo para este rol.');
      return;
    }

    try {
      this.rolesLoading.set(true);
      this.rolesErrorMsg.set('');
      this.rolesSuccessMsg.set('');

      // idCapitulo solo lo decide el SUPERADMIN; para el resto de roles el
      // backend ignora este valor y usa siempre el capítulo de su sesión.
      const body: { idRol: number; idCapitulo?: number } = { idRol };
      if (this.sessionService.isSuperadmin() && this.selectedCapituloId()) {
        body.idCapitulo = this.selectedCapituloId()!;
      }

      const res = await fetch(`${this.apiBaseUrl}/usuarios/${this.user.idUsuario}/roles`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al asignar rol.');

      this.rolesSuccessMsg.set('Rol asignado al usuario exitosamente.');
      this.selectedRolId.set(null);
      this.selectedCapituloId.set(null);
      await this.cargarRolesUsuario();
    } catch (error: any) {
      console.error(error);
      this.rolesErrorMsg.set(error.message || 'Error al asignar rol.');
    } finally {
      this.rolesLoading.set(false);
    }
  }

  async alternarEstadoRol(item: UserRoleItem): Promise<void> {
    try {
      this.rolesLoading.set(true);
      this.rolesErrorMsg.set('');
      this.rolesSuccessMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/usuarios/roles/${item.idRegistro}/toggle`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al cambiar estado del rol.');

      this.rolesSuccessMsg.set(data.message);
      await this.cargarRolesUsuario();
    } catch (error: any) {
      console.error(error);
      this.rolesErrorMsg.set(error.message || 'Error al cambiar estado.');
    } finally {
      this.rolesLoading.set(false);
    }
  }

  toggleMenu(item: UserRoleItem, event: MouseEvent): void {
    event.stopPropagation();

    if (this.openMenuItem()?.idRegistro === item.idRegistro) {
      this.closeMenu();
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const dropdownWidth = 200;

    this.menuPosition.set({
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - dropdownWidth)
    });
    this.openMenuItem.set(item);
  }

  closeMenu(): void {
    this.openMenuItem.set(null);
  }

  /**
   * Placeholder: todavía no existe servicio de correo (SMTP/proveedor) en el
   * backend. Cuando se configure, esto debe llamar a un endpoint real que
   * envíe la invitación.
   */
  enviarInvitacion(item: UserRoleItem): void {
    this.closeMenu();
    this.rolesSuccessMsg.set(
      `El envío de invitación por correo para el rol ${item.codigo.toUpperCase()} estará disponible próximamente.`
    );
  }

  async eliminarRol(item: UserRoleItem): Promise<void> {
    if (!confirm(`¿Está seguro de remover el rol "${item.codigo.toUpperCase()}" a este usuario?`)) return;

    try {
      this.rolesLoading.set(true);
      this.rolesErrorMsg.set('');
      this.rolesSuccessMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/usuarios/roles/${item.idRegistro}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al eliminar rol.');

      this.rolesSuccessMsg.set(data.message);
      await this.cargarRolesUsuario();
    } catch (error: any) {
      console.error(error);
      this.rolesErrorMsg.set(error.message || 'Error al eliminar rol.');
    } finally {
      this.rolesLoading.set(false);
    }
  }
}
