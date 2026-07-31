import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

export interface FincaFenomenoItem {
  id: number;
  idFinca: number;
  idFenomeno: number;
  asignacionActiva: boolean;
  nombre: string;
  periodoMeses: string;
  tipoImpacto: string;
  porcentajeMerma: number;
  descripcion: string | null;
  medidasMitigacion: string | null;
  fenomenoCatalogoActivo: boolean;
}

export interface FenomenoOption {
  idFenomeno: number;
  nombre: string;
  periodoMeses: string;
  tipoImpacto: string;
  porcentajeMerma: number;
  activo: boolean;
}

@Component({
  selector: 'app-finca-fenomenos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finca-fenomenos.component.html',
  styleUrls: ['./finca-fenomenos.component.scss']
})
export class FincaFenomenosComponent implements OnInit, OnChanges {
  @Input() idFinca!: number;
  @Input() readOnly: boolean = false;

  private readonly apiBaseUrl = environment.apiUrl;

  readonly fenomenosAsignados = signal<FincaFenomenoItem[]>([]);
  readonly catalogoFenomenos = signal<FenomenoOption[]>([]);
  readonly selectedFenomenoId = signal<number | null>(null);

  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  // Fenómenos disponibles del catálogo no asignados aún a la finca
  readonly fenomenosDisponibles = computed(() => {
    const asignadosIds = new Set(this.fenomenosAsignados().map(item => Number(item.idFenomeno)));
    return this.catalogoFenomenos().filter(item => item.activo && !asignadosIds.has(Number(item.idFenomeno)));
  });

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
        this.cargarFenomenosPorFinca(),
        this.cargarCatalogoFenomenos()
      ]);
    } catch (error: any) {
      console.error('Error al cargar fenómenos de la finca:', error);
      this.errorMsg.set('Error al cargar fenómenos asociados a la finca.');
    } finally {
      this.loading.set(false);
    }
  }

  async cargarFenomenosPorFinca(): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/fincas-fenomenos/finca/${this.idFinca}`, {
      headers: this.getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      this.fenomenosAsignados.set(data);
    }
  }

  async cargarCatalogoFenomenos(): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/fenomenos`, {
      headers: this.getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      this.catalogoFenomenos.set(data);
    }
  }

  async asignarFenomeno(): Promise<void> {
    const idFen = this.selectedFenomenoId();
    if (!idFen || !this.idFinca) {
      this.errorMsg.set('Seleccione un fenómeno atmosférico del catálogo.');
      return;
    }

    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/fincas-fenomenos`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          idFinca: this.idFinca,
          idFenomeno: idFen,
          activo: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al asociar fenómeno.');

      this.successMsg.set('Fenómeno atmosférico asociado a la finca exitosamente.');
      this.selectedFenomenoId.set(null);
      await this.cargarFenomenosPorFinca();
    } catch (error: any) {
      console.error(error);
      this.errorMsg.set(error.message || 'Error al asignar fenómeno.');
    } finally {
      this.loading.set(false);
    }
  }

  async alternarEstado(item: FincaFenomenoItem): Promise<void> {
    if (this.readOnly) return;
    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/fincas-fenomenos/${item.id}/toggle`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al cambiar estado de asignación.');

      this.successMsg.set(data.message);
      await this.cargarFenomenosPorFinca();
    } catch (error: any) {
      console.error(error);
      this.errorMsg.set(error.message || 'Error al cambiar estado.');
    } finally {
      this.loading.set(false);
    }
  }

  async eliminarAsignacion(item: FincaFenomenoItem): Promise<void> {
    if (this.readOnly) return;
    if (!confirm(`¿Está seguro de desasociar el fenómeno "${item.nombre}" de esta finca?`)) return;

    try {
      this.loading.set(true);
      this.errorMsg.set('');
      this.successMsg.set('');

      const res = await fetch(`${this.apiBaseUrl}/fincas-fenomenos/${item.id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al desasociar fenómeno.');

      this.successMsg.set(data.message);
      await this.cargarFenomenosPorFinca();
    } catch (error: any) {
      console.error(error);
      this.errorMsg.set(error.message || 'Error al desasociar fenómeno.');
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
