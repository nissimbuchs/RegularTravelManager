import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { SupportedLanguage, TranslationLoadResult } from '../types/translation.types';

/**
 * Service for loading translation JSON files with caching and performance optimization
 */
@Injectable({
  providedIn: 'root',
})
export class TranslationLoaderService {
  private cache = new Map<SupportedLanguage, { data: Record<string, any>; timestamp: number }>();
  private readonly CACHE_DURATION = 3600000; // 1 hour
  private readonly BASE_PATH = '/assets/i18n';

  constructor(private http: HttpClient) {}

  /**
   * Load translation file for specified language with intelligent caching
   * @param language Target language code
   * @returns Observable with translation data and metadata
   */
  loadTranslations(language: SupportedLanguage): Observable<TranslationLoadResult> {
    const startTime = Date.now();

    // Check cache first
    const cached = this.cache.get(language);
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`Translation cache hit for language: ${language}`);
      return of({
        language,
        translations: cached.data,
        loadTime: Date.now() - startTime,
      });
    }

    console.log(`Loading translations for language: ${language}`);

    return this.http
      .get<Record<string, any>>(`${this.BASE_PATH}/${language}.json`, {
        headers: {
          'Cache-Control': 'public, max-age=3600', // 1 hour browser cache
        },
      })
      .pipe(
        map(translations => ({
          language,
          translations,
          loadTime: Date.now() - startTime,
        })),
        tap(result => {
          // Cache the successful result
          this.cache.set(language, {
            data: result.translations,
            timestamp: Date.now(),
          });
          console.log(`Translations loaded for ${language} in ${result.loadTime}ms`);
        }),
        catchError(error => {
          console.error(`Failed to load translations for ${language}:`, error);
          // Return empty translations object as fallback
          return of({
            language,
            translations: {},
            loadTime: Date.now() - startTime,
          });
        })
      );
  }

  /**
   * Preload multiple translation files for performance
   * @param languages Array of languages to preload
   * @returns Observable array of load results
   */
  preloadTranslations(languages: SupportedLanguage[]): Observable<TranslationLoadResult[]> {
    const loadPromises = languages.map(lang =>
      this.loadTranslations(lang).toPromise().then(result => result!)
    );

    return new Observable(observer => {
      Promise.all(loadPromises)
        .then(results => {
          observer.next(results);
          observer.complete();
        })
        .catch(error => {
          console.error('Failed to preload translations:', error);
          observer.next([]);
          observer.complete();
        });
    });
  }

  /**
   * Clear translation cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Translation cache cleared');
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): Record<SupportedLanguage, boolean> {
    const status: Partial<Record<SupportedLanguage, boolean>> = {};
    (['de', 'fr', 'it', 'en'] as SupportedLanguage[]).forEach(lang => {
      const cached = this.cache.get(lang);
      status[lang] = cached ? this.isCacheValid(cached.timestamp) : false;
    });
    return status as Record<SupportedLanguage, boolean>;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }
}
