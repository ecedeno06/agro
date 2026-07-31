import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Sección aún no implementada (ej. Productos, Granos, Carnes).
 * El título/descripción se pasan por `data` en la ruta, así no hace
 * falta crear un componente nuevo por cada placeholder.
 */
@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container animate-in">
      <section class="glass-card">
        <h2>{{ titulo }}</h2>
        <p>{{ descripcion }}</p>
      </section>
    </div>
  `
})
export class PlaceholderComponent {
  @Input() titulo = '';
  @Input() descripcion = '';
}
