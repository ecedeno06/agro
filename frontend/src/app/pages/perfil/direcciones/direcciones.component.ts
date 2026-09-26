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
type ProvinciaOpcion = { id: number; nombre: string; tipo: string | null };
type DistritoOpcion = { id: number; nombre: string; tipo: string | null };

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
  provincias = signal<ProvinciaOpcion[]>([]);
  distritos = signal<DistritoOpcion[]>([]);
  provinciaSeleccionadaId = signal<number | null>(null);
  distritoSeleccionadoId = signal<number | null>(null);
  provinciaNoCatalogada = signal<string | null>(null);
  distritoNoCatalogado = signal<string | null>(null);
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

  private async cargarProvincias(codigoIso2: string): Promise<void> {
    if (!codigoIso2) {
      this.provincias.set([]);
      return;
    }
    try {
      const res = await fetch(`${this.apiBaseUrl}/provincias?codigo_iso2=${codigoIso2}`, { headers: this.getAuthHeaders() });
      this.provincias.set(res.ok ? await res.json() : []);
    } catch (e) {
      console.error('Error al cargar provincias:', e);
      this.provincias.set([]);
    }
  }

  private async cargarDistritos(provinciaId: number | null): Promise<void> {
    if (!provinciaId) {
      this.distritos.set([]);
      return;
    }
    try {
      const res = await fetch(`${this.apiBaseUrl}/distritos?provincia_id=${provinciaId}`, { headers: this.getAuthHeaders() });
      this.distritos.set(res.ok ? await res.json() : []);
    } catch (e) {
      console.error('Error al cargar distritos:', e);
      this.distritos.set([]);
    }
  }

  private buscarProvinciaPorNombre(nombre: string): ProvinciaOpcion | undefined {
    const norm = nombre.trim().toLowerCase();
    return this.provincias().find(p => p.nombre.trim().toLowerCase() === norm);
  }

  private buscarDistritoPorNombre(nombre: string): DistritoOpcion | undefined {
    const norm = nombre.trim().toLowerCase();
    return this.distritos().find(d => d.nombre.trim().toLowerCase() === norm);
  }

  private resetearDivisionPolitica(): void {
    this.provincias.set([]);
    this.distritos.set([]);
    this.provinciaSeleccionadaId.set(null);
    this.distritoSeleccionadoId.set(null);
    this.provinciaNoCatalogada.set(null);
    this.distritoNoCatalogado.set(null);
  }

  async onPaisChange(codigoIso2: string): Promise<void> {
    this.actualizarCampo('pais', codigoIso2);
    this.actualizarCampo('provincia', '');
    this.actualizarCampo('distrito', '');
    this.resetearDivisionPolitica();
    await this.cargarProvincias(codigoIso2);
  }

  async onProvinciaChange(id: number | null): Promise<void> {
    this.provinciaSeleccionadaId.set(id);
    this.provinciaNoCatalogada.set(null);
    this.distritoSeleccionadoId.set(null);
    this.distritoNoCatalogado.set(null);

    const prov = id != null ? this.provincias().find(p => p.id === id) : undefined;
    this.actualizarCampo('provincia', prov ? prov.nombre : '');
    this.actualizarCampo('distrito', '');
    await this.cargarDistritos(id);
  }

  onDistritoChange(id: number | null): void {
    this.distritoSeleccionadoId.set(id);
    this.distritoNoCatalogado.set(null);
    const dist = id != null ? this.distritos().find(d => d.id === id) : undefined;
    this.actualizarCampo('distrito', dist ? dist.nombre : '');
  }

  abrirNuevo(): void {
    this.form.set(formularioVacio());
    this.resetearDivisionPolitica();
    this.errorMsg.set('');
    this.successMsg.set('');
    this.formAbierto.set(true);
  }

  async abrirEditar(d: Direccion): Promise<void> {
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
    this.resetearDivisionPolitica();
    this.formAbierto.set(true);

    if (!d.pais) return;
    await this.cargarProvincias(d.pais);
    if (!d.provincia) return;

    const prov = this.buscarProvinciaPorNombre(d.provincia);
    if (!prov) {
      this.provinciaNoCatalogada.set(d.provincia);
      if (d.distrito) this.distritoNoCatalogado.set(d.distrito);
      return;
    }

    this.provinciaSeleccionadaId.set(prov.id);
    await this.cargarDistritos(prov.id);
    if (!d.distrito) return;

    const dist = this.buscarDistritoPorNombre(d.distrito);
    if (dist) {
      this.distritoSeleccionadoId.set(dist.id);
    } else {
      this.distritoNoCatalogado.set(d.distrito);
    }
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
      const codigoIso2 = paisCoincidente ? paisCoincidente.codigo_iso2 : this.form().pais;

      this.actualizarCampo('pais', codigoIso2);
      this.resetearDivisionPolitica();

      if (codigoIso2) {
        await this.cargarProvincias(codigoIso2);
      }

      if (data.provincia) {
        const prov = this.buscarProvinciaPorNombre(data.provincia);
        if (prov) {
          this.provinciaSeleccionadaId.set(prov.id);
          this.actualizarCampo('provincia', prov.nombre);
          await this.cargarDistritos(prov.id);

          const dist = data.distrito ? this.buscarDistritoPorNombre(data.distrito) : undefined;
          if (dist) {
            this.distritoSeleccionadoId.set(dist.id);
            this.actualizarCampo('distrito', dist.nombre);
          } else if (data.distrito) {
            this.distritoNoCatalogado.set(data.distrito);
            this.actualizarCampo('distrito', data.distrito);
          }
        } else {
          this.provinciaNoCatalogada.set(data.provincia);
          this.actualizarCampo('provincia', data.provincia);
          if (data.distrito) {
            this.distritoNoCatalogado.set(data.distrito);
            this.actualizarCampo('distrito', data.distrito);
          }
        }
      }

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
