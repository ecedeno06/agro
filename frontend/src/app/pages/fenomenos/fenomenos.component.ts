import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

export interface FenomenoAtmosferico {
  idFenomeno: number;
  nombre: string;
  periodoMeses: string;
  tipoImpacto: string;
  porcentajeMerma: number;
  descripcion: string | null;
  medidasMitigacion: string | null;
  activo: boolean;
  fechaCreacion: string;
}

@Component({
  selector: 'app-fenomenos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fenomenos.component.html',
  styleUrls: ['./fenomenos.component.scss']
})
export class FenomenosComponent implements OnInit {
  private readonly apiBaseUrl = `${environment.apiUrl}/fenomenos`;

  readonly fenomenos = signal<FenomenoAtmosferico[]>([]);
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  // Filtro de búsqueda
  readonly filterText = signal('');

  // Ordenamiento interactivo por columnas
  readonly sortColumn = signal<keyof FenomenoAtmosferico | ''>('idFenomeno');
  readonly sortAsc = signal(true);

  // Lista filtrada y ordenada computable
  readonly filteredFenomenos = computed(() => {
    const term = this.filterText().toLowerCase().trim();
    let list = this.fenomenos();

    if (term) {
      list = list.filter(item => 
        item.nombre.toLowerCase().includes(term) || 
        item.periodoMeses.toLowerCase().includes(term) || 
        item.tipoImpacto.toLowerCase().includes(term) || 
        (item.descripcion && item.descripcion.toLowerCase().includes(term)) ||
        (item.medidasMitigacion && item.medidasMitigacion.toLowerCase().includes(term))
      );
    }

    const col = this.sortColumn();
    if (!col) return list;

    const asc = this.sortAsc();
    return [...list].sort((a, b) => {
      let valA: any = a[col] ?? '';
      let valB: any = b[col] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    });
  });

  // Estado del Formulario
  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);

  // Campos del Formulario
  readonly formNombre = signal('');
  readonly formPeriodoMeses = signal('');
  readonly formTipoImpacto = signal('');
  readonly formPorcentajeMerma = signal<number>(0);
  readonly formDescripcion = signal('');
  readonly formMedidasMitigacion = signal('');
  readonly formActivo = signal(true);

  ngOnInit(): void {
    this.cargarFenomenos();
  }

  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async cargarFenomenos(): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      const res = await fetch(this.apiBaseUrl, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error('Error al cargar la lista de fenómenos atmosféricos.');
      }
      const data = await res.json();
      this.fenomenos.set(data);
    } catch (error: any) {
      console.error(error);
      this.errorMsg.set(error.message || 'Error de conexión con el servidor.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleSort(column: keyof FenomenoAtmosferico): void {
    if (this.sortColumn() === column) {
      this.sortAsc.update(v => !v);
    } else {
      this.sortColumn.set(column);
      this.sortAsc.set(true);
    }
  }

  abrirFormularioCrear(): void {
    this.editingId.set(null);
    this.formNombre.set('');
    this.formPeriodoMeses.set('');
    this.formTipoImpacto.set('');
    this.formPorcentajeMerma.set(0);
    this.formDescripcion.set('');
    this.formMedidasMitigacion.set('');
    this.formActivo.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');
    this.showForm.set(true);
  }

  abrirFormularioEditar(item: FenomenoAtmosferico): void {
    this.editingId.set(item.idFenomeno);
    this.formNombre.set(item.nombre);
    this.formPeriodoMeses.set(item.periodoMeses);
    this.formTipoImpacto.set(item.tipoImpacto);
    this.formPorcentajeMerma.set(Number(item.porcentajeMerma));
    this.formDescripcion.set(item.descripcion || '');
    this.formMedidasMitigacion.set(item.medidasMitigacion || '');
    this.formActivo.set(item.activo);
    this.errorMsg.set('');
    this.successMsg.set('');
    this.showForm.set(true);
  }

  cerrarFormulario(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  async guardarFenomeno(): Promise<void> {
    if (!this.formNombre().trim() || !this.formPeriodoMeses().trim() || !this.formTipoImpacto().trim()) {
      this.errorMsg.set('El nombre, el período de meses y el tipo de impacto son campos obligatorios.');
      return;
    }

    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const body = {
        nombre: this.formNombre().trim(),
        periodoMeses: this.formPeriodoMeses().trim(),
        tipoImpacto: this.formTipoImpacto().trim(),
        porcentajeMerma: this.formPorcentajeMerma(),
        descripcion: this.formDescripcion().trim(),
        medidasMitigacion: this.formMedidasMitigacion().trim(),
        activo: this.formActivo()
      };

      const isEdit = this.editingId() !== null;
      const url = isEdit ? `${this.apiBaseUrl}/${this.editingId()}` : this.apiBaseUrl;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al guardar el fenómeno atmosférico.');
      }

      this.successMsg.set(isEdit ? 'Fenómeno atmosférico modificado exitosamente.' : 'Fenómeno atmosférico registrado exitosamente.');
      this.cerrarFormulario();
      await this.cargarFenomenos();
    } catch (error: any) {
      console.error(error);
      this.errorMsg.set(error.message || 'Error en el servidor.');
    } finally {
      this.loading.set(false);
    }
  }

  async alternarEstado(item: FenomenoAtmosferico): Promise<void> {
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/${item.idFenomeno}/toggle`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al cambiar el estado.');
      }

      this.successMsg.set(data.message);
      await this.cargarFenomenos();
    } catch (error: any) {
      console.error(error);
      this.errorMsg.set(error.message || 'Error al cambiar el estado.');
    } finally {
      this.loading.set(false);
    }
  }

  getMermaClass(merma: number): string {
    if (merma >= 30) return 'merma-alta';
    if (merma >= 15) return 'merma-media';
    return 'merma-baja';
  }
}
