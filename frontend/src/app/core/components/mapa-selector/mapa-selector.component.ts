import { Component, ElementRef, EventEmitter, Output, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

export type UbicacionSeleccionada = { lat: number; lng: number; url: string };

const CENTRO_POR_DEFECTO: [number, number] = [8.9824, -79.5199]; // Ciudad de Panamá

const ICONO_PIN = L.divIcon({
  className: 'mapa-selector-pin',
  html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="#06b6d4" stroke="#020a0d" stroke-width="1">
    <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
  </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

/** Extrae [lat, lng] de una URL de Google Maps (formatos ?q=lat,lng o /@lat,lng,zoom). */
export function extraerLatLng(url: string | null | undefined): [number, number] | null {
  if (!url) return null;
  const match = url.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

type ResultadoBusqueda = { display_name: string; lat: string; lon: string };

@Component({
  selector: 'app-mapa-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-selector.component.html',
  styleUrls: ['./mapa-selector.component.scss']
})
export class MapaSelectorComponent {
  @Output() ubicacionSeleccionada = new EventEmitter<UbicacionSeleccionada>();
  @ViewChild('mapaContainer') mapaContainer?: ElementRef<HTMLDivElement>;

  private mapa: L.Map | null = null;
  private marcador: L.Marker | null = null;
  private busquedaTimeout: ReturnType<typeof setTimeout> | null = null;

  visible = signal(false);
  puntoElegido = signal<[number, number] | null>(null);
  busqueda = signal('');
  buscando = signal(false);
  resultadosBusqueda = signal<ResultadoBusqueda[]>([]);

  abrir(urlActual?: string | null): void {
    const inicial = extraerLatLng(urlActual);
    this.puntoElegido.set(inicial);
    this.busqueda.set('');
    this.resultadosBusqueda.set([]);
    this.visible.set(true);
    setTimeout(() => this.inicializarMapa(inicial ?? CENTRO_POR_DEFECTO), 0);
  }

  private inicializarMapa(centro: [number, number]): void {
    if (!this.mapaContainer) return;

    const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });
    const satelite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
    );

    this.mapa = L.map(this.mapaContainer.nativeElement, { layers: [calles] }).setView(centro, 15);
    L.control.layers({ 'Calles': calles, 'Satélite': satelite }).addTo(this.mapa);

    if (this.puntoElegido()) this.colocarMarcador(centro);

    this.mapa.on('click', (e: L.LeafletMouseEvent) => {
      const punto: [number, number] = [e.latlng.lat, e.latlng.lng];
      this.puntoElegido.set(punto);
      this.colocarMarcador(punto);
    });
  }

  private colocarMarcador(punto: [number, number]): void {
    if (this.marcador) {
      this.marcador.setLatLng(punto);
    } else if (this.mapa) {
      this.marcador = L.marker(punto, { icon: ICONO_PIN }).addTo(this.mapa);
    }
  }

  onBusquedaInput(valor: string): void {
    this.busqueda.set(valor);
    if (this.busquedaTimeout) clearTimeout(this.busquedaTimeout);
    if (valor.trim().length < 3) {
      this.resultadosBusqueda.set([]);
      return;
    }
    this.busquedaTimeout = setTimeout(() => this.buscarAhora(), 500);
  }

  async buscarAhora(): Promise<void> {
    const termino = this.busqueda().trim();
    if (termino.length < 3) return;

    this.buscando.set(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(termino)}`;
      const res = await fetch(url);
      const data: ResultadoBusqueda[] = await res.json();
      this.resultadosBusqueda.set(data);
    } catch {
      this.resultadosBusqueda.set([]);
    } finally {
      this.buscando.set(false);
    }
  }

  elegirResultado(r: ResultadoBusqueda): void {
    const punto: [number, number] = [Number(r.lat), Number(r.lon)];
    this.puntoElegido.set(punto);
    this.resultadosBusqueda.set([]);
    this.busqueda.set(r.display_name);
    this.mapa?.setView(punto, 16);
    this.colocarMarcador(punto);
  }

  guardar(): void {
    const punto = this.puntoElegido();
    if (!punto) return;
    const [lat, lng] = punto;
    this.ubicacionSeleccionada.emit({ lat, lng, url: `https://www.google.com/maps?q=${lat},${lng}` });
    this.cerrar();
  }

  cerrar(): void {
    this.visible.set(false);
    this.mapa?.remove();
    this.mapa = null;
    this.marcador = null;
  }
}
