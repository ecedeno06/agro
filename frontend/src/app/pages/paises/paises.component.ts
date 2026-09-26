import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

interface Pais {
  id: number;
  nombre: string;
  codigo_iso2: string;
  codigo_iso3: string;
  nacionalidad: string;
  moneda: string | null;
  idioma_oficial: string | null;
  activo: boolean;
  fecha_creacion: string;
}

interface Provincia {
  id: number;
  pais_id: number;
  codigo_iso: string | null;
  nombre: string;
  nombre_ingles: string;
  tipo: string | null;
}

interface Distrito {
  id: number;
  provincia_id: number;
  codigo_iso: string | null;
  nombre: string;
  tipo: string | null;
}

@Component({
  selector: 'app-paises',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paises.component.html',
  styleUrls: ['./paises.component.scss']
})
export class PaisesComponent implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;

  readonly activeTab = signal<'paises' | 'provincias' | 'distritos'>('paises');

  readonly paises = signal<Pais[]>([]);
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  // Filtro de búsqueda
  readonly filterText = signal('');

  // Lista filtrada computable
  readonly filteredPaises = computed(() => {
    const term = this.filterText().toLowerCase().trim();
    const list = this.paises();
    if (!term) return list;
    return list.filter(item =>
      item.nombre.toLowerCase().includes(term) ||
      item.nacionalidad.toLowerCase().includes(term) ||
      item.codigo_iso2.toLowerCase().includes(term) ||
      item.codigo_iso3.toLowerCase().includes(term) ||
      (item.moneda && item.moneda.toLowerCase().includes(term)) ||
      (item.idioma_oficial && item.idioma_oficial.toLowerCase().includes(term))
    );
  });

  // Formulario
  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);

  // Campos del formulario
  readonly formNombre = signal('');
  readonly formIso2 = signal('');
  readonly formIso3 = signal('');
  readonly formNacionalidad = signal('');
  readonly formMoneda = signal('');
  readonly formIdioma = signal('');
  readonly formActivo = signal(true);

  ngOnInit(): void {
    this.cargarPaises();
  }

  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async cargarPaises(): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/paises`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error('Error al cargar catálogo de países.');
      }
      const data = await res.json();
      this.paises.set(data);
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loading.set(false);
    }
  }

  abrirNuevoForm(): void {
    if (this.showForm() && this.editingId() === null) {
      this.cerrarForm();
      return;
    }
    this.editingId.set(null);
    this.formNombre.set('');
    this.formIso2.set('');
    this.formIso3.set('');
    this.formNacionalidad.set('');
    this.formMoneda.set('');
    this.formIdioma.set('');
    this.formActivo.set(true);
    this.showForm.set(true);
  }

  abrirEditarForm(item: Pais): void {
    if (this.showForm() && this.editingId() === item.id) {
      this.cerrarForm();
      return;
    }
    this.editingId.set(item.id);
    this.formNombre.set(item.nombre);
    this.formIso2.set(item.codigo_iso2);
    this.formIso3.set(item.codigo_iso3);
    this.formNacionalidad.set(item.nacionalidad);
    this.formMoneda.set(item.moneda || '');
    this.formIdioma.set(item.idioma_oficial || '');
    this.formActivo.set(item.activo);
    this.showForm.set(true);
  }

  cerrarForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.errorMsg.set('');
  }

  async guardarPais(): Promise<void> {
    const nombre = this.formNombre().trim();
    const codigo_iso2 = this.formIso2().trim().toUpperCase();
    const codigo_iso3 = this.formIso3().trim().toUpperCase();
    const nacionalidad = this.formNacionalidad().trim();
    const moneda = this.formMoneda().trim();
    const idioma_oficial = this.formIdioma().trim();
    const activo = this.formActivo();

    if (!nombre || !codigo_iso2 || !codigo_iso3 || !nacionalidad) {
      this.errorMsg.set('Nombre, códigos ISO y nacionalidad son obligatorios.');
      return;
    }

    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const id = this.editingId();
      const url = id ? `${this.apiBaseUrl}/paises/${id}` : `${this.apiBaseUrl}/paises`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ nombre, codigo_iso2, codigo_iso3, nacionalidad, moneda, idioma_oficial, activo })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al guardar el país.');
      }

      this.successMsg.set(id ? 'País actualizado exitosamente.' : 'País creado exitosamente.');
      this.cerrarForm();
      await this.cargarPaises();

      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleEstado(item: Pais): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/paises/${item.id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          nombre: item.nombre,
          codigo_iso2: item.codigo_iso2,
          codigo_iso3: item.codigo_iso3,
          nacionalidad: item.nacionalidad,
          moneda: item.moneda,
          idioma_oficial: item.idioma_oficial,
          activo: !item.activo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al actualizar estado.');
      }

      this.successMsg.set('Estado actualizado exitosamente.');
      await this.cargarPaises();

      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loading.set(false);
    }
  }

  // =========================================================
  // PROVINCIAS
  // =========================================================
  readonly paisProvincias = signal<Pais | null>(null);
  readonly provincias = signal<Provincia[]>([]);
  readonly loadingProvincias = signal(false);
  readonly errorProvinciaMsg = signal('');
  readonly successProvinciaMsg = signal('');

  readonly showProvinciaForm = signal(false);
  readonly editingProvinciaId = signal<number | null>(null);
  readonly formProvinciaNombre = signal('');
  readonly formProvinciaNombreIngles = signal('');
  readonly formProvinciaCodigoIso = signal('');
  readonly formProvinciaTipo = signal('provincia');

  // Selector de país para la pestaña "Provincias"
  readonly provinciaTabPaisId = signal<number | null>(null);

  async onProvinciaTabPaisChange(id: number | null): Promise<void> {
    this.provinciaTabPaisId.set(id);
    const pais = id != null ? this.paises().find(p => p.id === id) : undefined;
    if (pais) {
      await this.abrirProvincias(pais);
    } else {
      this.cerrarProvincias();
    }
  }

  async irAProvinciasDe(pais: Pais): Promise<void> {
    this.activeTab.set('provincias');
    this.provinciaTabPaisId.set(pais.id);
    await this.abrirProvincias(pais);
  }

  async abrirProvincias(pais: Pais): Promise<void> {
    if (this.paisProvincias()?.id === pais.id) {
      return;
    }
    this.paisProvincias.set(pais);
    this.cerrarDistritos();
    this.cerrarProvinciaForm();
    await this.cargarProvincias(pais.id);
  }

  cerrarProvincias(): void {
    this.paisProvincias.set(null);
    this.provinciaTabPaisId.set(null);
    this.provincias.set([]);
    this.cerrarDistritos();
    this.cerrarProvinciaForm();
  }

  private async fetchProvinciasPorPais(paisId: number): Promise<Provincia[]> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/provincias?pais_id=${paisId}`, { headers: this.getAuthHeaders() });
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  }

  async cargarProvincias(paisId: number): Promise<void> {
    try {
      this.loadingProvincias.set(true);
      this.errorProvinciaMsg.set('');
      this.provincias.set(await this.fetchProvinciasPorPais(paisId));
    } catch (e: any) {
      this.errorProvinciaMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingProvincias.set(false);
    }
  }

  abrirNuevaProvinciaForm(): void {
    if (this.showProvinciaForm() && this.editingProvinciaId() === null) {
      this.cerrarProvinciaForm();
      return;
    }
    this.editingProvinciaId.set(null);
    this.formProvinciaNombre.set('');
    this.formProvinciaNombreIngles.set('');
    this.formProvinciaCodigoIso.set('');
    this.formProvinciaTipo.set('provincia');
    this.showProvinciaForm.set(true);
  }

  abrirEditarProvinciaForm(item: Provincia): void {
    if (this.showProvinciaForm() && this.editingProvinciaId() === item.id) {
      this.cerrarProvinciaForm();
      return;
    }
    this.editingProvinciaId.set(item.id);
    this.formProvinciaNombre.set(item.nombre);
    this.formProvinciaNombreIngles.set(item.nombre_ingles);
    this.formProvinciaCodigoIso.set(item.codigo_iso || '');
    this.formProvinciaTipo.set(item.tipo || 'provincia');
    this.showProvinciaForm.set(true);
  }

  cerrarProvinciaForm(): void {
    this.showProvinciaForm.set(false);
    this.editingProvinciaId.set(null);
    this.errorProvinciaMsg.set('');
  }

  async guardarProvincia(): Promise<void> {
    const pais = this.paisProvincias();
    if (!pais) return;

    const nombre = this.formProvinciaNombre().trim();
    if (!nombre) {
      this.errorProvinciaMsg.set('El nombre es obligatorio.');
      return;
    }

    try {
      this.loadingProvincias.set(true);
      this.errorProvinciaMsg.set('');
      this.successProvinciaMsg.set('');

      const id = this.editingProvinciaId();
      const url = id ? `${this.apiBaseUrl}/provincias/${id}` : `${this.apiBaseUrl}/provincias`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          pais_id: pais.id,
          nombre,
          nombre_ingles: this.formProvinciaNombreIngles().trim(),
          codigo_iso: this.formProvinciaCodigoIso().trim(),
          tipo: this.formProvinciaTipo().trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar la provincia.');

      this.successProvinciaMsg.set(id ? 'Provincia actualizada exitosamente.' : 'Provincia creada exitosamente.');
      this.cerrarProvinciaForm();
      await this.cargarProvincias(pais.id);

      setTimeout(() => this.successProvinciaMsg.set(''), 3000);
    } catch (e: any) {
      this.errorProvinciaMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingProvincias.set(false);
    }
  }

  async eliminarProvincia(item: Provincia): Promise<void> {
    if (!confirm(`¿Eliminar la provincia "${item.nombre}"?`)) return;

    const pais = this.paisProvincias();
    try {
      this.loadingProvincias.set(true);
      this.errorProvinciaMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/provincias/${item.id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo eliminar la provincia.');
      this.successProvinciaMsg.set('Provincia eliminada.');
      if (pais) await this.cargarProvincias(pais.id);
      setTimeout(() => this.successProvinciaMsg.set(''), 3000);
    } catch (e: any) {
      this.errorProvinciaMsg.set(e.message || 'No se pudo eliminar la provincia.');
    } finally {
      this.loadingProvincias.set(false);
    }
  }

  // =========================================================
  // DISTRITOS
  // =========================================================
  readonly provinciaDistritos = signal<Provincia | null>(null);
  readonly distritos = signal<Distrito[]>([]);
  readonly loadingDistritos = signal(false);
  readonly errorDistritoMsg = signal('');
  readonly successDistritoMsg = signal('');

  readonly showDistritoForm = signal(false);
  readonly editingDistritoId = signal<number | null>(null);
  readonly formDistritoNombre = signal('');
  readonly formDistritoCodigoIso = signal('');
  readonly formDistritoTipo = signal('distrito');

  // Selectores de país -> provincia para la pestaña "Distritos"
  readonly distritoTabPaisId = signal<number | null>(null);
  readonly distritoTabProvincias = signal<Provincia[]>([]);
  readonly loadingDistritoTabProvincias = signal(false);
  readonly distritoTabProvinciaId = signal<number | null>(null);

  async onDistritoTabPaisChange(id: number | null): Promise<void> {
    this.distritoTabPaisId.set(id);
    this.distritoTabProvinciaId.set(null);
    this.cerrarDistritos();
    if (id == null) {
      this.distritoTabProvincias.set([]);
      return;
    }
    this.loadingDistritoTabProvincias.set(true);
    this.distritoTabProvincias.set(await this.fetchProvinciasPorPais(id));
    this.loadingDistritoTabProvincias.set(false);
  }

  async onDistritoTabProvinciaChange(id: number | null): Promise<void> {
    this.distritoTabProvinciaId.set(id);
    const provincia = id != null ? this.distritoTabProvincias().find(p => p.id === id) : undefined;
    if (provincia) {
      await this.abrirDistritos(provincia);
    } else {
      this.cerrarDistritos();
    }
  }

  async irADistritosDe(provincia: Provincia, pais: Pais): Promise<void> {
    this.activeTab.set('distritos');
    this.distritoTabPaisId.set(pais.id);
    this.loadingDistritoTabProvincias.set(true);
    this.distritoTabProvincias.set(await this.fetchProvinciasPorPais(pais.id));
    this.loadingDistritoTabProvincias.set(false);
    this.distritoTabProvinciaId.set(provincia.id);
    await this.abrirDistritos(provincia);
  }

  async abrirDistritos(provincia: Provincia): Promise<void> {
    if (this.provinciaDistritos()?.id === provincia.id) {
      return;
    }
    this.provinciaDistritos.set(provincia);
    this.cerrarDistritoForm();
    await this.cargarDistritos(provincia.id);
  }

  cerrarDistritos(): void {
    this.provinciaDistritos.set(null);
    this.distritos.set([]);
    this.cerrarDistritoForm();
  }

  async cargarDistritos(provinciaId: number): Promise<void> {
    try {
      this.loadingDistritos.set(true);
      this.errorDistritoMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/distritos?provincia_id=${provinciaId}`, { headers: this.getAuthHeaders() });
      if (!res.ok) throw new Error('Error al cargar distritos.');
      this.distritos.set(await res.json());
    } catch (e: any) {
      this.errorDistritoMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingDistritos.set(false);
    }
  }

  abrirNuevoDistritoForm(): void {
    if (this.showDistritoForm() && this.editingDistritoId() === null) {
      this.cerrarDistritoForm();
      return;
    }
    this.editingDistritoId.set(null);
    this.formDistritoNombre.set('');
    this.formDistritoCodigoIso.set('');
    this.formDistritoTipo.set('distrito');
    this.showDistritoForm.set(true);
  }

  abrirEditarDistritoForm(item: Distrito): void {
    if (this.showDistritoForm() && this.editingDistritoId() === item.id) {
      this.cerrarDistritoForm();
      return;
    }
    this.editingDistritoId.set(item.id);
    this.formDistritoNombre.set(item.nombre);
    this.formDistritoCodigoIso.set(item.codigo_iso || '');
    this.formDistritoTipo.set(item.tipo || 'distrito');
    this.showDistritoForm.set(true);
  }

  cerrarDistritoForm(): void {
    this.showDistritoForm.set(false);
    this.editingDistritoId.set(null);
    this.errorDistritoMsg.set('');
  }

  async guardarDistrito(): Promise<void> {
    const provincia = this.provinciaDistritos();
    if (!provincia) return;

    const nombre = this.formDistritoNombre().trim();
    if (!nombre) {
      this.errorDistritoMsg.set('El nombre es obligatorio.');
      return;
    }

    try {
      this.loadingDistritos.set(true);
      this.errorDistritoMsg.set('');
      this.successDistritoMsg.set('');

      const id = this.editingDistritoId();
      const url = id ? `${this.apiBaseUrl}/distritos/${id}` : `${this.apiBaseUrl}/distritos`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          provincia_id: provincia.id,
          nombre,
          codigo_iso: this.formDistritoCodigoIso().trim(),
          tipo: this.formDistritoTipo().trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar el distrito.');

      this.successDistritoMsg.set(id ? 'Distrito actualizado exitosamente.' : 'Distrito creado exitosamente.');
      this.cerrarDistritoForm();
      await this.cargarDistritos(provincia.id);

      setTimeout(() => this.successDistritoMsg.set(''), 3000);
    } catch (e: any) {
      this.errorDistritoMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loadingDistritos.set(false);
    }
  }

  async eliminarDistrito(item: Distrito): Promise<void> {
    if (!confirm(`¿Eliminar el distrito "${item.nombre}"?`)) return;

    const provincia = this.provinciaDistritos();
    try {
      this.loadingDistritos.set(true);
      this.errorDistritoMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/distritos/${item.id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo eliminar el distrito.');
      this.successDistritoMsg.set('Distrito eliminado.');
      if (provincia) await this.cargarDistritos(provincia.id);
      setTimeout(() => this.successDistritoMsg.set(''), 3000);
    } catch (e: any) {
      this.errorDistritoMsg.set(e.message || 'No se pudo eliminar el distrito.');
    } finally {
      this.loadingDistritos.set(false);
    }
  }
}
