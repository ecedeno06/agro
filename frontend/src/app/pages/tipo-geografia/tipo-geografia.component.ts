import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

interface TipoGeografia {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: boolean;
  fecha_creacion?: string;
}

@Component({
  selector: 'app-tipo-geografia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tipo-geografia.component.html',
  styleUrls: ['./tipo-geografia.component.scss']
})
export class TipoGeografiaComponent implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;

  readonly tipoGeografias = signal<TipoGeografia[]>([]);
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  // Filtro de búsqueda
  readonly filterText = signal('');

  // Lista filtrada computable
  readonly filteredTipoGeografias = computed(() => {
    const term = this.filterText().toLowerCase().trim();
    const list = this.tipoGeografias();
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
    this.cargarTipoGeografias();
  }

  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async cargarTipoGeografias(): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      const res = await fetch(`${this.apiBaseUrl}/tipo-geografia`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error('Error al cargar tipos de geografía.');
      }
      const data = await res.json();
      this.tipoGeografias.set(data);
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

  abrirEditarForm(item: TipoGeografia): void {
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

  async guardarGeografia(): Promise<void> {
    const nombre = this.formNombre().trim();
    const descripcion = this.formDescripcion().trim();
    const estado = this.formEstado();

    if (!nombre) {
      this.errorMsg.set('El nombre o descripción es obligatorio.');
      return;
    }

    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const id = this.editingId();
      const url = id ? `${this.apiBaseUrl}/tipo-geografia/${id}` : `${this.apiBaseUrl}/tipo-geografia`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ nombre, descripcion: descripcion || nombre, estado })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al guardar el tipo de geografía.');
      }

      this.successMsg.set(id ? 'Tipo de geografía actualizado exitosamente.' : 'Tipo de geografía creado exitosamente.');
      this.cerrarForm();
      await this.cargarTipoGeografias();

      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleEstado(item: TipoGeografia): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/tipo-geografia/${item.id}`, {
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
      await this.cargarTipoGeografias();

      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set(e.message || 'Error de conexión.');
    } finally {
      this.loading.set(false);
    }
  }
}
