import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { MonitoreoComponent } from './pages/monitoreo/monitoreo.component';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { SeguridadComponent } from './pages/seguridad/seguridad.component';
import { MisFincasComponent } from './pages/mis-fincas/mis-fincas.component';
import { UsuariosComponent } from './pages/usuarios/usuarios.component';
import { MantenimientoComponent } from './pages/mantenimiento/mantenimiento.component';
import { TipoSuelosComponent } from './pages/tipo-suelos/tipo-suelos.component';
import { TipoTerrenoComponent } from './pages/tipo-terreno/tipo-terreno.component';
import { TipoGeografiaComponent } from './pages/tipo-geografia/tipo-geografia.component';
import { TipoEstadoLegalComponent } from './pages/tipo-estado-legal/tipo-estado-legal.component';
import { PaisesComponent } from './pages/paises/paises.component';
import { FenomenosComponent } from './pages/fenomenos/fenomenos.component';
import { MapaFincasComponent } from './pages/mapa-fincas/mapa-fincas.component';
import { AuditoriaSesionesComponent } from './pages/auditoria-sesiones/auditoria-sesiones.component';
import { PlaceholderComponent } from './pages/placeholder/placeholder.component';
import { authGuard, publicGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [publicGuard] },
  {
    path: 'dashboard',
    component: DashboardComponent, // shell: sidebar + topbar + <router-outlet>
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'monitoreo', pathMatch: 'full' },
      { path: 'monitoreo', component: MonitoreoComponent },
      { path: 'perfil', component: PerfilComponent },
      { path: 'seguridad', component: SeguridadComponent },
      { path: 'mis-fincas', component: MisFincasComponent },
      { path: 'tipo-suelos', component: TipoSuelosComponent },
      { path: 'tipo-terreno', component: TipoTerrenoComponent },
      { path: 'tipo-geografia', component: TipoGeografiaComponent },
      { path: 'tipo-estado-legal', component: TipoEstadoLegalComponent },
      { path: 'paises', component: PaisesComponent },
      { path: 'fenomenos', component: FenomenosComponent },
      { path: 'mapafincas', component: MapaFincasComponent },

      // Solo administración
      { path: 'usuarios', component: UsuariosComponent, canActivate: [adminGuard] },
      { path: 'roles-permisos', component: MantenimientoComponent, canActivate: [adminGuard] },
      { path: 'auditoria-sesiones', component: AuditoriaSesionesComponent, canActivate: [adminGuard] },

      // Secciones aún no implementadas (antes eran texto quemado en el dashboard)
      { path: 'productos', component: PlaceholderComponent, data: { titulo: 'Productos', descripcion: 'Gestión de productos disponibles.' } },
      { path: 'granos', component: PlaceholderComponent, data: { titulo: 'Granos', descripcion: 'Listado y gestión de granos.' } },
      { path: 'carnes', component: PlaceholderComponent, data: { titulo: 'Carnes', descripcion: 'Listado y gestión de carnes.' } },
    ]
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
