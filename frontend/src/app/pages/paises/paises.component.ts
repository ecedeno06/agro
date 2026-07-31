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

@Component({
  selector: 'app-paises',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paises.component.html',
  styleUrls: ['./paises.component.scss']
})
export class PaisesComponent implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;

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
}
