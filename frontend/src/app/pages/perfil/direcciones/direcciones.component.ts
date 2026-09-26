import { Component, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { MapaSelectorComponent, UbicacionSeleccionada, extraerLatLng } from '../../../core/components/mapa-selector/mapa-selector.component';

type Direccion = {
  id: number;
  pais: string | null;
  provincia: string | null;
  distrito: string | null;
  corregimiento: string | null;
  direccion_texto: string;
  es_principal: boolean;
  google_maps_url: string | null;
  comparte_ubicacion: boolean;
};

type PaisOpcion = { codigo_iso2: string; nombre: string };

function formularioVacio() {
  return {
    id: null as number | null,
    pais: '',
    provincia: '',
    distrito: '',
    corregimiento: '',
    direccion_texto: '',
    es_principal: false,
    google_maps_url: '',
    comparte_ubicacion: false
  };
}

@Component({
  selector: 'app-direcciones',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaSelectorComponent],
  templateUrl: './direcciones.component.html',
  styleUrls: ['./direcciones.component.scss']
})
export class DireccionesComponent implements OnInit {
  @ViewChild(MapaSelectorComponent) mapaSelector?: MapaSelectorComponent;

  private readonly apiBaseUrl = environment.apiUrl;

  direcciones = signal<Direccion[]>([]);
  paises = signal<PaisOpcion[]>([]);
  loading = signal(false);
  errorMsg = signal('');
  successMsg = signal('');

  formAbierto = signal(false);
  detectando = signal(false);
  form = signal(formularioVacio());

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarDirecciones(), this.cargarPaises()]);
  }

  async cargarDirecciones(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const res = await fetch(`${this.apiBaseUrl}/usuarios/direcciones`, { headers: this.getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudieron cargar las direcciones.');
      this.direcciones.set(Array.isArray(data) ? data : []);
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error de conexión al cargar las direcciones.');
    } finally {
      this.loading.set(false);
    }
  }

  async cargarPaises(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/paises`, { headers: this.getAuthHeaders() });
      if (res.ok) this.paises.set(await res.json());
    } catch (e) {
      console.error('Error al cargar países:', e);
    }
  }

  abrirNuevo(): void {
    this.form.set(formularioVacio());
    this.errorMsg.set('');
    this.successMsg.set('');
    this.formAbierto.set(true);
  }

  abrirEditar(d: Direccion): void {
    this.form.set({
      id: d.id,
      pais: d.pais || '',
      provincia: d.provincia || '',
      distrito: d.distrito || '',
      corregimiento: d.corregimiento || '',
      direccion_texto: d.direccion_texto || '',
      es_principal: d.es_principal,
      google_maps_url: d.google_maps_url || '',
      comparte_ubicacion: d.comparte_ubicacion
    });
    this.errorMsg.set('');
    this.successMsg.set('');
    this.formAbierto.set(true);
  }

  cerrarForm(): void {
    this.formAbierto.set(false);
  }

  actualizarCampo<K extends keyof ReturnType<typeof formularioVacio>>(campo: K, valor: ReturnType<typeof formularioVacio>[K]): void {
    this.form.set({ ...this.form(), [campo]: valor });
  }

  abrirMapa(): void {
    this.mapaSelector?.abrir(this.form().google_maps_url);
  }

  onUbicacionElegida(u: UbicacionSeleccionada): void {
    this.actualizarCampo('google_maps_url', u.url);
  }

  async detectarDivisionPolitica(): Promise<void> {
    const coords = extraerLatLng(this.form().google_maps_url);
    if (!coords) {
      this.errorMsg.set('Pega primero un enlace de Google Maps con coordenadas (ej. https://maps.google.com/?q=8.9,-79.7).');
      return;
    }

    this.detectando.set(true);
    this.errorMsg.set('');
    try {
      const [lat, lng] = coords;
      const res = await fetch(`${this.apiBaseUrl}/geocodificacion/reverse?lat=${lat}&lng=${lng}`, {
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo detectar la división política para ese punto.');

      const paisCoincidente = data.pais_codigo
        ? this.paises().find(p => p.codigo_iso2 === data.pais_codigo)
        : null;

      this.form.set({
        ...this.form(),
        pais: paisCoincidente ? paisCoincidente.codigo_iso2 : this.form().pais,
        provincia: data.provincia || this.form().provincia,
        distrito: data.distrito || this.form().distrito
      });
      this.successMsg.set('📍 División política detectada. Revisa los campos y guarda.');
    } catch (error: any) {
      this.errorMsg.set(error.message || 'No se pudo detectar la división política para ese punto.');
    } finally {
      this.detectando.set(false);
    }
  }

  async guardar(): Promise<void> {
    const f = this.form();
    if (!f.direccion_texto.trim()) {
      this.errorMsg.set('La dirección es obligatoria.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    const esCreacion = f.id == null;
    const url = esCreacion
      ? `${this.apiBaseUrl}/usuarios/direcciones`
      : `${this.apiBaseUrl}/usuarios/direcciones/${f.id}`;

    const payload = {
      pais: f.pais || null,
      provincia: f.provincia || null,
      distrito: f.distrito || null,
      corregimiento: f.corregimiento || null,
      direccion_texto: f.direccion_texto.trim(),
      es_principal: f.es_principal,
      google_maps_url: f.google_maps_url || null,
      comparte_ubicacion: f.comparte_ubicacion
    };

    try {
      const res = await fetch(url, {
        method: esCreacion ? 'POST' : 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo guardar la dirección.');

      this.successMsg.set(esCreacion ? 'Dirección agregada correctamente.' : 'Dirección actualizada correctamente.');
      this.formAbierto.set(false);
      await this.cargarDirecciones();
    } catch (error: any) {
      this.errorMsg.set(error.message || 'No se pudo guardar la dirección.');
    } finally {
      this.loading.set(false);
    }
  }

  async marcarPrincipal(d: Direccion): Promise<void> {
    if (d.es_principal) return;
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const res = await fetch(`${this.apiBaseUrl}/usuarios/direcciones/${d.id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ ...d, es_principal: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo marcar como principal.');
      await this.cargarDirecciones();
    } catch (error: any) {
      this.errorMsg.set(error.message || 'No se pudo marcar como principal.');
    } finally {
      this.loading.set(false);
    }
  }

  async eliminar(d: Direccion): Promise<void> {
    if (!confirm(`¿Eliminar la dirección "${d.direccion_texto}"?`)) return;

    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const res = await fetch(`${this.apiBaseUrl}/usuarios/direcciones/${d.id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo eliminar la dirección.');
      this.successMsg.set('Dirección eliminada.');
      await this.cargarDirecciones();
    } catch (error: any) {
      this.errorMsg.set(error.message || 'No se pudo eliminar la dirección.');
    } finally {
      this.loading.set(false);
    }
  }

  nombrePais(codigoIso2: string | null): string | null {
    if (!codigoIso2) return null;
    return this.paises().find(p => p.codigo_iso2 === codigoIso2)?.nombre || codigoIso2;
  }

  ubicacionTexto(d: Direccion): string {
    const partes = [d.distrito, d.provincia, this.nombrePais(d.pais)].filter(p => !!p && p.trim().length > 0);
    return partes.length > 0 ? partes.join(', ') : '-';
  }
}
