import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

export interface FincaProductoItem {
  id: number;
  finca_id: number;
  categoria_producto: number | null;
  subproducto_id: number | null;
  producto_id: number | null;
  area_produccion: number | null;
  desde: string | null;
  hasta: string | null;
  precio: number;
  stock: number;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
  nombre_categoria?: string;
  icono_categoria?: string;
  nombre_subproducto?: string;
  codigo_subproducto?: string;
}

export interface CategoriaOption {
  id: number;
  nombre: string;
  icono: string | null;
  categoria_padre_id: number | null;
  activo: boolean;
}

export interface SubproductoOption {
  id: number;
  nombre: string;
  codigo: string | null;
}

@Component({
  selector: 'app-finca-produccion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finca-produccion.component.html',
  styleUrls: ['./finca-produccion.component.scss']
})
export class FincaProduccionComponent implements OnInit, OnChanges {
  @Input() idFinca!: number;
  @Input() readOnly: boolean = false;

  private readonly apiBaseUrl = environment.apiUrl;

  readonly producciones = signal<FincaProductoItem[]>([]);
  readonly categorias = signal<CategoriaOption[]>([]);
  readonly subproductos = signal<SubproductoOption[]>([]);

  readonly loading = signal(false);
  readonly loadingSubproductos = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  // Formulario
  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);

  readonly formCategoriaId = signal<number | null>(null);
  readonly formSubproductoId = signal<number | null>(null);
  readonly formAreaProduccion = signal<number | null>(null);
  readonly formDesde = signal<string>('');
  readonly formHasta = signal<string>('');
  readonly formActivo = signal<boolean>(true);

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['idFinca'] && !changes['idFinca'].firstChange) {
      this.cargarDatos();
    }
  }

  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async cargarDatos(): Promise<void> {
    if (!this.idFinca) return;
    try {
      this.loading.set(true);
      this.errorMsg.set('');

      await Promise.all([
        this.cargarProduccionesDeFinca(),
        this.cargarCategorias()
      ]);
    } catch (error: any) {
      console.error('Error al cargar datos de producción de la finca:', error);
      this.errorMsg.set('Error de conexión al cargar producciones de la finca.');
    } finally {
      this.loading.set(false);
    }
  }

  async cargarProduccionesDeFinca(): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/fincas-productos?finca_id=${this.idFinca}`, {
      headers: this.getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      this.producciones.set(data);
    }
  }

  async cargarCategorias(): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/categorias-producto`, {
      headers: this.getAuthHeaders()
    });
    if (res.ok) {
      const data: CategoriaOption[] = await res.json();
      // Filtrar subcategorías (hijas de la raíz Productos)
      const raiz = data.find(c => c.categoria_padre_id === null);
      const hijas = data.filter(c => c.activo && (raiz ? c.categoria_padre_id === raiz.id : c.categoria_padre_id != null));
      this.categorias.set(hijas);
    }
  }

  async onCategoriaChange(catId: number | null): Promise<void> {
    this.formCategoriaId.set(catId ? Number(catId) : null);
    this.formSubproductoId.set(null);
    this.subproductos.set([]);

    if (!catId) return;

    try {
      this.loadingSubproductos.set(true);
      const res = await fetch(`${this.apiBaseUrl}/catalogo-productos/referencia?categoria_id=${catId}`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        this.subproductos.set(data);
      }
    } catch (err) {
      console.error('Error al cargar subproductos de categoría:', err);
    } finally {
      this.loadingSubproductos.set(false);
    }
  }

  abrirNuevoForm(): void {
    this.editingId.set(null);
    this.formCategoriaId.set(null);
    this.formSubproductoId.set(null);
    this.formAreaProduccion.set(null);
    this.formDesde.set('');
    this.formHasta.set('');
    this.formActivo.set(true);
    this.subproductos.set([]);
    this.errorMsg.set('');
    this.showForm.set(true);
  }

  async abrirEditarForm(item: FincaProductoItem): Promise<void> {
    this.editingId.set(item.id);
    this.formAreaProduccion.set(item.area_produccion);
    this.formDesde.set(item.desde ? item.desde.substring(0, 10) : '');
    this.formHasta.set(item.hasta ? item.hasta.substring(0, 10) : '');
    this.formActivo.set(item.activo);
    this.errorMsg.set('');

    const catId = item.categoria_producto ? Number(item.categoria_producto) : null;
    await this.onCategoriaChange(catId);
    this.formSubproductoId.set(item.subproducto_id || item.producto_id || null);
    this.showForm.set(true);
  }

  cerrarForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.errorMsg.set('');
  }

  async guardarProduccion(): Promise<void> {
    if (this.readOnly) return;

    const catId = this.formCategoriaId();
    const subId = this.formSubproductoId();

    if (!catId && !subId) {
      this.errorMsg.set('Debe seleccionar al menos el Tipo de Producción o Subcategoría.');
      return;
    }

    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const editId = this.editingId();
      const method = editId ? 'PUT' : 'POST';
      const url = editId ? `${this.apiBaseUrl}/fincas-productos/${editId}` : `${this.apiBaseUrl}/fincas-productos`;

      const body = {
        finca_id: this.idFinca,
        categoria_producto: catId,
        subproducto_id: subId,
        area_produccion: this.formAreaProduccion(),
        desde: this.formDesde() || null,
        hasta: this.formHasta() || null,
        activo: this.formActivo()
      };

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar producción.');

      this.successMsg.set(editId ? 'Producción actualizada exitosamente.' : 'Producción agregada exitosamente.');
      this.cerrarForm();
      await this.cargarProduccionesDeFinca();
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (error: any) {
      console.error(error);
      this.errorMsg.set(error.message || 'Error al guardar registro de producción.');
    } finally {
      this.loading.set(false);
    }
  }

  async alternarEstado(item: FincaProductoItem): Promise<void> {
    if (this.readOnly) return;
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/fincas-productos/${item.id}/toggle`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al cambiar estado.');

      this.successMsg.set(data.message);
      await this.cargarProduccionesDeFinca();
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (error: any) {
      console.error(error);
      this.errorMsg.set(error.message || 'Error al cambiar estado.');
    } finally {
      this.loading.set(false);
    }
  }

  async eliminarProduccion(item: FincaProductoItem): Promise<void> {
    if (this.readOnly) return;
    const nombre = item.nombre_subproducto || item.nombre_categoria || 'este registro';
    if (!confirm(`¿Está seguro de eliminar la producción de "${nombre}" de esta finca?`)) return;

    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/fincas-productos/${item.id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al eliminar producción.');

      this.successMsg.set(data.message);
      await this.cargarProduccionesDeFinca();
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (error: any) {
      console.error(error);
      this.errorMsg.set(error.message || 'Error al eliminar producción.');
    } finally {
      this.loading.set(false);
    }
  }
}
