import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // withComponentInputBinding permite pasar `route.data` como @Input() a los componentes (ej. PlaceholderComponent)
    provideRouter(routes, withComponentInputBinding())
  ]
};
