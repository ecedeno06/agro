import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

interface CategoriaOcupacion {
  id: number;
  codigo: string;
  nombre_es: string;
  nombre_en: string;
  orden: number;
  activo: boolean;
}

interface Ocupacion {
  id: number;
  categoria_id: number;
  codigo: string;
  nombre_es: string;
  nombre_en: string;
  codigo_ciuo: string | null;
  requiere_detalle: boolean;
  orden: number;
  activo: boolean;
}

@Component({
  selector: 'app-ocupaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ocupaciones.component.html',
  styleUrls: ['./ocupaciones.component.scss']
})
export class OcupacionesComponent implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;

  readonly activeTab = signal<'categorias' | 'ocupaciones'>('categorias');

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  ngOnInit(): void {
    this.cargarCategorias();
  }

  // =========================================================
  // CATEGORÍAS
  // =========================================================
  readonly categorias = signal<CategoriaOcupacion[]>([]);
  readonly loadingCategorias = signal(false);
  readonly errorCategoriaMsg = signal('');
  readonly successCategoriaMsg = signal('');
  readonly filterCategorias = signal('');

  readonly categoriasFiltradas = computed(() => {
    const term = this.filterCategorias().toLowerCase().trim();
    const list = this.categorias();
    if (!term) return list;
    return list.filter(c =>
      c.codigo.toLowerCase().includes(term) ||
      c.nombre_es.toLowerCase().includes(term) ||
      c.nombre_en.toLowerCase().includes(term)
    );
  });

  readonly showCategoriaForm = signal(false);
  readonly editingCategoriaId = signal<number | null>(null);
  readonly formCategoriaCodigo = signal('');
  readonly formCategoriaNombreEs = signal('');
  readonly formCategoriaNombreEn = signal('');
  readonly formCategoriaOrden = signal(0);

  async cargarCategorias(): Promise<void> {
    try {
      this.loadingCategorias.set(true);
      this.errorCategoriaMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/categorias-ocupacion`, { headers: this.getAuthHeaders() });
      if (!res.ok) throw new Error('Error al cargar categorías.');
      this.categorias.set(await res.json());
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
    this.formCategoriaCodigo.set('');
    this.formCategoriaNombreEs.set('');
    this.formCategoriaNombreEn.set('');
    this.formCategoriaOrden.set((this.categorias().length + 1) * 1);
    this.showCategoriaForm.set(true);
  }

  abrirEditarCategoriaForm(item: CategoriaOcupacion): void {
    if (this.showCategoriaForm() && this.editingCategoriaId() === item.id) {
      this.cerrarCategoriaForm();
      return;
    }
    this.editingCategoriaId.set(item.id);
    this.formCategoriaCodigo.set(item.codigo);
    this.formCategoriaNombreEs.set(item.nombre_es);
    this.formCategoriaNombreEn.set(item.nombre_en);
    this.formCategoriaOrden.set(item.orden);
    this.showCategoriaForm.set(true);
  }

  cerrarCategoriaForm(): void {
    this.showCategoriaForm.set(false);
    this.editingCategoriaId.set(null);
    this.errorCategoriaMsg.set('');
  }

  async guardarCategoria(): Promise<void> {
    const codigo = this.formCategoriaCodigo().trim();
    const nombreEs = this.formCategoriaNombreEs().trim();
    const nombreEn = this.formCategoriaNombreEn().trim();
    if (!codigo || !nombreEs || !nombreEn) {
      this.errorCategoriaMsg.set('Código, nombre en español e inglés son obligatorios.');
      return;
    }

    try {
      this.loadingCategorias.set(true);
      this.errorCategoriaMsg.set('');
      this.successCategoriaMsg.set('');

      const id = this.editingCategoriaId();
      const url = id ? `${this.apiBaseUrl}/categorias-ocupacion/${id}` : `${this.apiBaseUrl}/categorias-ocupacion`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          codigo,
          nombre_es: nombreEs,
          nombre_en: nombreEn,
          orden: this.formCategoriaOrden()
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

  async toggleEstadoCategoria(item: CategoriaOcupacion): Promise<void> {
    try {
      this.loadingCategorias.set(true);
      this.errorCategoriaMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/categorias-ocupacion/${item.id}/toggle`, {
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
  // OCUPACIONES
  // =========================================================
  readonly categoriaTabId = signal<number | null>(null);
  readonly ocupaciones = signal<Ocupacion[]>([]);
  readonly loadingOcupaciones = signal(false);
  readonly errorOcupacionMsg = signal('');
  readonly successOcupacionMsg = signal('');

  readonly showOcupacionForm = signal(false);
  readonly editingOcupacionId = signal<number | null>(null);
  readonly formOcupacionCodigo = signal('');
  readonly formOcupacionNombreEs = signal('');
  readonly formOcupacionNombreEn = signal('');
  readonly formOcupacionCiuo = signal('');
  readonly formOcupacionRequiereDetalle = signal(false);
  readonly formOcupacionOrden = signal(0);

  async onCategoriaTabChange(id: number | null): Promise<void> {
    this.categoriaTabId.set(id);
    this.cerrarOcupacionForm();
    if (id == null) {
      this.ocupaciones.set([]);
      return;
    }
    await this.cargarOcupaciones(id);
  }

  async cargarOcupaciones(categoriaId: number): Promise<void> {
    try {
      this.loadingOcupaciones.set(true);
      this.errorOcupacionMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/ocupaciones?categoria_id=${categoriaId}`, { headers: this.getAuthHeaders() });
      if (!res.ok) throw new Error('Error al cargar ocupaciones.');
      this.ocupaciones.set(await res.json());
    } catch (e: any) {
      this.errorOcupacionMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingOcupaciones.set(false);
    }
  }

  abrirNuevaOcupacionForm(): void {
    if (this.showOcupacionForm() && this.editingOcupacionId() === null) {
      this.cerrarOcupacionForm();
      return;
    }
    this.editingOcupacionId.set(null);
    this.formOcupacionCodigo.set('');
    this.formOcupacionNombreEs.set('');
    this.formOcupacionNombreEn.set('');
    this.formOcupacionCiuo.set('');
    this.formOcupacionRequiereDetalle.set(false);
    this.formOcupacionOrden.set((this.ocupaciones().length + 1) * 1);
    this.showOcupacionForm.set(true);
  }

  abrirEditarOcupacionForm(item: Ocupacion): void {
    if (this.showOcupacionForm() && this.editingOcupacionId() === item.id) {
      this.cerrarOcupacionForm();
      return;
    }
    this.editingOcupacionId.set(item.id);
    this.formOcupacionCodigo.set(item.codigo);
    this.formOcupacionNombreEs.set(item.nombre_es);
    this.formOcupacionNombreEn.set(item.nombre_en);
    this.formOcupacionCiuo.set(item.codigo_ciuo || '');
    this.formOcupacionRequiereDetalle.set(item.requiere_detalle);
    this.formOcupacionOrden.set(item.orden);
    this.showOcupacionForm.set(true);
  }

  cerrarOcupacionForm(): void {
    this.showOcupacionForm.set(false);
    this.editingOcupacionId.set(null);
    this.errorOcupacionMsg.set('');
  }

  async guardarOcupacion(): Promise<void> {
    const categoriaId = this.categoriaTabId();
    if (!categoriaId) return;

    const codigo = this.formOcupacionCodigo().trim();
    const nombreEs = this.formOcupacionNombreEs().trim();
    const nombreEn = this.formOcupacionNombreEn().trim();
    if (!codigo || !nombreEs || !nombreEn) {
      this.errorOcupacionMsg.set('Código, nombre en español e inglés son obligatorios.');
      return;
    }

    try {
      this.loadingOcupaciones.set(true);
      this.errorOcupacionMsg.set('');
      this.successOcupacionMsg.set('');

      const id = this.editingOcupacionId();
      const url = id ? `${this.apiBaseUrl}/ocupaciones/${id}` : `${this.apiBaseUrl}/ocupaciones`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          categoria_id: categoriaId,
          codigo,
          nombre_es: nombreEs,
          nombre_en: nombreEn,
          codigo_ciuo: this.formOcupacionCiuo().trim(),
          requiere_detalle: this.formOcupacionRequiereDetalle(),
          orden: this.formOcupacionOrden()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar la ocupación.');

      this.successOcupacionMsg.set(id ? 'Ocupación actualizada exitosamente.' : 'Ocupación creada exitosamente.');
      this.cerrarOcupacionForm();
      await this.cargarOcupaciones(categoriaId);

      setTimeout(() => this.successOcupacionMsg.set(''), 3000);
    } catch (e: any) {
      this.errorOcupacionMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingOcupaciones.set(false);
    }
  }

  async toggleEstadoOcupacion(item: Ocupacion): Promise<void> {
    const categoriaId = this.categoriaTabId();
    try {
      this.loadingOcupaciones.set(true);
      this.errorOcupacionMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/ocupaciones/${item.id}/toggle`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al actualizar estado.');
      this.successOcupacionMsg.set('Estado actualizado exitosamente.');
      if (categoriaId) await this.cargarOcupaciones(categoriaId);
      setTimeout(() => this.successOcupacionMsg.set(''), 3000);
    } catch (e: any) {
      this.errorOcupacionMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingOcupaciones.set(false);
    }
  }
}
