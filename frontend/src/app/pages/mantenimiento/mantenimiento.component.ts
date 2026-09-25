import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationService } from '../../core/services/navigation.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mantenimiento',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mantenimiento.component.html',
  styleUrls: ['./mantenimiento.component.scss']
})
export class MantenimientoComponent implements OnInit {
  readonly navService = inject(NavigationService);
  private readonly apiBaseUrl = `${environment.apiUrl}/maintenance`;

  readonly tabActivo = signal<'menus' | 'roles' | 'permisos-crud' | 'matrix'>('menus');
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  // --- TAB 1: MANTENIMIENTO DE MENUS (CRUD) ---
  readonly menusListAll = signal<any[]>([]);
  readonly editingMenuId = signal<number | null>(null);
  readonly filterMenuText = signal('');
  
  // Campos del formulario de Menús
  readonly formMenuId = signal<number | null>(null);
  readonly formMenuNombre = signal('');
  readonly formMenuRuta = signal('');
  readonly formMenuIcono = signal('');
  readonly formMenuPadreId = signal<number | null>(null);
  readonly formMenuOrden = signal<number>(1);
  readonly formMenuEstado = signal(true);

  // Lista de posibles menús padres (donde padre_id es null)
  readonly parentMenusList = signal<any[]>([]);

  // --- TAB 2: MANTENIMIENTO DE ROLES (CRUD) ---
  readonly rolesListAll = signal<any[]>([]);
  readonly editingRolId = signal<number | null>(null);
  readonly filterRolText = signal('');
  readonly formRolCodigo = signal('');
  readonly formRolDescripcion = signal('');
  readonly formRolActivo = signal(true);

  // --- TAB 3: MANTENIMIENTO DE PERMISOS (CRUD) ---
  readonly permissionsListAll = signal<any[]>([]);
  readonly editingPermId = signal<number | null>(null);
  readonly formPermCodigo = signal('');
  readonly formPermNombre = signal('');
  readonly formPermActivo = signal(true);
  readonly filterPermText = signal('');

  // --- TAB 4: ASIGNAR PERMISOS A ROL (MATRIZ) ---
  readonly matrixSelectedRolId = signal<number | null>(null);
  readonly matrixEditMappings = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async cargarDatosIniciales(): Promise<void> {
    try {
      this.loading.set(true);
      
      // Cargar listas completas para CRUDs
      await Promise.all([
        this.cargarMenusAll(),
        this.cargarRolesAll(),
        this.cargarPermissionsAll()
      ]);

      // Auto-seleccionar primer rol activo para la matriz de permisos
      const activeRoles = this.rolesListAll().filter(r => r.activo === true);
      if (activeRoles.length > 0) {
        await this.seleccionarRolMatrix(activeRoles[0].idRol);
      }

    } catch (error) {
      console.error('Error al cargar catálogos:', error);
      this.errorMsg.set('Error de conexión al cargar catálogos.');
    } finally {
      this.loading.set(false);
    }
  }

  // --- LÓGICA TAB 1: MANTENIMIENTO DE MENUS (CRUD) ---
  async cargarMenusAll(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/menus-all`, { headers: this.getAuthHeaders() });
      if (res.ok) {
        const rawMenus = await res.json();
        // Ordenamos jerárquicamente para la visualización en la tabla
        this.menusListAll.set(this.organizarMenusJerarquicos(rawMenus));

        // Filtrar los menús que pueden ser padres (padre_id === null)
        const parents = rawMenus.filter((m: any) => m.padre_id === null);
        this.parentMenusList.set(parents);
      }
    } catch (error) {
      console.error('Error al cargar todos los menús:', error);
    }
  }

  seleccionarMenuParaEditar(m: any): void {
    this.editingMenuId.set(m.id);
    this.formMenuId.set(m.id);
    this.formMenuNombre.set(m.nombre);
    this.formMenuRuta.set(m.ruta);
    this.formMenuIcono.set(m.icono);
    this.formMenuPadreId.set(m.padre_id);
    this.formMenuOrden.set(m.orden);
    this.formMenuEstado.set(m.estado);
    this.errorMsg.set('');
    this.successMsg.set('');
  }

  limpiarMenuForm(): void {
    this.editingMenuId.set(null);
    this.formMenuId.set(null);
    this.formMenuNombre.set('');
    this.formMenuRuta.set('');
    this.formMenuIcono.set('');
    this.formMenuPadreId.set(null);
    this.formMenuOrden.set(1);
    this.formMenuEstado.set(true);
  }

  onPadreIdChange(val: any): void {
    this.formMenuPadreId.set(val && val !== 'null' ? Number(val) : null);
  }

  async guardarMenuForm(): Promise<void> {
    const customId = this.formMenuId();
    const nombre = this.formMenuNombre().trim();
    const ruta = this.formMenuRuta().trim();
    const icono = this.formMenuIcono().trim();
    const padreId = this.formMenuPadreId();
    const orden = this.formMenuOrden();
    const estado = this.formMenuEstado();
    const editingId = this.editingMenuId();

    if (!nombre || !ruta || !icono) {
      this.errorMsg.set('El nombre, ruta e icono son obligatorios.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    try {
      let res;
      if (editingId === null) {
        // Crear nuevo menú
        res = await fetch(`${this.apiBaseUrl}/menus`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ id: customId, nombre, ruta, icono, padre_id: padreId, orden })
        });
      } else {
        // Modificar menú existente
        res = await fetch(`${this.apiBaseUrl}/menus/${editingId}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ nombre, ruta, icono, padre_id: padreId, orden, estado })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar el menú');

      this.successMsg.set(editingId === null ? 'Opción de menú creada exitosamente.' : 'Opción de menú modificada exitosamente.');
      this.limpiarMenuForm();
      
      // Recargar listados y refrescar barra de navegación
      await this.cargarMenusAll();
      await this.navService.loadNavigation();
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error en el servidor.');
    } finally {
      this.loading.set(false);
    }
  }

  async alternarEstadoMenu(m: any): Promise<void> {
    this.loading.set(true);
    try {
      const res = await fetch(`${this.apiBaseUrl}/menus/${m.id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          nombre: m.nombre,
          ruta: m.ruta,
          icono: m.icono,
          padre_id: m.padre_id,
          orden: m.orden,
          estado: !m.estado
        })
      });

      if (res.ok) {
        this.successMsg.set(`Estado de la opción de menú modificado correctamente.`);
        await this.cargarMenusAll();
        await this.navService.loadNavigation();
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  // --- LÓGICA TAB 2: MANTENIMIENTO DE ROLES (CRUD) ---
  async cargarRolesAll(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/roles-all`, { headers: this.getAuthHeaders() });
      if (res.ok) {
        this.rolesListAll.set(await res.json());
      }
    } catch (error) {
      console.error('Error al cargar todos los roles:', error);
    }
  }

  seleccionarRolParaEditar(r: any): void {
    this.editingRolId.set(r.idRol);
    this.formRolCodigo.set(r.codigo);
    this.formRolDescripcion.set(r.descripcion);
    this.formRolActivo.set(r.activo);
    this.errorMsg.set('');
    this.successMsg.set('');
  }

  limpiarRolForm(): void {
    this.editingRolId.set(null);
    this.formRolCodigo.set('');
    this.formRolDescripcion.set('');
    this.formRolActivo.set(true);
  }

  async guardarRolForm(): Promise<void> {
    const codigo = this.formRolCodigo().trim();
    const descripcion = this.formRolDescripcion().trim();
    const activo = this.formRolActivo();
    const editingId = this.editingRolId();

    if (!codigo || !descripcion) {
      this.errorMsg.set('El código y la descripción del rol son obligatorios.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    try {
      let res;
      if (editingId === null) {
        res = await fetch(`${this.apiBaseUrl}/roles`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ codigo, descripcion })
        });
      } else {
        res = await fetch(`${this.apiBaseUrl}/roles/${editingId}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ codigo, descripcion, activo })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar el rol');

      this.successMsg.set(editingId === null ? 'Rol creado exitosamente.' : 'Rol modificado exitosamente.');
      this.limpiarRolForm();
      await this.cargarRolesAll();
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error en el servidor.');
    } finally {
      this.loading.set(false);
    }
  }

  async alternarEstadoRol(r: any): Promise<void> {
    this.loading.set(true);
    try {
      const res = await fetch(`${this.apiBaseUrl}/roles/${r.idRol}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ codigo: r.codigo, descripcion: r.descripcion, activo: !r.activo })
      });

      if (res.ok) {
        this.successMsg.set(`Estado del rol modificado correctamente.`);
        await this.cargarRolesAll();
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  // --- LÓGICA TAB 3: MANTENIMIENTO DE PERMISOS (CRUD) ---
  async cargarPermissionsAll(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/permissions-list-all`, { headers: this.getAuthHeaders() });
      if (res.ok) {
        this.permissionsListAll.set(await res.json());
      }
    } catch (error) {
      console.error('Error al cargar todos los permisos:', error);
    }
  }

  filteredMenusList(): any[] {
    const filter = this.filterMenuText().toLowerCase().trim();
    const list = this.menusListAll();
    if (!filter) return list;
    return list.filter(m => 
      m.id.toString().includes(filter) ||
      (m.nombre && m.nombre.toLowerCase().includes(filter)) ||
      (m.ruta && m.ruta.toLowerCase().includes(filter)) ||
      (m.icono && m.icono.toLowerCase().includes(filter)) ||
      (m.estado ? 'activo' : 'inactivo').includes(filter)
    );
  }

  filteredRolesList(): any[] {
    const filter = this.filterRolText().toLowerCase().trim();
    const list = this.rolesListAll();
    if (!filter) return list;
    return list.filter(r => 
      r.idRol.toString().includes(filter) ||
      (r.codigo && r.codigo.toLowerCase().includes(filter)) ||
      (r.descripcion && r.descripcion.toLowerCase().includes(filter)) ||
      (r.activo ? 'activo' : 'inactivo').includes(filter)
    );
  }

  filteredPermissionsList(): any[] {
    const filter = this.filterPermText().toLowerCase().trim();
    const list = this.permissionsListAll();
    if (!filter) return list;
    return list.filter(p => 
      p.id.toString().includes(filter) ||
      (p.codigo && p.codigo.toLowerCase().includes(filter)) ||
      (p.nombre && p.nombre.toLowerCase().includes(filter)) ||
      (p.activo ? 'activo' : 'inactivo').includes(filter)
    );
  }

  seleccionarPermParaEditar(p: any): void {
    this.editingPermId.set(p.id);
    this.formPermCodigo.set(p.codigo);
    this.formPermNombre.set(p.nombre);
    this.formPermActivo.set(p.activo);
    this.errorMsg.set('');
    this.successMsg.set('');
  }

  limpiarPermForm(): void {
    this.editingPermId.set(null);
    this.formPermCodigo.set('');
    this.formPermNombre.set('');
    this.formPermActivo.set(true);
  }

  async guardarPermForm(): Promise<void> {
    const codigo = this.formPermCodigo().trim();
    const nombre = this.formPermNombre().trim();
    const activo = this.formPermActivo();
    const editingId = this.editingPermId();

    if (!codigo || !nombre) {
      this.errorMsg.set('El código y el nombre del permiso son obligatorios.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    try {
      let res;
      if (editingId === null) {
        res = await fetch(`${this.apiBaseUrl}/permissions-list`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ codigo, nombre })
        });
      } else {
        res = await fetch(`${this.apiBaseUrl}/permissions/${editingId}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ codigo, nombre, activo })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar el permiso');

      this.successMsg.set(editingId === null ? 'Permiso creado exitosamente.' : 'Permiso modificado exitosamente.');
      this.limpiarPermForm();
      await this.cargarPermissionsAll();
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error en el servidor.');
    } finally {
      this.loading.set(false);
    }
  }

  async alternarEstadoPermiso(p: any): Promise<void> {
    this.loading.set(true);
    try {
      const res = await fetch(`${this.apiBaseUrl}/permissions/${p.id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ codigo: p.codigo, nombre: p.nombre, activo: !p.activo })
      });

      if (res.ok) {
        this.successMsg.set(`Estado del permiso modificado correctamente.`);
        await this.cargarPermissionsAll();
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  organizarMenusJerarquicos(menus: any[]): any[] {
    const parents = menus.filter(m => m.padre_id === null).sort((a, b) => a.orden - b.orden);
    const children = menus.filter(m => m.padre_id !== null);

    const result: any[] = [];
    parents.forEach(parent => {
      result.push(parent);
      const submenus = children
        .filter(child => Number(child.padre_id) === Number(parent.id))
        .sort((a, b) => a.orden - b.orden);
      result.push(...submenus);
    });
    return result;
  }

  // --- LÓGICA TAB 4: ASIGNAR PERMISOS A ROL (MATRIZ) ---
  activeMenusList(): any[] {
    return this.menusListAll().filter(m => m.estado === true);
  }

  activePermissionsList(): any[] {
    return this.permissionsListAll().filter(p => p.activo === true);
  }

  activeRolesList(): any[] {
    return this.rolesListAll().filter(r => r.activo === true);
  }

  onRolSelectChange(val: any): void {
    if (val) {
      this.seleccionarRolMatrix(Number(val));
    }
  }

  async seleccionarRolMatrix(rolId: number): Promise<void> {
    this.matrixSelectedRolId.set(rolId);
    this.errorMsg.set('');
    this.successMsg.set('');

    try {
      this.loading.set(true);
      const res = await fetch(`${this.apiBaseUrl}/role-permissions/${rolId}`, {
        headers: this.getAuthHeaders()
      });

      if (res.ok) {
        const mappings = await res.json();
        const localSet = new Set<string>();
        mappings.forEach((m: any) => {
          localSet.add(`${m.menu_id}-${m.permiso_id}`);
        });
        this.matrixEditMappings.set(localSet);
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  isMatrixPermissionChecked(menuId: number, permId: number): boolean {
    return this.matrixEditMappings().has(`${menuId}-${permId}`);
  }

  toggleMatrixPermission(menuId: number, permId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const key = `${menuId}-${permId}`;
    const newSet = new Set(this.matrixEditMappings());
    
    if (checked) {
      newSet.add(key);
    } else {
      newSet.delete(key);
    }
    this.matrixEditMappings.set(newSet);
  }

  async guardarMatrixPermisos(): Promise<void> {
    const rolId = this.matrixSelectedRolId();
    if (!rolId) return;

    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    const mappings: any[] = [];
    this.matrixEditMappings().forEach(key => {
      const [menuId, permId] = key.split('-').map(Number);
      mappings.push({ menuId, permisoId: permId });
    });

    try {
      const res = await fetch(`${this.apiBaseUrl}/role-permissions`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ rolId, mappings })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar la matriz');

      this.successMsg.set('Matriz de permisos guardada exitosamente.');
      await this.navService.loadNavigation();
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error al guardar.');
    } finally {
      this.loading.set(false);
    }
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
    // Si solo se ingresó el nombre del archivo (ej. "suelos.png" o "seguridad.svg")
    if (!cleaned.includes('/')) {
      return `/assets/icons/${cleaned}`;
    }
    // Si se ingresó "assets/nombre.png" sin icons/
    if (cleaned.startsWith('/assets/') && !cleaned.startsWith('/assets/icons/')) {
      return `/assets/icons/${cleaned.substring(8)}`;
    }
    if (cleaned.startsWith('assets/') && !cleaned.startsWith('assets/icons/')) {
      return `/assets/icons/${cleaned.substring(7)}`;
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

  readonly mostrarModalIconos = signal(false);
  readonly iconosProyectoList = signal<Array<{ nombre: string; ruta: string }>>([
    { nombre: 'Suelos', ruta: '/assets/icons/suelos.png' },
    { nombre: 'Legal', ruta: '/assets/icons/legal.png' },
    { nombre: 'Países', ruta: '/assets/icons/paises.png' },
    { nombre: 'Roles', ruta: '/assets/icons/roles.png' },
    { nombre: 'Contabilidad', ruta: '/assets/icons/contabilidad.png' },
    { nombre: 'Tablero', ruta: '/assets/icons/tablero.png' },
    { nombre: 'Geografía', ruta: '/assets/icons/tipo-geografia.png' },
    { nombre: 'Seguridad SVG', ruta: '/assets/icons/seguridad.svg' },
    { nombre: 'Seguridad PNG', ruta: '/assets/icons/seguridad.png' }
  ]);

  async abrirModalIconos(): Promise<void> {
    this.mostrarModalIconos.set(true);
    await this.cargarIconosDinamicos();
  }

  async cargarIconosDinamicos(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/icons-list`, { headers: this.getAuthHeaders() });
      if (res.ok) {
        const icons = await res.json();
        if (Array.isArray(icons) && icons.length > 0) {
          this.iconosProyectoList.set(icons);
        }
      }
    } catch (e) {
      console.error('Error al cargar lista dinámica de íconos:', e);
    }
  }

  cerrarModalIconos(): void {
    this.mostrarModalIconos.set(false);
  }

  seleccionarIconoModal(ruta: string): void {
    this.formMenuIcono.set(ruta);
    this.cerrarModalIconos();
  }

  /**
   * Sube un ícono real (mismo patrón que la foto de perfil): se lee el
   * archivo con FileReader, se convierte a base64 y se guarda directo en
   * el campo del formulario — queda persistido en BD (menus.icono) recién
   * cuando se guarda el menú, igual que el resto de los campos.
   */
  onIconFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      this.errorMsg.set('Solo se permiten imágenes PNG, JPG, WEBP, GIF o SVG.');
      input.value = '';
      return;
    }

    const maxBytes = 300 * 1024; // 300 KB: es un ícono de menú, no una foto
    if (file.size > maxBytes) {
      this.errorMsg.set('El ícono es demasiado grande. El límite es 300 KB.');
      input.value = '';
      return;
    }

    this.errorMsg.set('');
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.formMenuIcono.set(base64);
      this.cerrarModalIconos();
      input.value = '';
    };
    reader.onerror = () => {
      this.errorMsg.set('No se pudo leer el archivo de imagen.');
      input.value = '';
    };
    reader.readAsDataURL(file);
  }
}

