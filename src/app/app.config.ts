import {
  ApplicationConfig,
  importProvidersFrom,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { IonicStorageModule } from '@ionic/storage-angular';

import { routes } from './app.routes';
import { AppInitService } from './core/services/app-init.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideIonicAngular({
      mode: 'md'
    }),
    {
      provide: RouteReuseStrategy,
      useClass: IonicRouteStrategy
    },
    importProvidersFrom(IonicStorageModule.forRoot()),
    provideRouter(routes, withComponentInputBinding()),
    provideAppInitializer(() => inject(AppInitService).initialize())
  ]
};
