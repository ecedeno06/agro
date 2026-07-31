import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

interface TipoSuelo {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: boolean;
  fecha_creacion: string;
}

@Component({
  selector: 'app-tipo-suelos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tipo-suelos.component.html',
  styleUrls: ['./tipo-suelos.component.scss']
})
export class TipoSuelosComponent implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;

  readonly tipoSuelos = signal<TipoSuelo[]>([]);
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  // Filtro de búsqueda
  readonly filterText = signal('');

  // Lista filtrada computable
  readonly filteredTipoSuelos = computed(() => {
    const term = this.filterText().toLowerCase().trim();
    const list = this.tipoSuelos();
    if (!term) return list;
    return list.filter(item => 
      item.nombre.toLowerCase().includes(term) || 
      (item.descripcion && item.descripcion.toLowerCase().includes(term))
    );
  });

  // Formulario
  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);

  // Campos del formulario
  readonly formNombre = signal('');
  readonly formDescripcion = signal('');
  readonly formEstado = signal(true);

  ngOnInit(): void {
    this.cargarTipoSuelos();
  }

  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async cargarTipoSuelos(): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/tipo-suelos`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error('Error al cargar tipos de suelos.');
      }
      const data = await res.json();
      this.tipoSuelos.set(data);
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
    this.formDescripcion.set('');
    this.formEstado.set(true);
    this.showForm.set(true);
  }

  abrirEditarForm(item: TipoSuelo): void {
    if (this.showForm() && this.editingId() === item.id) {
      this.cerrarForm();
      return;
    }
    this.editingId.set(item.id);
    this.formNombre.set(item.nombre);
    this.formDescripcion.set(item.descripcion || '');
    this.formEstado.set(item.estado);
    this.showForm.set(true);
  }

  cerrarForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.errorMsg.set('');
  }

  async guardarSuelo(): Promise<void> {
    const nombre = this.formNombre().trim();
    const descripcion = this.formDescripcion().trim();
    const estado = this.formEstado();

    if (!nombre) {
      this.errorMsg.set('El nombre es obligatorio.');
      return;
    }

    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const id = this.editingId();
      const url = id ? `${this.apiBaseUrl}/tipo-suelos/${id}` : `${this.apiBaseUrl}/tipo-suelos`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ nombre, descripcion, estado })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al guardar el tipo de suelo.');
      }

      this.successMsg.set(id ? 'Tipo de suelo actualizado exitosamente.' : 'Tipo de suelo creado exitosamente.');
      this.cerrarForm();
      await this.cargarTipoSuelos();

      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleEstado(item: TipoSuelo): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/tipo-suelos/${item.id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          nombre: item.nombre,
          descripcion: item.descripcion,
          estado: !item.estado
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al actualizar estado.');
      }

      this.successMsg.set('Estado actualizado exitosamente.');
      await this.cargarTipoSuelos();

      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loading.set(false);
    }
  }
}
