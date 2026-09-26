import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../core/services/session.service';
import { DireccionesComponent } from './direcciones/direcciones.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, DireccionesComponent],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss']
})
export class PerfilComponent implements OnInit {
  private readonly sessionService = inject(SessionService);
  // Antes llegaba por @Input desde el dashboard; ahora se lee directo del servicio central.
  readonly user = this.sessionService.user;

  private readonly apiBaseUrl = environment.apiUrl;

  // Estados de carga e información para cuotas
  loadingCuotas = signal(false);
  errorCuotasMsg = signal('');
  successCuotasMsg = signal('');

  // Sección Cuotas
  cuotas = signal<any[]>([]);
  capitulos = signal<any[]>([]);
  selectedYear = signal<number>(new Date().getFullYear());
  selectedCapitulo = signal<number | null>(null);
  readonly availableYears = [2026, 2025, 2024, 2023];
  readonly mesesAno = [
    { numero: 1, nombre: 'Enero' },
    { numero: 2, nombre: 'Febrero' },
    { numero: 3, nombre: 'Marzo' },
    { numero: 4, nombre: 'Abril' },
    { numero: 5, nombre: 'Mayo' },
    { numero: 6, nombre: 'Junio' },
    { numero: 7, nombre: 'Julio' },
    { numero: 8, nombre: 'Agosto' },
    { numero: 9, nombre: 'Septiembre' },
    { numero: 10, nombre: 'Octubre' },
    { numero: 11, nombre: 'Noviembre' },
    { numero: 12, nombre: 'Diciembre' }
  ];

  // Formulario registrar pago
  readonly showRegistrarPago = signal(false);
  readonly nuevoPago = {
    id_capitulo: null as number | null,
    monto: 10.00,
    mes_periodo: new Date().getMonth() + 1,
    anio_periodo: new Date().getFullYear(),
    metodo_pago: 'Transferencia',
    referencia_pago: '',
    observaciones: ''
  };

  // --- Pestañas de la página de perfil ---
  readonly activeTab = signal<'perfil' | 'direcciones' | 'cuotas'>('perfil');

  // --- Edición de datos personales (ahora inline en la pestaña "Perfil", sin modal) ---
  readonly editLoading = signal(false);
  readonly editError = signal('');
  readonly editSuccess = signal('');

  readonly editForm = {
    nombre: '',
    telefono: '',
    telefono_whatsapp: false,
    direccion: '',
    ocupacion: '',
    fecha_nacimiento: '',
    tipo_sangre: '',
    tipo_persona: 'natural',
    dni: ''
  };

  readonly tiposSangre = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  /** Carga (o recarga) el formulario con los datos actuales de la sesión. */
  inicializarFormularioPerfil(): void {
    const u = this.user();
    this.editForm.nombre = u?.nombre || '';
    this.editForm.telefono = u?.telefono || '';
    this.editForm.telefono_whatsapp = !!u?.telefonoWhatsapp;
    this.editForm.direccion = u?.direccion || '';
    this.editForm.ocupacion = u?.ocupacion || '';
    this.editForm.fecha_nacimiento = (u?.fechaNacimiento || '').toString().substring(0, 10);
    this.editForm.tipo_sangre = u?.tipoSangre || '';
    this.editForm.tipo_persona = u?.tipoPersona || 'natural';
    this.editForm.dni = u?.dni || '';
    this.editError.set('');
    this.editSuccess.set('');
  }

  async guardarPerfil(): Promise<void> {
    if (!this.editForm.nombre.trim() || this.editLoading()) return;

    this.editLoading.set(true);
    this.editError.set('');
    this.editSuccess.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/usuarios/perfil`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(this.editForm)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar el perfil.');
      }

      // Fusiona lo devuelto por el backend con el usuario en sesión (conserva
      // campos que este formulario no toca, ej. avatar, twoFactorEnabled).
      this.sessionService.setUser({ ...this.user(), ...data.usuario });
      this.editSuccess.set('Perfil actualizado exitosamente.');
    } catch (error: any) {
      this.editError.set(error.message || 'Error de conexión.');
    } finally {
      this.editLoading.set(false);
    }
  }

  // Determinar si el usuario logueado tiene el rol de Asociado ('aso')
  readonly esAsociado = computed(() => {
    const activeUser = this.user();
    if (!activeUser) return false;

    const roleValues = [
      activeUser.rol,
      activeUser.rolCodigo,
      activeUser.codigo_rol,
      activeUser.codigo
    ].map(r => String(r || '').trim().toLowerCase());

    return roleValues.some(r => r === 'aso' || r === 'asociado');
  });

  // Mapear el estado mensual de cuotas (Pagado o Pendiente)
  readonly cuotasMensuales = computed(() => {
    const listaCuotas = this.cuotas();
    return this.mesesAno.map(mes => {
      const pago = listaCuotas.find(c => 
        c.mes_periodo === mes.numero && 
        Number(c.anio_periodo) === Number(this.selectedYear()) &&
        (this.selectedCapitulo() === null || Number(c.id_capitulo) === Number(this.selectedCapitulo()))
      );
      return {
        ...mes,
        pagado: !!pago,
        detalle: pago || null
      };
    });
  });

  ngOnInit(): void {
    this.inicializarFormularioPerfil();
    if (this.esAsociado()) {
      this.cargarCapitulos();
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('agro_session_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async cargarCapitulos(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/cuotas/capitulos`, {
        headers: this.getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        this.capitulos.set(data);
        if (data.length > 0) {
          this.selectedCapitulo.set(data[0].id_capitulo);
          this.nuevoPago.id_capitulo = data[0].id_capitulo;
          this.cargarCuotas();
        }
      }
    } catch (error) {
      console.error('Error al cargar capítulos asociados:', error);
    }
  }

  async cargarCuotas(): Promise<void> {
    this.loadingCuotas.set(true);
    this.errorCuotasMsg.set('');
    
    let url = `${this.apiBaseUrl}/cuotas?anio=${this.selectedYear()}`;
    if (this.selectedCapitulo()) {
      url += `&capitulo=${this.selectedCapitulo()}`;
    }

    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error('Error al obtener el historial de cuotas');
      }
      const data = await response.json();
      this.cuotas.set(data);
    } catch (error: any) {
      this.errorCuotasMsg.set(error.message || 'Error de conexión');
    } finally {
      this.loadingCuotas.set(false);
    }
  }

  async registrarPago(): Promise<void> {
    if (!this.nuevoPago.id_capitulo || !this.nuevoPago.monto || this.loadingCuotas()) return;
    this.loadingCuotas.set(true);
    this.errorCuotasMsg.set('');
    this.successCuotasMsg.set('');

    try {
      const response = await fetch(`${this.apiBaseUrl}/cuotas`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(this.nuevoPago)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al registrar pago de cuota.');
      }

      this.successCuotasMsg.set('Pago de cuota registrado con éxito.');
      this.showRegistrarPago.set(false);
      await this.cargarCuotas();
    } catch (error: any) {
      this.errorCuotasMsg.set(error.message || 'Error de red');
    } finally {
      this.loadingCuotas.set(false);
    }
  }
}
