import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-inactividad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inactividad.component.html',
  styleUrls: ['./inactividad.component.scss']
})
export class InactividadComponent {
  readonly sessionService = inject(SessionService);

  logout(): void {
    this.sessionService.cerrarSesion('logout_usuario');
  }

  extender(): void {
    this.sessionService.extenderSesion();
  }
}
