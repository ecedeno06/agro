import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

type MotivoSalida =
  | 'logout_usuario' | 'inactividad' | 'token_invalido' | 'expiracion_token'
  | 'expiracion_automatica' | 'cerrada_por_admin' | 'en_curso' | 'expirada_sin_cerrar';

type SesionAuditoria = {
  id: number;
  id_usuario: number;
  usuario_nombre: string;
  usuario_email: string;
  rol_codigo: string | null;
  rol_nombre: string | null;
  ip_address: string | null;
  geo_pais: string | null;
  geo_region: string | null;
  geo_ciudad: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  login_en: string;
  logout_en: string | null;
  duracion_segundos: number | null;
  motivo_salida: MotivoSalida;
  activo: boolean;
};

type UsuarioOpcion = { idUsuario: number; nombre: string; email: string };

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function haceDiasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-auditoria-sesiones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auditoria-sesiones.component.html',
  styleUrls: ['./auditoria-sesiones.component.scss']
})
export class AuditoriaSesionesComponent implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;
  private mapaPopup: L.Map | null = null;

  sesionMapaAbierta = signal<SesionAuditoria | null>(null);

  usuarios = signal<UsuarioOpcion[]>([]);
  sesiones = signal<SesionAuditoria[]>([]);
  loading = signal(false);
  errorMsg = signal('');
  buscado = signal(false);

  usuarioId = signal('');
  desde = signal(haceDiasISO(7));
  hasta = signal(hoyISO());

  seleccionadas = signal<Set<number>>(new Set());
  cerrandoSesiones = signal(false);

  // Filtros de texto aproximado por columna (coincidencia parcial, sin
  // distinguir mayúsculas), aplicados en el cliente sobre lo ya cargado.
  filtroUsuario = signal('');
  filtroRol = signal('');
  filtroIpUbicacion = signal('');
  filtroPais = signal('');
  filtroInicio = signal('');
  filtroCierre = signal('');
  filtroDuracion = signal('');
  filtroMotivo = signal('');

  hayFiltrosColumna = computed(() =>
    !!(this.filtroUsuario() || this.filtroRol() || this.filtroIpUbicacion() || this.filtroPais() ||
       this.filtroInicio() || this.filtroCierre() || this.filtroDuracion() || this.filtroMotivo())
  );

  sesionesFiltradas = computed(() => {
    const contiene = (valor: string, filtro: string) => valor.toLowerCase().includes(filtro.toLowerCase().trim());

    const fUsuario = this.filtroUsuario();
    const fRol = this.filtroRol();
    const fIp = this.filtroIpUbicacion();
    const fPais = this.filtroPais();
    const fInicio = this.filtroInicio();
    const fCierre = this.filtroCierre();
    const fDuracion = this.filtroDuracion();
    const fMotivo = this.filtroMotivo();

    return this.sesiones().filter(s => {
      if (fUsuario && !contiene(`${s.usuario_nombre} ${s.usuario_email}`, fUsuario)) return false;
      if (fRol && !contiene(s.rol_nombre || s.rol_codigo || '', fRol)) return false;
      if (fIp && !contiene(`${s.ip_address || ''} ${this.ubicacionTexto(s)}`, fIp)) return false;
      if (fPais && !contiene(s.geo_pais || '', fPais)) return false;
      if (fInicio && !contiene(this.formatoFecha(s.login_en), fInicio)) return false;
      if (fCierre && !contiene(s.logout_en ? this.formatoFecha(s.logout_en) : '-', fCierre)) return false;
      if (fDuracion && !contiene(this.formatoDuracion(s.duracion_segundos), fDuracion)) return false;
      if (fMotivo && !contiene(this.etiquetaMotivo(s.motivo_salida), fMotivo)) return false;
      return true;
    });
  });

  hayEnCurso = computed(() => this.sesionesFiltradas().some(s => s.motivo_salida === 'en_curso'));
  totalSeleccionadas = computed(() => this.seleccionadas().size);

  limpiarFiltrosColumna(): void {
    this.filtroUsuario.set('');
    this.filtroRol.set('');
    this.filtroIpUbicacion.set('');
    this.filtroPais.set('');
    this.filtroInicio.set('');
    this.filtroCierre.set('');
    this.filtroDuracion.set('');
    this.filtroMotivo.set('');
  }

  private formatoFecha(iso: string): string {
    return formatDate(iso, 'dd/MM/yyyy HH:mm', 'en-US');
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async ngOnInit(): Promise<void> {
    await this.cargarUsuarios();
    await this.buscar();
  }

  async cargarUsuarios(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/usuarios`, { headers: this.getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const lista = Array.isArray(data) ? data : (data.usuarios || []);
      this.usuarios.set(lista.map((u: any) => ({
        idUsuario: Number(u.idUsuario),
        nombre: u.nombre,
        email: u.email
      })));
    } catch (e) {
      console.error('Error al cargar usuarios:', e);
    }
  }

  async buscar(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set('');
    this.seleccionadas.set(new Set());
    this.limpiarFiltrosColumna();

    try {
      const params = new URLSearchParams();
      if (this.desde()) params.set('desde', this.desde());
      if (this.hasta()) params.set('hasta', this.hasta());
      if (this.usuarioId()) params.set('id_usuario', this.usuarioId());

      const res = await fetch(`${this.apiBaseUrl}/auditoria/sesiones?${params.toString()}`, {
        headers: this.getAuthHeaders()
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'No se pudo cargar la auditoría de sesiones.');
      }

      this.sesiones.set(Array.isArray(data) ? data : []);
      this.buscado.set(true);
    } catch (error: any) {
      this.errorMsg.set(error.message || 'Error de conexión al cargar la auditoría de sesiones.');
      this.sesiones.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  esSeleccionable(s: SesionAuditoria): boolean {
    return s.motivo_salida === 'en_curso';
  }

  estaSeleccionada(id: number): boolean {
    return this.seleccionadas().has(id);
  }

  toggleSeleccion(id: number): void {
    const actuales = new Set(this.seleccionadas());
    if (actuales.has(id)) {
      actuales.delete(id);
    } else {
      actuales.add(id);
    }
    this.seleccionadas.set(actuales);
  }

  toggleSeleccionarTodas(): void {
    const seleccionables = this.sesionesFiltradas().filter(s => this.esSeleccionable(s)).map(s => s.id);
    const todasSeleccionadas = seleccionables.length > 0 && seleccionables.every(id => this.seleccionadas().has(id));
    this.seleccionadas.set(todasSeleccionadas ? new Set() : new Set(seleccionables));
  }

  async cerrarSeleccionadas(): Promise<void> {
    const ids = Array.from(this.seleccionadas());
    if (ids.length === 0) return;
    if (!confirm(`¿Cerrar ${ids.length} sesión(es) activa(s)? El usuario deberá iniciar sesión nuevamente.`)) return;
    await this.ejecutarCierre(ids);
  }

  async cerrarSesionUnica(s: SesionAuditoria): Promise<void> {
    if (!confirm(`¿Cerrar la sesión activa de ${s.usuario_nombre}?`)) return;
    await this.ejecutarCierre([s.id]);
  }

  private async ejecutarCierre(ids: number[]): Promise<void> {
    this.cerrandoSesiones.set(true);
    this.errorMsg.set('');
    try {
      const res = await fetch(`${this.apiBaseUrl}/auditoria/sesiones/cerrar`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ ids })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'No se pudieron cerrar las sesiones.');
      }
      await this.buscar();
    } catch (error: any) {
      this.errorMsg.set(error.message || 'No se pudieron cerrar las sesiones.');
    } finally {
      this.cerrandoSesiones.set(false);
    }
  }

  ubicacionTexto(s: SesionAuditoria): string {
    const partes = [s.geo_ciudad, s.geo_region, s.geo_pais].filter(p => !!p && p.trim().length > 0);
    return partes.length > 0 ? partes.join(', ') : '-';
  }

  tieneCoordenadas(s: SesionAuditoria): boolean {
    return s.geo_lat != null && s.geo_lon != null;
  }

  abrirMapa(s: SesionAuditoria): void {
    if (!this.tieneCoordenadas(s)) return;
    this.sesionMapaAbierta.set(s);

    setTimeout(() => {
      if (this.mapaPopup) {
        this.mapaPopup.remove();
        this.mapaPopup = null;
      }

      const lat = Number(s.geo_lat);
      const lon = Number(s.geo_lon);

      this.mapaPopup = L.map('auditoria-mapa-popup').setView([lat, lon], 9);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.mapaPopup);

      L.circleMarker([lat, lon], {
        radius: 10,
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.85
      })
        .bindPopup(`<b>${this.ubicacionTexto(s)}</b><br>IP: ${s.ip_address || '-'}`)
        .addTo(this.mapaPopup)
        .openPopup();

      setTimeout(() => this.mapaPopup?.invalidateSize(), 150);
    }, 50);
  }

  cerrarMapa(): void {
    if (this.mapaPopup) {
      this.mapaPopup.remove();
      this.mapaPopup = null;
    }
    this.sesionMapaAbierta.set(null);
  }

  formatoDuracion(segundos: number | null): string {
    if (segundos == null) return '-';
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    if (horas > 0) return `${horas}h ${minutos}m`;
    if (minutos > 0) return `${minutos}m`;
    return '< 1m';
  }

  etiquetaMotivo(motivo: MotivoSalida): string {
    switch (motivo) {
      case 'en_curso': return 'En curso';
      case 'logout_usuario': return 'Cierre manual';
      case 'inactividad': return 'Inactividad';
      case 'token_invalido': return 'Token inválido';
      case 'expiracion_token': return 'Token expirado';
      case 'expiracion_automatica': return 'Expiración automática';
      case 'expirada_sin_cerrar': return 'Expirada sin cerrar';
      case 'cerrada_por_admin': return 'Cerrada por admin';
      default: return motivo;
    }
  }

  claseMotivo(motivo: MotivoSalida): string {
    switch (motivo) {
      case 'en_curso': return 'badge-en-curso';
      case 'logout_usuario': return 'badge-normal';
      case 'inactividad':
      case 'expirada_sin_cerrar': return 'badge-alerta';
      case 'token_invalido':
      case 'expiracion_token':
      case 'expiracion_automatica': return 'badge-normal';
      case 'cerrada_por_admin': return 'badge-forzada';
      default: return 'badge-normal';
    }
  }
}
