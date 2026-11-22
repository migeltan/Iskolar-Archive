import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter } from '@angular/router';
import { createClient } from '@supabase/supabase-js';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { SUPABASE_CLIENT } from './shared/storage/storage.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // App-wide icon font: Material Symbols Rounded (loaded in index.html).
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');
    }),
    provideRouter(routes),
    {
      provide: SUPABASE_CLIENT,
      useFactory: () => createClient(environment.supabaseUrl, environment.supabaseAnonKey),
    },
  ],
};
