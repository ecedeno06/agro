import { Component, signal, OnInit, computed, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NavigationService } from '../../core/services/navigation.service';

type Finca = {
  id_finca: number;
  id_propietario: number;
  nombre_propietario?: string;
  id_propietario_legal?: number | null;
  nombre_propietario_legal?: string;
  notas?: string;
  nombre_finca: string;
  tamano: number;
  tipo_terreno?: number;
  nombre_tipo_terreno?: string;
  tipo_suelo?: number;
  nombre_tipo_suelo?: string;
  fuente_hidro?: any;
  ubicacion_mapa?: any;
  estado?: string;
  tipo_geografia?: number;
  nombre_tipo_geografia?: string;
  distribcion_geografia?: number;
  area_terreno?: number;
  clima?: string;
  id_pais?: string;
  id_privincia?: number;
  id_distrito?: number;
  id_corregimiento?: number;
  mapa_logitud?: number;
  mapa_latitud?: number;
  tomo?: string;
  folio?: string;
  no_finca?: string;
  estado_legal?: number;
  nombre_estado_legal?: string;
  titulo_finca?: string;
};

declare const L: any;

import { FincaFenomenosComponent  } from '../finca-fenomenos/finca-fenomenos.component';
import { FincaProduccionComponent } from '../finca-produccion/finca-produccion.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mis-fincas',
  standalone: true,
  imports: [CommonModule, FormsModule, FincaFenomenosComponent, FincaProduccionComponent],
  templateUrl: './mis-fincas.component.html',
  styleUrls: ['./mis-fincas.component.scss']
})
export class MisFincasComponent implements OnInit {
  @ViewChild('nombreInput') nombreInput?: ElementRef<HTMLInputElement>;

  readonly navService = inject(NavigationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly apiBaseUrl = environment.apiUrl;

  readonly googleMapUrl = computed<SafeResourceUrl | null>(() => {
    const finca = this.selectedFinca();
    if (!finca || finca.mapa_latitud == null || finca.mapa_logitud == null) return null;
    const lat = Number(finca.mapa_latitud);
    const lng = Number(finca.mapa_logitud);
    if (isNaN(lat) || isNaN(lng)) return null;

    const url = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  readonly googleMapsExternalUrl = computed<string>(() => {
    const finca = this.selectedFinca();
    if (!finca || finca.mapa_latitud == null || finca.mapa_logitud == null) return '#';
    return `https://www.google.com/maps/search/?api=1&query=${Number(finca.mapa_latitud)},${Number(finca.mapa_logitud)}`;
  });

  readonly whatsappShareUrl = computed<string>(() => {
    const finca = this.selectedFinca();
    if (!finca || finca.mapa_latitud == null || finca.mapa_logitud == null) return '#';
    const lat = Number(finca.mapa_latitud);
    const lng = Number(finca.mapa_logitud);
    const nombre = (finca.nombre_finca || 'Finca').trim();
    const tamano = finca.tamano ? `${finca.tamano} Hectáreas` : '';
    const estado = finca.estado ? `[${finca.estado}]` : '';

    const googleMapsUrl = `https://maps.google.com/?q=${lat},${lng}+(${encodeURIComponent(nombre)})`;

    let mensaje = `🌱 *Agro 1.0 - Ubicación de Finca*\n\n`;
    mensaje += `🏡 *Nombre de Finca:* ${nombre} ${estado}\n`;
    if (tamano) mensaje += `📐 *Superficie:* ${tamano}\n`;
    mensaje += `📍 *Coordenadas GPS:* ${lat}, ${lng}\n\n`;
    mensaje += `🗺️ *Ver Mapa:* ${googleMapsUrl}`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
  });

  busquedaLugar = signal('');

  async buscarLugarEnMapa(): Promise<void> {
    const queryStr = this.busquedaLugar().trim();
    if (!queryStr) return;

    this.loading.set(true);
    this.mensajeError.set('');
    this.mensajeExito.set('');

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'es'
        }
      });

      if (!response.ok) throw new Error('Error al buscar el lugar');

      const results = await response.json();
      if (!results || results.length === 0) {
        this.mensajeError.set(`No se encontraron resultados para "${queryStr}". Intente con un nombre o poblado más específico.`);
        return;
      }

      const item = results[0];
      const lat = Number(parseFloat(item.lat).toFixed(6));
      const lng = Number(parseFloat(item.lon).toFixed(6));

      const finca = this.selectedFinca();
      if (finca) {
        finca.mapa_latitud = lat;
        finca.mapa_logitud = lng;
        this.selectedFinca.set({ ...finca });
      }

      if (this.mapaLeaflet && this.markerLeaflet) {
        this.mapaLeaflet.setView([lat, lng], 16);
        this.markerLeaflet.setLatLng([lat, lng]);
        this.markerLeaflet.setPopupContent(`<b>${item.display_name}</b><br>Nuevas Coordenadas:<br>Lat: ${lat}, Lng: ${lng}`).openPopup();
      }

      this.mensajeExito.set(`📍 Lugar encontrado: "${item.display_name}". Se fijó el punto en (${lat}, ${lng}). Presiona "💾 Guardar Coordenadas" para confirmar.`);
    } catch (error: any) {
      this.mensajeError.set('Error al comunicarse con el servicio de búsqueda geográfica.');
    } finally {
      this.loading.set(false);
    }
  }

  private mapaLeaflet: any = null;
  private markerLeaflet: any = null;

  cambiarTabDetalle(tab: 'editar' | 'mapa'): void {
    this.activeDetailTab.set(tab);
    if (tab === 'mapa') {
      this.inicializarMapaLeaflet();
    }
  }

  inicializarMapaLeaflet(): void {
    setTimeout(() => {
      const finca = this.selectedFinca();
      const mapElement = document.getElementById('finca-interactive-map');
      if (!mapElement || typeof L === 'undefined') return;

      if (this.mapaLeaflet) {
        this.mapaLeaflet.remove();
        this.mapaLeaflet = null;
      }

      const lat = finca?.mapa_latitud != null ? Number(finca.mapa_latitud) : 7.945;
      const lng = finca?.mapa_logitud != null ? Number(finca.mapa_logitud) : -80.412;

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
        attribution: '© OpenStreetMap'
      });

      // Inicializar Mapa con Vista Satelital por Defecto
      this.mapaLeaflet = L.map('finca-interactive-map', {
        center: [lat, lng],
        zoom: 16,
        layers: [mapaSatelitalGoogle]
      });

      // Añadir selector interactivo de capas en la esquina superior derecha
      const baseMaps = {
        "🛰️ Vista Satelital (Google)": mapaSatelitalGoogle,
        "🌍 Vista Satelital (Esri)": mapaSatelitalEsri,
        "🗺️ Vista Mapa de Calles": mapaCalles
      };

      L.control.layers(baseMaps).addTo(this.mapaLeaflet);

      const markerIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      this.markerLeaflet = L.marker([lat, lng], {
        draggable: this.puedeEditarOFormulario(),
        icon: markerIcon
      }).addTo(this.mapaLeaflet);

      const nombre = finca?.nombre_finca || 'Finca';
      this.markerLeaflet.bindPopup(`<b>${nombre}</b><br>Haz clic en el mapa o arrastra el marcador para fijar una nueva posición.`).openPopup();

      this.markerLeaflet.on('dragend', (e: any) => {
        const coords = e.target.getLatLng();
        this.actualizarPosicionDesdeMapa(coords.lat, coords.lng);
      });

      if (this.puedeEditarOFormulario()) {
        this.mapaLeaflet.on('click', (e: any) => {
          const newLat = e.latlng.lat;
          const newLng = e.latlng.lng;
          this.markerLeaflet.setLatLng([newLat, newLng]);
          this.actualizarPosicionDesdeMapa(newLat, newLng);
        });
      }

      setTimeout(() => {
        if (this.mapaLeaflet) this.mapaLeaflet.invalidateSize();
      }, 200);
    }, 150);
  }

  private actualizarPosicionDesdeMapa(lat: number, lng: number): void {
    const finca = this.selectedFinca();
    if (!finca) return;

    const latFixed = Number(lat.toFixed(6));
    const lngFixed = Number(lng.toFixed(6));

    finca.mapa_latitud = latFixed;
    finca.mapa_logitud = lngFixed;
    this.selectedFinca.set({ ...finca });

    if (this.markerLeaflet) {
      this.markerLeaflet.setPopupContent(`<b>${finca.nombre_finca || 'Finca'}</b><br>Nuevas Coordenadas:<br>Lat: ${latFixed}, Lng: ${lngFixed}`).openPopup();
    }

    this.mensajeExito.set(`📍 Nueva ubicación seleccionada: Lat ${latFixed}, Lng ${lngFixed}. Presiona "💾 Guardar Coordenadas" para confirmar.`);
  }

  obtenerUbicacionGPS(): void {
    if ('geolocation' in navigator) {
      this.loading.set(true);
      this.mensajeError.set('');
      this.mensajeExito.set('');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const finca = this.selectedFinca();
          if (finca) {
            const lat = Number(position.coords.latitude.toFixed(6));
            const lng = Number(position.coords.longitude.toFixed(6));
            finca.mapa_latitud = lat;
            finca.mapa_logitud = lng;
            this.selectedFinca.set({ ...finca });
            if (this.mapaLeaflet && this.markerLeaflet) {
              this.mapaLeaflet.setView([lat, lng], 15);
              this.markerLeaflet.setLatLng([lat, lng]);
            }
            this.mensajeExito.set(`Ubicación GPS capturada: (${lat}, ${lng}). Recuerda hacer clic en "💾 Guardar Coordenadas" para actualizar en la BD.`);
          }
          this.loading.set(false);
        },
        (error) => {
          this.mensajeError.set('No se pudo obtener la ubicación GPS desde su navegador.');
          this.loading.set(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      this.mensajeError.set('La geolocalización no está soportada por su navegador.');
    }
  }

  modoFormulario = signal<'crear' | 'editar' | null>(null);
  fincas = signal<Finca[]>([]);
  filterText = signal('');
  sortColumn = signal<string>('id_finca');
  sortDirection = signal<'asc' | 'desc'>('desc');

  toggleSort(columnKey: string): void {
    if (this.sortColumn() === columnKey) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(columnKey);
      this.sortDirection.set('asc');
    }
  }

  filteredFincas = computed(() => {
    const term = this.filterText().toLowerCase().trim();
    const list = [...this.fincas()];
    const col = this.sortColumn();
    const dir = this.sortDirection();

    let result = list;
    if (term) {
      result = list.filter(f => 
        (f.nombre_finca && f.nombre_finca.toLowerCase().includes(term)) ||
        (f.nombre_propietario && f.nombre_propietario.toLowerCase().includes(term)) ||
        (f.estado && f.estado.toLowerCase().includes(term)) ||
        (f.nombre_estado_legal && f.nombre_estado_legal.toLowerCase().includes(term)) ||
        (f.nombre_tipo_terreno && f.nombre_tipo_terreno.toLowerCase().includes(term)) ||
        (f.nombre_tipo_suelo && f.nombre_tipo_suelo.toLowerCase().includes(term)) ||
        (f.nombre_tipo_geografia && f.nombre_tipo_geografia.toLowerCase().includes(term)) ||
        (f.tamano != null && String(f.tamano).toLowerCase().includes(term)) ||
        (f.no_finca && f.no_finca.toLowerCase().includes(term)) ||
        (f.titulo_finca && f.titulo_finca.toLowerCase().includes(term)) ||
        (f.clima && f.clima.toLowerCase().includes(term))
      );
    }

    return result.sort((a: any, b: any) => {
      let valA = a[col];
      let valB = b[col];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return dir === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return dir === 'asc' ? -1 : 1;
      if (strA > strB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  selectedFinca = signal<Finca | null>(null);
  activeDetailTab = signal<'editar' | 'mapa'>('editar');
  
  // Sub-tabs para dividir los campos del formulario de edición/detalle/creación
  activeFormSubTab = signal<'general' | 'geografia' | 'ubicacion' | 'fenomenos' | 'legal' | 'produccion' >('general');

  loading = signal(false);
  mensajeError = signal('');
  mensajeExito = signal('');

  // Usuario actual cargado de sesión
  currentUser = signal<any | null>(null);

  // Determinar si el usuario es Admin o Superadmin
  esAdminOSuper = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    const superadminEmail = 'superadmin@agro.com';
    const roleValues = [
      user.rol,
      user.rolCodigo,
      user.codigo_rol,
      user.codigo
    ].map(r => String(r || '').trim().toLowerCase());

    return user.email === superadminEmail || roleValues.some(r => ['adm', 'admin', 'sec', 'secretaria', 'superadmin'].includes(r));
  });

  // Determinar si el usuario logueado tiene el rol de Asociado ('aso')
  esAsociado = computed(() => {
    const user = this.currentUser();
    if (!user) return false;

    const roleValues = [
      user.rol,
      user.rolCodigo,
      user.codigo_rol,
      user.codigo
    ].map(r => String(r || '').trim().toLowerCase());

    return roleValues.some(r => r === 'aso' || r === 'asociado');
  });

  // Verificar si su rol tiene asignado el permiso 'crear' en la matriz para /mis-fincas
  puedeCrearFinca = computed(() => {
    if (this.esAdminOSuper()) return true;
    if (!this.esAsociado()) return false;

    const permsMap = this.navService.permissions();
    const permsLoaded = Object.keys(permsMap).length > 0;
    if (!permsLoaded) return true;

    return this.navService.hasPermission('/mis-fincas', 'crear') || 
           this.navService.hasPermission('mis-fincas', 'crear') ||
           this.navService.hasPermission('/fincas', 'crear');
  });

  // Determinar si puede editar la finca seleccionada
  puedeEditarSeleccionada = computed(() => {
    const user = this.currentUser();
    const finca = this.selectedFinca();
    if (!user || !finca) return false;

    if (this.esAdminOSuper()) return true;
    if (!this.esAsociado()) return false;
    
    const esSuFinca = Number(finca.id_propietario) === Number(user.idUsuario);
    if (!esSuFinca) return false;

    const permsMap = this.navService.permissions();
    const permsLoaded = Object.keys(permsMap).length > 0;
    if (!permsLoaded) return true;

    return this.navService.hasPermission('/mis-fincas', 'editar') || 
           this.navService.hasPermission('mis-fincas', 'editar') ||
           this.navService.hasPermission('/fincas', 'editar');
  });

  // Determinar si el formulario actual está habilitado para interactuar (Creación o Edición permitida)
  puedeEditarOFormulario = computed(() => {
    if (this.modoFormulario() === 'crear') return true;
    if (this.modoFormulario() === 'editar') return this.puedeEditarSeleccionada();
    return false;
  });

  getEmptyFinca(): Finca {
    return {
      id_finca: 0,
      id_propietario: this.currentUser()?.idUsuario || 0,
      nombre_finca: '',
      tamano: null as any,
      clima: 'Tropical Seco',
      estado: 'En producción',
      tipo_terreno: undefined,
      tipo_suelo: undefined,
      tipo_geografia: undefined,
      area_terreno: undefined,
      distribcion_geografia: undefined,
      id_pais: 'PA',
      id_privincia: undefined,
      id_distrito: undefined,
      id_corregimiento: undefined,
      mapa_latitud: undefined,
      mapa_logitud: undefined,
      no_finca: '',
      titulo_finca: '',
      tomo: '',
      folio: '',
      estado_legal: undefined,
      notas: ''
    };
  }

  abrirFormularioCreacion(): void {
    if (this.modoFormulario() === 'crear') {
      this.modoFormulario.set(null);
      this.selectedFinca.set(null);
    } else {
      this.modoFormulario.set('crear');
      this.selectedFinca.set(this.getEmptyFinca());
      this.activeDetailTab.set('editar');
      this.activeFormSubTab.set('general');
      this.enfocarNombreInput();
    }
    this.mensajeError.set('');
    this.mensajeExito.set('');
  }

  tiposTerreno = signal<{ id: number; nombre: string; descripcion?: string }[]>([]);
  tiposSuelo = signal<{ id: number; nombre: string; descripcion?: string }[]>([]);
  tiposGeografia = signal<{ id: number; nombre: string; descripcion?: string }[]>([]);
  tiposEstadoLegal = signal<{ id: number; nombre: string; descripcion?: string }[]>([]);
  paises = signal<{ id: number; nombre: string; codigo_iso2: string; codigo_iso3: string }[]>([]);

  ngOnInit(): void {
    this.cargarUsuarioSesion();
    this.navService.loadNavigation();
    this.cargarFincas();
    this.cargarTiposTerreno();
    this.cargarTiposSuelo();
    this.cargarTiposGeografia();
    this.cargarTiposEstadoLegal();
    this.cargarPaises();
  }

  async cargarTiposTerreno(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/tipo-terreno`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data.map(item => ({
          ...item,
          id: Number(item.id || item.id_tipo_terreno)
        })) : [];
        this.tiposTerreno.set(list);
      }
    } catch (e) {
      console.error('Error al cargar tipos de terreno:', e);
    }
  }

  async cargarTiposSuelo(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/tipo-suelos`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data.map(item => ({
          ...item,
          id: Number(item.id || item.id_tipo_suelo)
        })) : [];
        this.tiposSuelo.set(list);
      }
    } catch (e) {
      console.error('Error al cargar tipos de suelo:', e);
    }
  }

  async cargarTiposGeografia(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/tipo-geografia`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data.map(item => ({
          ...item,
          id: Number(item.id || item.id_tipo_geografia),
          nombre: item.nombre || item.descripcion || 'Sin nombre'
        })) : [];
        this.tiposGeografia.set(list);
      }
    } catch (e) {
      console.error('Error al cargar tipos de geografía:', e);
    }
  }

  async cargarTiposEstadoLegal(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/tipo-estado-legal`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data.map(item => ({
          ...item,
          id: Number(item.id || item.id_estado_legal),
          nombre: item.nombre || item.descripcion || 'Sin nombre'
        })) : [];
        this.tiposEstadoLegal.set(list);
      }
    } catch (e) {
      console.error('Error al cargar catálogo de estado legal:', e);
    }
  }

  async cargarPaises(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/paises`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        this.paises.set(data);
      }
    } catch (e) {
      console.error('Error al cargar catálogo de países:', e);
    }
  }

  getTooltipNotas(finca: Finca): string {
    if (finca.notas && finca.notas.trim()) {
      return `📝 ${finca.notas.trim()}`;
    }
    return '';
  }

  private cargarUsuarioSesion(): void {
    const userStr = localStorage.getItem('agro_session_user');
    if (userStr) {
      try {
        this.currentUser.set(JSON.parse(userStr));
      } catch (e) {
        console.error('Error al parsear usuario de sesión:', e);
      }
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  private normalizarFinca(finca: any): Finca {
    if (!finca) return finca;
    return {
      ...finca,
      id_finca: Number(finca.id_finca),
      id_propietario: Number(finca.id_propietario),
      tamano: finca.tamano != null ? Number(finca.tamano) : 0,
      tipo_terreno: (finca.tipo_terreno != null && finca.tipo_terreno !== '') ? Number(finca.tipo_terreno) : undefined,
      tipo_suelo: (finca.tipo_suelo != null && finca.tipo_suelo !== '') ? Number(finca.tipo_suelo) : undefined,
      tipo_geografia: (finca.tipo_geografia != null && finca.tipo_geografia !== '') ? Number(finca.tipo_geografia) : undefined,
      area_terreno: (finca.area_terreno != null && finca.area_terreno !== '') ? Number(finca.area_terreno) : undefined,
      id_privincia: (finca.id_privincia != null && finca.id_privincia !== '') ? Number(finca.id_privincia) : undefined,
      id_distrito: (finca.id_distrito != null && finca.id_distrito !== '') ? Number(finca.id_distrito) : undefined,
      id_corregimiento: (finca.id_corregimiento != null && finca.id_corregimiento !== '') ? Number(finca.id_corregimiento) : undefined,
      mapa_latitud: (finca.mapa_latitud != null && finca.mapa_latitud !== '') ? Number(finca.mapa_latitud) : undefined,
      mapa_logitud: (finca.mapa_logitud != null && finca.mapa_logitud !== '') ? Number(finca.mapa_logitud) : undefined,
      estado_legal: (finca.estado_legal != null && finca.estado_legal !== '') ? Number(finca.estado_legal) : undefined,
      id_propietario_legal: (finca.id_propietario_legal != null && finca.id_propietario_legal !== '') ? Number(finca.id_propietario_legal) : null,
      notas: finca.notas || ''
    };
  }

  async cargarFincas(): Promise<void> {
    this.loading.set(true);
    this.mensajeError.set('');
    try {
      const response = await fetch(`${this.apiBaseUrl}/fincas`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al cargar la lista de fincas');
      }

      const data = await response.json();
      const fincasNormalizadas = Array.isArray(data) ? data.map(f => this.normalizarFinca(f)) : [];
      this.fincas.set(fincasNormalizadas);
    } catch (error: any) {
      this.mensajeError.set(error.message || 'Error de conexión');
    } finally {
      this.loading.set(false);
    }
  }

  seleccionarFinca(finca: Finca): void {
    this.modoFormulario.set('editar');
    this.selectedFinca.set(this.normalizarFinca(finca));
    this.activeDetailTab.set('editar');
    this.activeFormSubTab.set('general');
    this.mensajeExito.set('');
    this.mensajeError.set('');

    setTimeout(() => {
      const element = document.getElementById('detailSection');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);

    this.enfocarNombreInput();
  }

  enfocarNombreInput(): void {
    setTimeout(() => {
      if (this.nombreInput?.nativeElement && !this.nombreInput.nativeElement.disabled && this.activeFormSubTab() === 'general') {
        this.nombreInput.nativeElement.focus();
        this.nombreInput.nativeElement.select();
      }
    }, 100);
  }

  async guardarCambios(): Promise<void> {
    const finca = this.selectedFinca();
    if (!finca || !this.puedeEditarOFormulario() || this.loading()) return;

    if (!finca.nombre_finca || !finca.nombre_finca.trim() || finca.tamano === null || finca.tamano === undefined || Number(finca.tamano) <= 0) {
      this.mensajeError.set('El nombre de la finca y un tamaño (en hectáreas) mayor a 0 son obligatorios.');
      return;
    }

    this.loading.set(true);
    this.mensajeError.set('');
    this.mensajeExito.set('');

    const esCreacion = this.modoFormulario() === 'crear' || !finca.id_finca;
    const url = esCreacion ? `${this.apiBaseUrl}/fincas` : `${this.apiBaseUrl}/fincas/${finca.id_finca}`;
    const method = esCreacion ? 'POST' : 'PUT';

    const payload = {
      nombre_finca: finca.nombre_finca.trim(),
      tamano: Number(finca.tamano),
      tipo_terreno: ((finca.tipo_terreno as any) != null && (finca.tipo_terreno as any) !== '') ? Number(finca.tipo_terreno) : null,
      tipo_suelo: ((finca.tipo_suelo as any) != null && (finca.tipo_suelo as any) !== '') ? Number(finca.tipo_suelo) : null,
      fuente_hidro: finca.fuente_hidro || null,
      ubicacion_mapa: finca.ubicacion_mapa || null,
      estado: finca.estado || 'En producción',
      tipo_geografia: ((finca.tipo_geografia as any) != null && (finca.tipo_geografia as any) !== '') ? Number(finca.tipo_geografia) : null,
      distribcion_geografia: ((finca.distribcion_geografia as any) != null && (finca.distribcion_geografia as any) !== '') ? Number(finca.distribcion_geografia) : null,
      area_terreno: ((finca.area_terreno as any) != null && (finca.area_terreno as any) !== '') ? Number(finca.area_terreno) : null,
      clima: (finca.clima || '').trim(),
      id_pais: (finca.id_pais || 'PA').trim(),
      id_privincia: ((finca.id_privincia as any) != null && (finca.id_privincia as any) !== '') ? Number(finca.id_privincia) : null,
      id_distrito: ((finca.id_distrito as any) != null && (finca.id_distrito as any) !== '') ? Number(finca.id_distrito) : null,
      id_corregimiento: ((finca.id_corregimiento as any) != null && (finca.id_corregimiento as any) !== '') ? Number(finca.id_corregimiento) : null,
      mapa_logitud: ((finca.mapa_logitud as any) != null && (finca.mapa_logitud as any) !== '') ? Number(finca.mapa_logitud) : null,
      mapa_latitud: ((finca.mapa_latitud as any) != null && (finca.mapa_latitud as any) !== '') ? Number(finca.mapa_latitud) : null,
      tomo: (finca.tomo || '').trim(),
      folio: (finca.folio || '').trim(),
      no_finca: (finca.no_finca || '').trim(),
      estado_legal: ((finca.estado_legal as any) != null && (finca.estado_legal as any) !== '') ? Number(finca.estado_legal) : null,
      titulo_finca: (finca.titulo_finca || '').trim(),
      id_propietario_legal: ((finca.id_propietario_legal as any) != null && (finca.id_propietario_legal as any) !== '') ? Number(finca.id_propietario_legal) : null,
      notas: (finca.notas || '').trim()
    };

    try {
      const response = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || (esCreacion ? 'Error al registrar la finca' : 'Error al guardar cambios de la finca'));
      }

      this.mensajeExito.set(esCreacion ? 'Finca registrada exitosamente.' : 'Finca actualizada exitosamente en el servidor.');
      
      await this.cargarFincas();
      const fincaFinal = resData.finca || finca;
      this.modoFormulario.set('editar');
      this.selectedFinca.set(this.normalizarFinca(fincaFinal));
    } catch (error: any) {
      this.mensajeError.set(error.message || 'Error al guardar los datos de la finca');
    } finally {
      this.loading.set(false);
    }
  }
}
