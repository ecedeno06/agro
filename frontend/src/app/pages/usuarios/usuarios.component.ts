import { Component, signal, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type RolAsignado = {
  idRol: number;
  codigo: string;
  descripcion?: string;
  idCapitulo?: number | null;
  nombreCapitulo?: string | null;
};

type RolCatalogo = {
  idRol: number;
  codigo: string;
  descripcion?: string;
  activo?: boolean;
};

type Capitulo = {
  id_capitulo: number;
  nombre_capitulo: string;
};

type Usuario = {
  idUsuario?: number;
  nombre: string;
  apellidos?: string;
  email: string;
  password?: string;
  telefono?: string;
  /** Códigos de rol reales provenientes de catalogo_rol (puede ser "adm, sec"). */
  rol: string;
  /** Rol a asignar al crear: se envía como idRol al backend. */
  idRol?: number | null;
  /** Detalle de los roles asignados en usuario_rol. */
  roles?: RolAsignado[];
  /** Valor heredado de usuarios.rol, solo informativo. */
  rol_legacy?: string;
  /** Capítulo destino al crear: solo lo elige el SUPERADMIN; el resto hereda el suyo. */
  idCapitulo?: number | null;
  activo?: boolean;
  tipo_persona: 'natural' | 'juridica';
  dni?: string;
  ruc?: string;
  no_aviso_operacion?: string;
  fecha_aviso_operacion?: string;
  rep_legal?: number;
};

import { UsuarioTabComponent } from './usuario-tab/usuario-tab.component';
import { environment } from '../../../environments/environment';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, UsuarioTabComponent],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss']
})
export class UsuariosComponent implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;
  readonly sessionService = inject(SessionService);

  usuarios = signal<Usuario[]>([]);
  selectedUser = signal<Usuario | null>(null);

  // Catálogo de roles: se carga desde catalogo_rol (antes estaba hardcodeado
  // y no coincidía con los códigos reales, ej. 'admin' vs 'adm').
  roles = signal<RolCatalogo[]>([]);

  // Catálogo de capítulos: solo se carga y se muestra para SUPERADMIN, que
  // puede crear usuarios en cualquier capítulo. Los demás roles (adm, sec)
  // no lo ven: el backend asigna automáticamente el capítulo de su sesión.
  capitulos = signal<Capitulo[]>([]);

  // Estados de carga e información
  loading = signal(false);
  mensajeError = signal('');
  mensajeExito = signal('');

  // Nuevas señales específicas para contextualizar errores
  errorRegistroMsg = signal('');
  exitoRegistroMsg = signal('');
  errorJuntaMsg = signal('');
  exitoJuntaMsg = signal('');

  // Filtro de búsqueda global
  filtroTexto = signal('');

  // Control para expandir el formulario de creación
  mostrarFormularioCreacion = signal(false);

  // Nuevo usuario (formulario)
  nuevoUsuario: Usuario = {
    nombre: '',
    apellidos: '',
    email: '',
    password: '',
    telefono: '',
    rol: '',
    idRol: null,
    idCapitulo: null,
    tipo_persona: 'natural',
    dni: '',
    ruc: '',
    no_aviso_operacion: '',
    fecha_aviso_operacion: '',
    rep_legal: undefined
  };

  // Junta Directiva del usuario empresa seleccionado
  juntaDirectiva = signal<any[]>([]);
  nuevaJuntaMiembroId = signal<number | null>(null);
  nuevaJuntaRolId = signal<number | null>(null);

  // Lista de personas naturales disponibles para junta directiva (para el autocompletado/select)
  personasNaturales = computed(() => {
    return this.usuarios().filter(u => u.tipo_persona === 'natural');
  });

  // Filtrado reactivo de usuarios en la tabla (búsqueda global en todas las columnas)
  usuariosFiltrados = computed(() => {
    const texto = this.filtroTexto().toLowerCase().trim();

    return this.usuarios().filter(u => {
      if (!texto) return true;

      const nombreCompleto = `${u.nombre} ${u.apellidos || ''}`.toLowerCase();
      const email = u.email.toLowerCase();
      const dni = (u.dni || '').toLowerCase();
      const ruc = (u.ruc || '').toLowerCase();
      const rol = (u.rol || '').toLowerCase();
      const tipo = u.tipo_persona === 'juridica' ? 'empresa juridica' : 'natural';
      const estado = u.activo !== false ? 'activo' : 'inactivo solo registro';

      return nombreCompleto.includes(texto) ||
        email.includes(texto) ||
        dni.includes(texto) ||
        ruc.includes(texto) ||
        rol.includes(texto) ||
        tipo.includes(texto) ||
        estado.includes(texto);
    });
  });

  ngOnInit(): void {
    this.sessionService.loadUserFromStorage();
    this.cargarUsuarios();
    this.cargarCatalogoRoles();
    if (this.sessionService.isSuperadmin()) {
      this.cargarCapitulos();
    }
  }

  /** Carga el catálogo de capítulos (solo relevante para SUPERADMIN). */
  async cargarCapitulos(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/maintenance/chapters`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al cargar el catálogo de capítulos');
      }

      const data: Capitulo[] = await response.json();
      this.capitulos.set(data);
    } catch (error: any) {
      this.mensajeError.set(error.message || 'Error de conexión al cargar capítulos');
    }
  }

  /** Carga el catálogo real de roles desde el backend (catalogo_rol). */
  async cargarCatalogoRoles(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/usuarios/roles-catalogo`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al cargar el catálogo de roles');
      }

      const data: RolCatalogo[] = await response.json();
      this.roles.set(data);

      // Preseleccionar el primer rol disponible si el formulario aún no tiene uno.
      if (!this.nuevoUsuario.idRol && data.length > 0) {
        this.nuevoUsuario.idRol = data[0].idRol;
      }
    } catch (error: any) {
      this.mensajeError.set(error.message || 'Error de conexión al cargar roles');
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async cargarUsuarios(): Promise<void> {
    this.loading.set(true);
    this.mensajeError.set('');
    try {
      const response = await fetch(`${this.apiBaseUrl}/usuarios`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al cargar la lista de usuarios');
      }

      const data = await response.json();
      this.usuarios.set(data);
    } catch (error: any) {
      this.mensajeError.set(error.message || 'Error de conexión');
    } finally {
      this.loading.set(false);
    }
  }

  seleccionarUsuario(usuario: Usuario): void {
    this.selectedUser.set({ ...usuario });
    this.mostrarFormularioCreacion.set(false);
    this.mensajeExito.set('');
    this.mensajeError.set('');
    this.errorRegistroMsg.set('');
    this.exitoRegistroMsg.set('');
    this.errorJuntaMsg.set('');
    this.exitoJuntaMsg.set('');

    if (usuario.tipo_persona === 'juridica' && usuario.idUsuario) {
      this.cargarJuntaDirectiva(usuario.idUsuario);
    } else {
      this.juntaDirectiva.set([]);
    }
  }

  cerrarDetalle(): void {
    this.selectedUser.set(null);
    this.juntaDirectiva.set([]);
    this.errorJuntaMsg.set('');
    this.exitoJuntaMsg.set('');
  }

  async solicitarGenerarPassword(): Promise<void> {
    this.errorRegistroMsg.set('');
    this.exitoRegistroMsg.set('');
    try {
      const response = await fetch(`${this.apiBaseUrl}/usuarios/generar-password`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al generar contraseña segura desde servidor.');
      }

      const data = await response.json();
      if (data.password) {
        this.nuevoUsuario.password = data.password;
        this.exitoRegistroMsg.set('Contraseña segura autogenerada.');
      }
    } catch (error: any) {
      this.errorRegistroMsg.set(error.message || 'Error de conexión al generar contraseña.');
    }
  }

  async crearUsuarioSubmit(): Promise<void> {
    this.errorRegistroMsg.set('');
    this.exitoRegistroMsg.set('');

    if (!this.nuevoUsuario.idRol) {
      this.errorRegistroMsg.set('Debe seleccionar un rol para el usuario.');
      return;
    }

    if (this.sessionService.isSuperadmin() && !this.nuevoUsuario.idCapitulo) {
      this.errorRegistroMsg.set('Debe seleccionar el capítulo del nuevo usuario.');
      return;
    }

    this.loading.set(true);

    try {
      // Se envía idRol (fuente de verdad en catalogo_rol). El backend crea la
      // relación en usuario_rol dentro de una transacción. No se manda 'rol'
      // como texto para no reintroducir la desincronización con el catálogo.
      // idCapitulo solo lo decide el SUPERADMIN; para el resto de roles el
      // backend ignora este valor y usa siempre el capítulo de su sesión.
      const payload = {
        nombre: this.nuevoUsuario.nombre,
        apellidos: this.nuevoUsuario.apellidos,
        email: this.nuevoUsuario.email,
        password: this.nuevoUsuario.password,
        telefono: this.nuevoUsuario.telefono,
        idRol: this.nuevoUsuario.idRol,
        idCapitulo: this.sessionService.isSuperadmin() ? this.nuevoUsuario.idCapitulo : undefined,
        tipo_persona: this.nuevoUsuario.tipo_persona,
        dni: this.nuevoUsuario.dni,
        ruc: this.nuevoUsuario.ruc,
        no_aviso_operacion: this.nuevoUsuario.no_aviso_operacion,
        fecha_aviso_operacion: this.nuevoUsuario.fecha_aviso_operacion,
        rep_legal: this.nuevoUsuario.rep_legal
      };

      const response = await fetch(`${this.apiBaseUrl}/usuarios`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Error al registrar el nuevo usuario');
      }

      this.exitoRegistroMsg.set('Usuario registrado correctamente.');
      this.mensajeExito.set('Usuario registrado correctamente.');
      this.mostrarFormularioCreacion.set(false);
      this.restablecerNuevoUsuarioForm();
      await this.cargarUsuarios();
    } catch (error: any) {
      this.errorRegistroMsg.set(error.message || 'Error de red');
    } finally {
      this.loading.set(false);
    }
  }

  restablecerNuevoUsuarioForm(): void {
    const catalogo = this.roles();
    this.nuevoUsuario = {
      nombre: '',
      apellidos: '',
      email: '',
      password: '',
      telefono: '',
      rol: '',
      idRol: catalogo.length > 0 ? catalogo[0].idRol : null,
      idCapitulo: null,
      tipo_persona: 'natural',
      dni: '',
      ruc: '',
      no_aviso_operacion: '',
      fecha_aviso_operacion: '',
      rep_legal: undefined
    };
  }

  // ==============================================
  // GESTIÓN DE JUNTA DIRECTIVA (B2B)
  // ==============================================

  async cargarJuntaDirectiva(idEmpresa: number): Promise<void> {
    this.errorJuntaMsg.set('');
    try {
      const response = await fetch(`${this.apiBaseUrl}/junta-directiva/${idEmpresa}`, {
        headers: this.getAuthHeaders()
      });
      
      const contentType = response.headers.get('content-type');
      if (!response.ok || !contentType || !contentType.includes('application/json')) {
        throw new Error(`El servidor retornó una respuesta inválida (${response.status}).`);
      }

      const data = await response.json();
      this.juntaDirectiva.set(data);
    } catch (error: any) {
      console.error('Error al cargar la junta directiva:', error);
      this.errorJuntaMsg.set(error.message || 'Error al cargar la junta directiva.');
    }
  }

  async agregarMiembroJunta(): Promise<void> {
    const empresa = this.selectedUser();
    const miembroId = this.nuevaJuntaMiembroId();
    const rolId = this.nuevaJuntaRolId();

    if (!empresa || !empresa.idUsuario || !miembroId || !rolId) return;

    this.loading.set(true);
    this.errorJuntaMsg.set('');
    this.exitoJuntaMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/junta-directiva`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          id_empresa: empresa.idUsuario,
          id_miembro: miembroId,
          id_rol: rolId
        })
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        let errMsg = 'Error al agregar miembro a la junta';
        if (contentType && contentType.includes('application/json')) {
          const errData = await response.json();
          errMsg = errData.message || errMsg;
        } else {
          errMsg = `Error del servidor (${response.status}): respuesta no válida.`;
        }
        throw new Error(errMsg);
      }

      this.exitoJuntaMsg.set('Miembro agregado a la junta directiva exitosamente.');
      this.nuevaJuntaMiembroId.set(null);
      this.nuevaJuntaRolId.set(null);
      
      await this.cargarJuntaDirectiva(empresa.idUsuario);
    } catch (error: any) {
      this.errorJuntaMsg.set(error.message || 'Error al procesar la asignación');
    } finally {
      this.loading.set(false);
    }
  }

  async eliminarMiembroJunta(idJuntaDirectivaUsuario: number): Promise<void> {
    const empresa = this.selectedUser();
    if (!empresa || !empresa.idUsuario) return;

    this.loading.set(true);
    this.errorJuntaMsg.set('');
    this.exitoJuntaMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/junta-directiva/${idJuntaDirectivaUsuario}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        let errMsg = 'Error al eliminar miembro de la junta';
        if (contentType && contentType.includes('application/json')) {
          const errData = await response.json();
          errMsg = errData.message || errMsg;
        } else {
          errMsg = `Error del servidor (${response.status}): respuesta no válida.`;
        }
        throw new Error(errMsg);
      }

      this.exitoJuntaMsg.set('Miembro removido de la junta.');
      await this.cargarJuntaDirectiva(empresa.idUsuario);
    } catch (error: any) {
      this.errorJuntaMsg.set(error.message || 'Error de conexión');
    } finally {
      this.loading.set(false);
    }
  }
}
