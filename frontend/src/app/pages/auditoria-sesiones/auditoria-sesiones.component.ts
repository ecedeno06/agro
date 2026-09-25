import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  hayEnCurso = computed(() => this.sesiones().some(s => s.motivo_salida === 'en_curso'));
  totalSeleccionadas = computed(() => this.seleccionadas().size);

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
    const seleccionables = this.sesiones().filter(s => this.esSeleccionable(s)).map(s => s.id);
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
