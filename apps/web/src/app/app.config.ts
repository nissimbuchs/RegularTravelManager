import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { responseInterceptor } from './core/interceptors/response.interceptor';
import { ConfigService } from './core/services/config.service';
import { TranslationService } from './core/services/translation.service';

// Factory function for APP_INITIALIZER
export function initializeApp(configService: ConfigService) {
  return (): Promise<void> => {
    return configService.loadConfig();
  };
}

// Factory function for translation initialization
export function initializeTranslations(translationService: TranslationService) {
  return (): Promise<void> => {
    // Trigger initial translation loading but don't block app startup
    try {
      translationService.getCurrentLanguage(); // This triggers initialization
    } catch (error) {
      console.warn('Translation service initialization error:', error);
    }

    // Always resolve immediately to prevent blocking
    return Promise.resolve();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(
      withInterceptors([loadingInterceptor, responseInterceptor, authInterceptor, errorInterceptor])
    ),
    // Initialize configuration before app starts
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [ConfigService],
      multi: true,
    },
    // Initialize translations before app starts
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTranslations,
      deps: [TranslationService],
      multi: true,
    },
  ],
};
