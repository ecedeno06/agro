import { AfterViewInit, Component, OnInit, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

type FincaMapa = {
  id_finca: number;
  nombre_finca: string;
  nombre_propietario?: string;
  tamano: number;
  estado?: string;
  id_tipo_produccion?: number | null;
  nombre_tipo_produccion?: string;
  mapa_latitud?: number | null;
  mapa_logitud?: number | null;
};

type Criterio = 'ninguno' | 'asociado' | 'tipo_produccion' | 'tamano';

@Component({
  selector: 'app-mapa-fincas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-fincas.component.html',
  styleUrls: ['./mapa-fincas.component.scss']
})
export class MapaFincasComponent implements OnInit, AfterViewInit {
  private readonly apiBaseUrl = environment.apiUrl;
  private map: L.Map | null = null;
  private markers: L.CircleMarker[] = [];
  private vistaInicializada = false;

  fincas = signal<FincaMapa[]>([]);
  loading = signal(false);
  errorMsg = signal('');

  criterio = signal<Criterio>('ninguno');
  valorAsociado = signal('');
  valorTipoProduccion = signal('');
  tamanoMin = signal<number | null>(null);
  tamanoMax = signal<number | null>(null);

  asociadosDisponibles = computed(() => {
    const nombres = this.fincas()
      .map(f => f.nombre_propietario)
      .filter((n): n is string => !!n && n.trim().length > 0);
    return Array.from(new Set(nombres)).sort((a, b) => a.localeCompare(b));
  });

  tiposProduccionDisponibles = computed(() => {
    const nombres = this.fincas()
      .map(f => f.nombre_tipo_produccion)
      .filter((n): n is string => !!n && n.trim().length > 0);
    return Array.from(new Set(nombres)).sort((a, b) => a.localeCompare(b));
  });

  fincasFiltradas = computed(() => {
    const list = this.fincas();
    const criterio = this.criterio();

    if (criterio === 'asociado') {
      const valor = this.valorAsociado();
      if (!valor) return list;
      return list.filter(f => f.nombre_propietario === valor);
    }

    if (criterio === 'tipo_produccion') {
      const valor = this.valorTipoProduccion();
      if (!valor) return list;
      return list.filter(f => f.nombre_tipo_produccion === valor);
    }

    if (criterio === 'tamano') {
      const min = this.tamanoMin();
      const max = this.tamanoMax();
      return list.filter(f => {
        const t = Number(f.tamano);
        if (min != null && t < min) return false;
        if (max != null && t > max) return false;
        return true;
      });
    }

    return list;
  });

  fincasConUbicacion = computed(() =>
    this.fincasFiltradas().filter(f => f.mapa_latitud != null && f.mapa_logitud != null)
  );

  constructor() {
    effect(() => {
      const puntos = this.fincasConUbicacion();
      if (this.vistaInicializada) {
        this.dibujarMarcadores(puntos);
      }
    });
  }

  ngOnInit(): void {
    this.cargarFincas();
  }

  ngAfterViewInit(): void {
    this.map = L.map('mapa-fincas-container').setView([8.5, -80.5], 7);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.vistaInicializada = true;
    this.dibujarMarcadores(this.fincasConUbicacion());
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async cargarFincas(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const res = await fetch(`${this.apiBaseUrl}/fincas`, { headers: this.getAuthHeaders() });
      if (!res.ok) throw new Error('Error al cargar las fincas.');
      const data = await res.json();

      const normalizadas: FincaMapa[] = Array.isArray(data) ? data.map((f: any) => ({
        id_finca: Number(f.id_finca),
        nombre_finca: f.nombre_finca,
        nombre_propietario: f.nombre_propietario,
        tamano: f.tamano != null ? Number(f.tamano) : 0,
        estado: f.estado,
        id_tipo_produccion: (f.id_tipo_produccion != null && f.id_tipo_produccion !== '') ? Number(f.id_tipo_produccion) : null,
        nombre_tipo_produccion: f.nombre_tipo_produccion,
        mapa_latitud: (f.mapa_latitud != null && f.mapa_latitud !== '') ? Number(f.mapa_latitud) : null,
        mapa_logitud: (f.mapa_logitud != null && f.mapa_logitud !== '') ? Number(f.mapa_logitud) : null
      })) : [];

      this.fincas.set(normalizadas);
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error de conexión al cargar las fincas.');
    } finally {
      this.loading.set(false);
    }
  }

  cambiarCriterio(nuevo: Criterio): void {
    this.criterio.set(nuevo);
    this.valorAsociado.set('');
    this.valorTipoProduccion.set('');
    this.tamanoMin.set(null);
    this.tamanoMax.set(null);
  }

  private dibujarMarcadores(fincas: FincaMapa[]): void {
    if (!this.map) return;

    this.markers.forEach(m => m.remove());
    this.markers = [];

    if (fincas.length === 0) return;

    const puntos: L.LatLngTuple[] = [];

    fincas.forEach(f => {
      const lat = Number(f.mapa_latitud);
      const lng = Number(f.mapa_logitud);
      puntos.push([lat, lng]);

      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.85,
        weight: 2
      })
        .bindPopup(this.crearPopup(f))
        .on('mouseover', (e) => (e.target as L.CircleMarker).openPopup())
        .on('dblclick', () => this.abrirEnGoogleMaps(lat, lng));

      marker.addTo(this.map as L.Map);
      this.markers.push(marker);
    });

    const bounds = L.latLngBounds(puntos);
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  private crearPopup(f: FincaMapa): string {
    const urlMaps = `https://www.google.com/maps?q=${f.mapa_latitud},${f.mapa_logitud}`;
    return `
      <div style="min-width:190px">
        <b>${f.nombre_finca}</b><br>
        ${f.nombre_propietario ? `👤 ${f.nombre_propietario}<br>` : ''}
        📐 ${f.tamano} Ha<br>
        ${f.nombre_tipo_produccion ? `🌾 ${f.nombre_tipo_produccion}<br>` : ''}
        ${f.estado ? `📌 ${f.estado}<br>` : ''}
        <a href="${urlMaps}" target="_blank" rel="noopener">📍 Abrir en Google Maps</a>
      </div>
    `;
  }

  private abrirEnGoogleMaps(lat: number, lng: number): void {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }
}
