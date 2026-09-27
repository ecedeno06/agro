import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';

interface Categoria {
  id: number;
  nombre: string;
  icono: string | null;
  categoria_padre_id: number | null;
  orden: number;
  activo: boolean;
}

interface Producto {
  id: number;
  categoria_id: number;
  unidad_medida_id: number | null;
  nombre: string;
  descripcion: string | null;
  codigo: string | null;
  imagen_url: string | null;
  activo: boolean;
  categoria_nombre?: string;
  unidad_nombre?: string;
  unidad_abrev?: string;
}

interface UnidadMedida {
  id: number;
  nombre: string;
  abrev: string;
}

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos.component.html',
  styleUrls: ['./productos.component.scss']
})
export class ProductosComponent implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;

  /** Si viene por ruta (Granos/Carnes), la página queda fija en esa categoría (sin pestaña de Categorías ni selector). */
  readonly categoriaFiltroNombre = signal<string | null>(null);
  readonly modoRestringido = computed(() => this.categoriaFiltroNombre() !== null);
  readonly tituloPagina = computed(() => this.categoriaFiltroNombre() ? `Catálogo de ${this.categoriaFiltroNombre()}` : 'Catálogo de Productos');

  readonly activeTab = signal<'categorias' | 'productos'>('productos');

  constructor(private readonly activatedRoute: ActivatedRoute) {}

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async ngOnInit(): Promise<void> {
    this.categoriaFiltroNombre.set(this.activatedRoute.snapshot.data['categoriaFiltro'] || null);
    this.unidadesMedida.set([]);
    await Promise.all([this.cargarCategorias(), this.cargarUnidadesMedida()]);

    if (this.modoRestringido()) {
      const cat = this.categoriasHijas().find(
        c => c.nombre.trim().toLowerCase() === (this.categoriaFiltroNombre() || '').trim().toLowerCase()
      );
      if (cat) {
        this.categoriaSeleccionadaId.set(cat.id);
        await this.cargarProductos(cat.id);
      }
    }
  }

  // =========================================================
  // CATEGORÍAS (hijas de la raíz "Productos")
  // =========================================================
  readonly categoriasTodas = signal<Categoria[]>([]);
  readonly categoriaRaizId = signal<number | null>(null);
  readonly categoriasHijas = computed(() => {
    const raizId = this.categoriaRaizId();
    if (!raizId) return [];
    return this.categoriasTodas().filter(c => c.categoria_padre_id === raizId);
  });

  readonly loadingCategorias = signal(false);
  readonly errorCategoriaMsg = signal('');
  readonly successCategoriaMsg = signal('');

  readonly showCategoriaForm = signal(false);
  readonly editingCategoriaId = signal<number | null>(null);
  readonly formCategoriaNombre = signal('');
  readonly formCategoriaIcono = signal('');
  readonly formCategoriaOrden = signal(0);

  async cargarCategorias(): Promise<void> {
    try {
      this.loadingCategorias.set(true);
      this.errorCategoriaMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/categorias-producto`, { headers: this.getAuthHeaders() });
      if (!res.ok) throw new Error('Error al cargar categorías.');
      const data: Categoria[] = await res.json();
      this.categoriasTodas.set(data);
      const raiz = data.find(c => c.categoria_padre_id === null);
      this.categoriaRaizId.set(raiz ? raiz.id : null);
    } catch (e: any) {
      this.errorCategoriaMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingCategorias.set(false);
    }
  }

  abrirNuevaCategoriaForm(): void {
    if (this.showCategoriaForm() && this.editingCategoriaId() === null) {
      this.cerrarCategoriaForm();
      return;
    }
    this.editingCategoriaId.set(null);
    this.formCategoriaNombre.set('');
    this.formCategoriaIcono.set('');
    this.formCategoriaOrden.set((this.categoriasHijas().length + 1) * 1);
    this.showCategoriaForm.set(true);
  }

  abrirEditarCategoriaForm(item: Categoria): void {
    if (this.showCategoriaForm() && this.editingCategoriaId() === item.id) {
      this.cerrarCategoriaForm();
      return;
    }
    this.editingCategoriaId.set(item.id);
    this.formCategoriaNombre.set(item.nombre);
    this.formCategoriaIcono.set(item.icono || '');
    this.formCategoriaOrden.set(item.orden);
    this.showCategoriaForm.set(true);
  }

  cerrarCategoriaForm(): void {
    this.showCategoriaForm.set(false);
    this.editingCategoriaId.set(null);
    this.errorCategoriaMsg.set('');
  }

  async guardarCategoria(): Promise<void> {
    const nombre = this.formCategoriaNombre().trim();
    if (!nombre) {
      this.errorCategoriaMsg.set('El nombre es obligatorio.');
      return;
    }

    try {
      this.loadingCategorias.set(true);
      this.errorCategoriaMsg.set('');
      this.successCategoriaMsg.set('');

      const id = this.editingCategoriaId();
      const url = id ? `${this.apiBaseUrl}/categorias-producto/${id}` : `${this.apiBaseUrl}/categorias-producto`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          nombre,
          icono: this.formCategoriaIcono().trim(),
          orden: this.formCategoriaOrden(),
          categoria_padre_id: this.categoriaRaizId()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar la categoría.');

      this.successCategoriaMsg.set(id ? 'Categoría actualizada exitosamente.' : 'Categoría creada exitosamente.');
      this.cerrarCategoriaForm();
      await this.cargarCategorias();

      setTimeout(() => this.successCategoriaMsg.set(''), 3000);
    } catch (e: any) {
      this.errorCategoriaMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingCategorias.set(false);
    }
  }

  async toggleEstadoCategoria(item: Categoria): Promise<void> {
    try {
      this.loadingCategorias.set(true);
      this.errorCategoriaMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/categorias-producto/${item.id}/toggle`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al actualizar estado.');
      this.successCategoriaMsg.set('Estado actualizado exitosamente.');
      await this.cargarCategorias();
      setTimeout(() => this.successCategoriaMsg.set(''), 3000);
    } catch (e: any) {
      this.errorCategoriaMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingCategorias.set(false);
    }
  }

  // =========================================================
  // PRODUCTOS DEL CATÁLOGO
  // =========================================================
  readonly categoriaSeleccionadaId = signal<number | null>(null);
  readonly productos = signal<Producto[]>([]);
  readonly unidadesMedida = signal<UnidadMedida[]>([]);

  readonly loadingProductos = signal(false);
  readonly errorProductoMsg = signal('');
  readonly successProductoMsg = signal('');
  readonly filterProductos = signal('');

  readonly productosFiltrados = computed(() => {
    const term = this.filterProductos().toLowerCase().trim();
    const list = this.productos();
    if (!term) return list;
    return list.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      (p.codigo || '').toLowerCase().includes(term) ||
      (p.descripcion || '').toLowerCase().includes(term)
    );
  });

  readonly showProductoForm = signal(false);
  readonly editingProductoId = signal<number | null>(null);
  readonly formProductoNombre = signal('');
  readonly formProductoCodigo = signal('');
  readonly formProductoDescripcion = signal('');
  readonly formProductoUnidadId = signal<number | null>(null);
  readonly formProductoImagenUrl = signal('');

  async cargarUnidadesMedida(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/unidades-medida`, { headers: this.getAuthHeaders() });
      if (res.ok) this.unidadesMedida.set(await res.json());
    } catch (e) {
      console.error('Error al cargar unidades de medida:', e);
    }
  }

  async onCategoriaTabChange(id: number | null): Promise<void> {
    this.categoriaSeleccionadaId.set(id);
    this.cerrarProductoForm();
    if (id == null) {
      this.productos.set([]);
      return;
    }
    await this.cargarProductos(id);
  }

  async cargarProductos(categoriaId: number): Promise<void> {
    try {
      this.loadingProductos.set(true);
      this.errorProductoMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/catalogo-productos?categoria_id=${categoriaId}`, { headers: this.getAuthHeaders() });
      if (!res.ok) throw new Error('Error al cargar productos.');
      this.productos.set(await res.json());
    } catch (e: any) {
      this.errorProductoMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingProductos.set(false);
    }
  }

  abrirNuevoProductoForm(): void {
    if (this.showProductoForm() && this.editingProductoId() === null) {
      this.cerrarProductoForm();
      return;
    }
    this.editingProductoId.set(null);
    this.formProductoNombre.set('');
    this.formProductoCodigo.set('');
    this.formProductoDescripcion.set('');
    this.formProductoUnidadId.set(null);
    this.formProductoImagenUrl.set('');
    this.showProductoForm.set(true);
  }

  abrirEditarProductoForm(item: Producto): void {
    if (this.showProductoForm() && this.editingProductoId() === item.id) {
      this.cerrarProductoForm();
      return;
    }
    this.editingProductoId.set(item.id);
    this.formProductoNombre.set(item.nombre);
    this.formProductoCodigo.set(item.codigo || '');
    this.formProductoDescripcion.set(item.descripcion || '');
    this.formProductoUnidadId.set(item.unidad_medida_id);
    this.formProductoImagenUrl.set(item.imagen_url || '');
    this.showProductoForm.set(true);
  }

  cerrarProductoForm(): void {
    this.showProductoForm.set(false);
    this.editingProductoId.set(null);
    this.errorProductoMsg.set('');
  }

  async guardarProducto(): Promise<void> {
    const categoriaId = this.categoriaSeleccionadaId();
    if (!categoriaId) return;

    const nombre = this.formProductoNombre().trim();
    if (!nombre) {
      this.errorProductoMsg.set('El nombre es obligatorio.');
      return;
    }

    try {
      this.loadingProductos.set(true);
      this.errorProductoMsg.set('');
      this.successProductoMsg.set('');

      const id = this.editingProductoId();
      const url = id ? `${this.apiBaseUrl}/catalogo-productos/${id}` : `${this.apiBaseUrl}/catalogo-productos`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          categoria_id: categoriaId,
          unidad_medida_id: this.formProductoUnidadId(),
          nombre,
          descripcion: this.formProductoDescripcion().trim(),
          codigo: this.formProductoCodigo().trim(),
          imagen_url: this.formProductoImagenUrl().trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar el producto.');

      this.successProductoMsg.set(id ? 'Producto actualizado exitosamente.' : 'Producto creado exitosamente.');
      this.cerrarProductoForm();
      await this.cargarProductos(categoriaId);

      setTimeout(() => this.successProductoMsg.set(''), 3000);
    } catch (e: any) {
      this.errorProductoMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingProductos.set(false);
    }
  }

  async toggleEstadoProducto(item: Producto): Promise<void> {
    const categoriaId = this.categoriaSeleccionadaId();
    try {
      this.loadingProductos.set(true);
      this.errorProductoMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/catalogo-productos/${item.id}/toggle`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al actualizar estado.');
      this.successProductoMsg.set('Estado actualizado exitosamente.');
      if (categoriaId) await this.cargarProductos(categoriaId);
      setTimeout(() => this.successProductoMsg.set(''), 3000);
    } catch (e: any) {
      this.errorProductoMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingProductos.set(false);
    }
  }
}
