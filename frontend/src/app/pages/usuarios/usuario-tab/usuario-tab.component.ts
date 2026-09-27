import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal, computed, inject, ElementRef, Renderer2, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { SessionService } from '../../../core/services/session.service';
import { dividirTelefono, combinarTelefono, CODIGO_TELEFONO_DEFECTO } from '../../../core/utils/telefono.util';

export interface Capitulo {
  id_capitulo: number;
  nombre_capitulo: string;
}

export interface PaisTelefonoOpcion {
  codigo_iso2: string;
  nombre: string;
  codigo_telefono: string | null;
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

  /** Emite el usuario actualizado tras editar datos o resetear contraseña, para que el padre refresque tabla + selección. */
  @Output() usuarioActualizado = new EventEmitter<any>();

  readonly activeSubTab = signal<'generales' | 'roles'>('generales');

  // --- Edición de datos del usuario (solo admin/superadmin) ---
  readonly editandoDatos = signal(false);
  readonly guardandoDatos = signal(false);
  readonly datosErrorMsg = signal('');
  readonly datosSuccessMsg = signal('');
  readonly paisesTelefono = signal<PaisTelefonoOpcion[]>([]);
  readonly telefonoCodigoPais = signal(CODIGO_TELEFONO_DEFECTO);
  readonly editForm = signal({
    nombre: '',
    apellidos: '',
    email: '',
    telefono: '',
    telefono_whatsapp: false,
    tipo_persona: 'natural' as 'natural' | 'juridica',
    dni: '',
    ruc: '',
    no_aviso_operacion: '',
    fecha_aviso_operacion: '',
    rep_legal: null as number | null
  });

  // --- Reseteo de contraseña (solo admin/superadmin) ---
  readonly reseteandoPassword = signal(false);
  readonly passwordGenerada = signal<string | null>(null);
  readonly resetErrorMsg = signal('');
  readonly resetSuccessMsg = signal('');
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
  readonly enviandoInvitacion = signal(false);
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
    this.cargarPaisesTelefono();
    if (this.sessionService.isSuperadmin()) {
      this.cargarCapitulos();
    }
  }

  async cargarPaisesTelefono(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/paises`, { headers: this.getAuthHeaders() });
      if (res.ok) this.paisesTelefono.set(await res.json());
    } catch (e) {
      console.error('Error al cargar códigos telefónicos de países:', e);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && !changes['user'].firstChange) {
      this.cargarDatosRoles();
      this.editandoDatos.set(false);
      this.datosErrorMsg.set('');
      this.datosSuccessMsg.set('');
      this.passwordGenerada.set(null);
      this.resetErrorMsg.set('');
      this.resetSuccessMsg.set('');
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
    const dropdownHeightEstimado = 140;

    // Si no hay espacio debajo (ej. última fila de la tabla), abrir hacia arriba.
    const espacioAbajo = window.innerHeight - rect.bottom;
    const top = espacioAbajo < dropdownHeightEstimado
      ? Math.max(8, rect.top - dropdownHeightEstimado - 6)
      : rect.bottom + 6;

    this.menuPosition.set({
      top,
      left: Math.max(8, rect.right - dropdownWidth)
    });
    this.openMenuItem.set(item);
  }

  closeMenu(): void {
    this.openMenuItem.set(null);
  }

  /** Solo notifica por correo (enlace + usuario); no modifica la contraseña actual. */
  async enviarInvitacion(item: UserRoleItem): Promise<void> {
    this.closeMenu();
    if (!this.user?.idUsuario) return;
    const contextoCapitulo = item.nombreCapitulo ? ` al capítulo "${item.nombreCapitulo}" (rol ${item.codigo.toUpperCase()})` : '';
    if (!confirm(`¿Enviar invitación de acceso a ${this.user.nombre} (${this.user.email})${contextoCapitulo}? Solo se le notificará por correo el enlace y su usuario; su contraseña actual no cambia.`)) {
      return;
    }

    this.enviandoInvitacion.set(true);
    this.rolesErrorMsg.set('');
    this.rolesSuccessMsg.set('');
    try {
      const res = await fetch(`${this.apiBaseUrl}/usuarios/${this.user.idUsuario}/enviar-invitacion`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ rolCodigo: item.codigo, capitulo: item.nombreCapitulo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo enviar la invitación.');
      this.rolesSuccessMsg.set(data.message);
    } catch (error: any) {
      this.rolesErrorMsg.set(error.message || 'No se pudo enviar la invitación.');
    } finally {
      this.enviandoInvitacion.set(false);
    }
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

  // ==============================================
  // EDICIÓN DE DATOS DEL USUARIO (solo admin/superadmin)
  // ==============================================

  activarEdicionDatos(): void {
    const { codigo, numero } = dividirTelefono(this.user?.telefono);
    this.telefonoCodigoPais.set(codigo);
    this.editForm.set({
      nombre: this.user?.nombre || '',
      apellidos: this.user?.apellidos || '',
      email: this.user?.email || '',
      telefono: numero,
      telefono_whatsapp: !!this.user?.telefono_whatsapp,
      tipo_persona: this.user?.tipo_persona === 'juridica' ? 'juridica' : 'natural',
      dni: this.user?.dni || '',
      ruc: this.user?.ruc || '',
      no_aviso_operacion: this.user?.no_aviso_operacion || '',
      fecha_aviso_operacion: (this.user?.fecha_aviso_operacion || '').toString().substring(0, 10),
      rep_legal: this.user?.rep_legal ?? null
    });
    this.datosErrorMsg.set('');
    this.datosSuccessMsg.set('');
    this.editandoDatos.set(true);
  }

  cancelarEdicionDatos(): void {
    this.editandoDatos.set(false);
    this.datosErrorMsg.set('');
  }

  actualizarCampoEdicion<K extends keyof ReturnType<typeof this.editForm>>(campo: K, valor: ReturnType<typeof this.editForm>[K]): void {
    this.editForm.set({ ...this.editForm(), [campo]: valor });
  }

  async guardarDatosUsuario(): Promise<void> {
    if (!this.user?.idUsuario) return;
    const f = this.editForm();
    if (!f.nombre.trim() || !f.email.trim()) {
      this.datosErrorMsg.set('Nombre y correo electrónico son obligatorios.');
      return;
    }

    this.guardandoDatos.set(true);
    this.datosErrorMsg.set('');
    this.datosSuccessMsg.set('');

    try {
      const payload = { ...f, telefono: combinarTelefono(this.telefonoCodigoPais(), f.telefono) };
      const res = await fetch(`${this.apiBaseUrl}/usuarios/${this.user.idUsuario}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudieron guardar los datos del usuario.');

      this.datosSuccessMsg.set('Datos del usuario actualizados correctamente.');
      this.editandoDatos.set(false);
      this.usuarioActualizado.emit(data.usuario);
    } catch (error: any) {
      this.datosErrorMsg.set(error.message || 'No se pudieron guardar los datos del usuario.');
    } finally {
      this.guardandoDatos.set(false);
    }
  }

  // ==============================================
  // RESETEO DE CONTRASEÑA POR CORREO (solo admin/superadmin)
  // ==============================================

  async resetearPasswordCorreo(): Promise<void> {
    if (!this.user?.idUsuario) return;
    if (!confirm(`¿Restablecer la contraseña de ${this.user.nombre}? Deberá cambiarla en su próximo inicio de sesión.`)) return;

    this.reseteandoPassword.set(true);
    this.resetErrorMsg.set('');
    this.resetSuccessMsg.set('');
    this.passwordGenerada.set(null);

    try {
      const res = await fetch(`${this.apiBaseUrl}/usuarios/${this.user.idUsuario}/reset-password`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo restablecer la contraseña.');

      this.passwordGenerada.set(data.password);
      this.resetSuccessMsg.set(
        data.emailEnviado
          ? 'Contraseña restablecida y enviada por correo al usuario.'
          : 'Contraseña restablecida. El usuario no tiene correo registrado: compártela manualmente.'
      );
    } catch (error: any) {
      this.resetErrorMsg.set(error.message || 'No se pudo restablecer la contraseña.');
    } finally {
      this.reseteandoPassword.set(false);
    }
  }

  async copiarPasswordGenerada(): Promise<void> {
    const pass = this.passwordGenerada();
    if (!pass) return;
    try {
      await navigator.clipboard.writeText(pass);
      this.resetSuccessMsg.set('Contraseña copiada al portapapeles.');
    } catch {
      // Clipboard API puede fallar sin HTTPS/permiso; el valor sigue visible en pantalla.
    }
  }
}
