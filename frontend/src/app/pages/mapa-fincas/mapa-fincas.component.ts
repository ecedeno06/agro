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
  nombre_pais?: string;
  id_privincia?: string | null;
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
  private markersPorFinca = new Map<number, L.CircleMarker>();
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

  criterioLabel = computed(() => {
    switch (this.criterio()) {
      case 'asociado': return 'Asociado';
      case 'tipo_produccion': return 'Tipo de Producción';
      case 'tamano': return 'Tamaño (Hectáreas)';
      default: return 'Sin filtro';
    }
  });

  valorParaFinca(f: FincaMapa): string {
    switch (this.criterio()) {
      case 'asociado': return f.nombre_propietario || '-';
      case 'tipo_produccion': return f.nombre_tipo_produccion || '-';
      case 'tamano': return `${f.tamano} Ha`;
      default: return '-';
    }
  }

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
    // Capa Satelital Híbrida (Google Satellite + Nombres de Calles)
    const mapaSatelitalGoogle = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Imágenes Satelitales &copy; Google Maps'
    });

    // Capa Satelital Alta Resolución (Esri World Imagery)
    const mapaSatelitalEsri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Satelital &copy; Esri &mdash; i-cubed, USDA, USGS'
    });

    // Capa Estándar de Calles (OpenStreetMap)
    const mapaCalles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    this.map = L.map('mapa-fincas-container', {
      center: [8.5, -80.5],
      zoom: 7,
      layers: [mapaCalles]
    });

    const baseMaps = {
      '🗺️ Vista Mapa de Calles': mapaCalles,
      '🛰️ Vista Satelital (Google)': mapaSatelitalGoogle,
      '🌍 Vista Satelital (Esri)': mapaSatelitalEsri
    };

    L.control.layers(baseMaps).addTo(this.map);

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
        nombre_pais: f.nombre_pais,
        id_privincia: f.id_privincia || null,
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
    this.markersPorFinca.clear();

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
      this.markersPorFinca.set(f.id_finca, marker);
    });

    const bounds = L.latLngBounds(puntos);
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  enfocarFinca(f: FincaMapa): void {
    if (!this.map || f.mapa_latitud == null || f.mapa_logitud == null) return;

    this.map.setView([Number(f.mapa_latitud), Number(f.mapa_logitud)], 15, { animate: true });

    const marker = this.markersPorFinca.get(f.id_finca);
    if (marker) {
      marker.openPopup();
    }

    document.getElementById('mapa-fincas-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  paisProvinciaTexto(f: FincaMapa): string {
    const partes: string[] = [];
    if (f.nombre_pais) partes.push(f.nombre_pais);
    if (f.id_privincia) partes.push(f.id_privincia);
    return partes.length > 0 ? partes.join(', ') : '-';
  }

  private crearPopup(f: FincaMapa): string {
    const urlMaps = `https://www.google.com/maps?q=${f.mapa_latitud},${f.mapa_logitud}`;
    const ubicacionTexto = this.paisProvinciaTexto(f);
    return `
      <div style="min-width:190px">
        <b>${f.nombre_finca}</b><br>
        ${f.nombre_propietario ? `👤 ${f.nombre_propietario}<br>` : ''}
        📐 ${f.tamano} Ha<br>
        ${f.nombre_tipo_produccion ? `🌾 ${f.nombre_tipo_produccion}<br>` : ''}
        ${ubicacionTexto !== '-' ? `🌎 ${ubicacionTexto}<br>` : ''}
        ${f.estado ? `📌 ${f.estado}<br>` : ''}
        <a href="${urlMaps}" target="_blank" rel="noopener">📍 Abrir en Google Maps</a>
      </div>
    `;
  }

  private abrirEnGoogleMaps(lat: number, lng: number): void {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }
}
