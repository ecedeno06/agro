import { Component, Input, OnInit, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

export interface ProductoPecuario {
  id?: number;
  id_finca: number;
  especie: string;
  raza?: string;
  cantidad: number;
  unidad?: string;
  proposito?: string;         // carne, leche, doble propósito, etc.
  observaciones?: string;
  activo: boolean;
}

export interface ProductoAgricola {
  id?: number;
  id_finca: number;
  cultivo: string;
  variedad?: string;
  area_sembrada?: number;     // en hectáreas
  fecha_siembra?: string;
  fecha_cosecha_estimada?: string;
  rendimiento_estimado?: number;
  unidad_rendimiento?: string; // qq, kg, tonelada, etc.
  sistema_riego?: string;
  observaciones?: string;
  activo: boolean;
}

@Component({
  selector: 'app-tipo-produccion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tipo-produccion.component.html',
  styleUrls: ['./tipo-produccion.component.scss']
})
export class TipoProduccionComponent implements OnInit, OnChanges {
  @Input() idFinca!: number;
  @Input() readOnly: boolean = false;

  private readonly apiBaseUrl = environment.apiUrl;

  readonly activeTab = signal<'pecuaria' | 'agricola'>('pecuaria');

  // ── Pecuaria ──────────────────────────────────────────
  readonly productosPecuarios = signal<ProductoPecuario[]>([]);
  readonly loadingPecuaria    = signal(false);
  readonly errorPecuaria      = signal('');
  readonly successPecuaria    = signal('');
  readonly showFormPecuaria   = signal(false);
  readonly savingPecuaria     = signal(false);

  nuevoPecuario: ProductoPecuario = this.defaultPecuario();

  readonly especiesComunes = [
    'Bovino (Res)', 'Porcino (Cerdo)', 'Aviar (Gallinas/Pollos)', 'Caprino (Cabra)',
    'Ovino (Oveja)', 'Equino (Caballo/Mula)', 'Cunícola (Conejo)', 'Peces (Acuicultura)', 'Otro'
  ];

  readonly propositosComunes = ['Carne', 'Leche', 'Doble propósito', 'Reproducción', 'Trabajo', 'Comercial'];

  // ── Agrícola ──────────────────────────────────────────
  readonly productosAgricolas = signal<ProductoAgricola[]>([]);
  readonly loadingAgricola    = signal(false);
  readonly errorAgricola      = signal('');
  readonly successAgricola    = signal('');
  readonly showFormAgricola   = signal(false);
  readonly savingAgricola     = signal(false);

  nuevoAgricola: ProductoAgricola = this.defaultAgricola();

  readonly cultivosComunes = [
    'Maíz', 'Arroz', 'Frijoles', 'Tomate', 'Pepino', 'Plátano', 'Ñame', 'Otoe',
    'Yuca', 'Café', 'Caña de Azúcar', 'Sandia', 'Melón', 'Naranja', 'Limón', 'Aguacate', 'Otro'
  ];

  readonly sistemasRiego = ['Sin riego (secano)', 'Riego por goteo', 'Riego por aspersión', 'Riego por inundación', 'Riego por surcos'];

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['idFinca'] && !changes['idFinca'].firstChange) {
      this.cargarDatos();
    }
  }

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('agro_session_token');
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  }

  async cargarDatos(): Promise<void> {
    if (!this.idFinca) return;
    await Promise.all([this.cargarPecuarios(), this.cargarAgricolas()]);
  }

  // ── Pecuaria CRUD ─────────────────────────────────────

  async cargarPecuarios(): Promise<void> {
    this.loadingPecuaria.set(true);
    this.errorPecuaria.set('');
    try {
      const res = await fetch(`${this.apiBaseUrl}/produccion-pecuaria/finca/${this.idFinca}`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        this.productosPecuarios.set(data);
      } else if (res.status !== 404) {
        this.errorPecuaria.set('Error al cargar producción pecuaria.');
      }
    } catch {
      this.errorPecuaria.set('Sin conexión con el servidor.');
    } finally {
      this.loadingPecuaria.set(false);
    }
  }

  async guardarPecuario(): Promise<void> {
    if (!this.nuevoPecuario.especie || !this.nuevoPecuario.cantidad) {
      this.errorPecuaria.set('Especie y cantidad son obligatorios.');
      return;
    }
    this.savingPecuaria.set(true);
    this.errorPecuaria.set('');
    this.successPecuaria.set('');
    try {
      const payload = { ...this.nuevoPecuario, id_finca: this.idFinca };
      const isEdit = !!payload.id;
      const url    = isEdit ? `${this.apiBaseUrl}/produccion-pecuaria/${payload.id}` : `${this.apiBaseUrl}/produccion-pecuaria`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers: this.getHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar.');

      this.successPecuaria.set(isEdit ? 'Registro actualizado exitosamente.' : 'Registro agregado exitosamente.');
      this.nuevoPecuario = this.defaultPecuario();
      this.showFormPecuaria.set(false);
      await this.cargarPecuarios();
    } catch (err: any) {
      this.errorPecuaria.set(err.message || 'Error al guardar.');
    } finally {
      this.savingPecuaria.set(false);
    }
  }

  editarPecuario(item: ProductoPecuario): void {
    this.nuevoPecuario = { ...item };
    this.showFormPecuaria.set(true);
  }

  async eliminarPecuario(item: ProductoPecuario): Promise<void> {
    if (!confirm(`¿Eliminar el registro de "${item.especie}"?`)) return;
    try {
      const res = await fetch(`${this.apiBaseUrl}/produccion-pecuaria/${item.id}`, { method: 'DELETE', headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al eliminar.');
      this.successPecuaria.set('Registro eliminado.');
      await this.cargarPecuarios();
    } catch (err: any) {
      this.errorPecuaria.set(err.message || 'Error al eliminar.');
    }
  }

  cancelarPecuario(): void {
    this.nuevoPecuario = this.defaultPecuario();
    this.showFormPecuaria.set(false);
    this.errorPecuaria.set('');
  }

  private defaultPecuario(): ProductoPecuario {
    return { id_finca: this.idFinca || 0, especie: '', raza: '', cantidad: 0, unidad: 'cabezas', proposito: '', observaciones: '', activo: true };
  }

  // ── Agrícola CRUD ─────────────────────────────────────

  async cargarAgricolas(): Promise<void> {
    this.loadingAgricola.set(true);
    this.errorAgricola.set('');
    try {
      const res = await fetch(`${this.apiBaseUrl}/produccion-agricola/finca/${this.idFinca}`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        this.productosAgricolas.set(data);
      } else if (res.status !== 404) {
        this.errorAgricola.set('Error al cargar producción agrícola.');
      }
    } catch {
      this.errorAgricola.set('Sin conexión con el servidor.');
    } finally {
      this.loadingAgricola.set(false);
    }
  }

  async guardarAgricola(): Promise<void> {
    if (!this.nuevoAgricola.cultivo) {
      this.errorAgricola.set('El cultivo es obligatorio.');
      return;
    }
    this.savingAgricola.set(true);
    this.errorAgricola.set('');
    this.successAgricola.set('');
    try {
      const payload = { ...this.nuevoAgricola, id_finca: this.idFinca };
      const isEdit  = !!payload.id;
      const url     = isEdit ? `${this.apiBaseUrl}/produccion-agricola/${payload.id}` : `${this.apiBaseUrl}/produccion-agricola`;
      const method  = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers: this.getHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar.');

      this.successAgricola.set(isEdit ? 'Cultivo actualizado exitosamente.' : 'Cultivo registrado exitosamente.');
      this.nuevoAgricola = this.defaultAgricola();
      this.showFormAgricola.set(false);
      await this.cargarAgricolas();
    } catch (err: any) {
      this.errorAgricola.set(err.message || 'Error al guardar.');
    } finally {
      this.savingAgricola.set(false);
    }
  }

  editarAgricola(item: ProductoAgricola): void {
    this.nuevoAgricola = { ...item };
    this.showFormAgricola.set(true);
  }

  async eliminarAgricola(item: ProductoAgricola): Promise<void> {
    if (!confirm(`¿Eliminar el cultivo "${item.cultivo}"?`)) return;
    try {
      const res = await fetch(`${this.apiBaseUrl}/produccion-agricola/${item.id}`, { method: 'DELETE', headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al eliminar.');
      this.successAgricola.set('Cultivo eliminado.');
      await this.cargarAgricolas();
    } catch (err: any) {
      this.errorAgricola.set(err.message || 'Error al eliminar.');
    }
  }

  cancelarAgricola(): void {
    this.nuevoAgricola = this.defaultAgricola();
    this.showFormAgricola.set(false);
    this.errorAgricola.set('');
  }

  private defaultAgricola(): ProductoAgricola {
    return { id_finca: this.idFinca || 0, cultivo: '', variedad: '', area_sembrada: undefined, fecha_siembra: '', fecha_cosecha_estimada: '', rendimiento_estimado: undefined, unidad_rendimiento: 'qq', sistema_riego: '', observaciones: '', activo: true };
  }
}
