import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { SupportedLanguage, TranslationParameters } from '../types/translation.types';
import { TranslationLoaderService } from './translation-loader.service';
import { LanguageService } from './language.service';

/**
 * Core synchronous translation service for JSON-based runtime translation
 */
@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private translations: Record<string, any> = {};
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private destroy$ = new Subject<void>();

  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public currentLanguage$ = this.languageService.currentLanguage$;

  constructor(
    private translationLoader: TranslationLoaderService,
    private languageService: LanguageService
  ) {
    this.initializeTranslations();
  }

  /**
   * Synchronous translation method - core implementation
   * @param key Translation key (e.g., 'employee.dashboard.title')
   * @param params Optional parameters for string interpolation
   * @returns Translated string or fallback
   */
  translateSync(key: string, params?: TranslationParameters): string {
    // If translations are not loaded yet, trigger loading but don't wait
    if (Object.keys(this.translations).length === 0) {
      const currentLanguage = this.languageService.getCurrentLanguage();
      if (!this.loadingSubject.value) {
        this.loadTranslationsForLanguage(currentLanguage);
      }
    }

    const translation = this.getNestedTranslation(key);

    if (!translation) {
      // Only log missing keys if translations are actually loaded
      if (Object.keys(this.translations).length > 0) {
        console.warn(`Translation key not found: ${key}`);
      }
      return key; // Fallback to key
    }

    return params ? this.interpolateParameters(translation, params) : translation;
  }

  /**
   * Language switching with immediate effect
   * @param language Target language code
   */
  setLanguage(language: SupportedLanguage): void {
    this.languageService.setLanguage(language);
    this.loadTranslationsForLanguage(language);
  }

  /**
   * Get current language synchronously
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.languageService.getCurrentLanguage();
  }

  /**
   * Initialize translation system
   */
  private initializeTranslations(): void {
    // Load initial language
    const currentLanguage = this.languageService.getCurrentLanguage();
    this.loadTranslationsForLanguage(currentLanguage);

    // Subscribe to language changes
    this.languageService.currentLanguage$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(language => {
          this.loadingSubject.next(true);
          this.errorSubject.next(null);
          return this.translationLoader.loadTranslations(language);
        })
      )
      .subscribe({
        next: result => {
          this.translations = result.translations;
          this.loadingSubject.next(false);
          console.log(`Translations loaded for ${result.language} in ${result.loadTime}ms`);
        },
        error: error => {
          console.error('Failed to load translations:', error);
          this.errorSubject.next('Failed to load translations');
          this.loadingSubject.next(false);
        },
      });
  }

  /**
   * Load translations for specific language
   * @param language Target language
   */
  private loadTranslationsForLanguage(language: SupportedLanguage): void {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    this.translationLoader.loadTranslations(language).subscribe({
      next: result => {
        this.translations = result.translations;
        this.loadingSubject.next(false);
      },
      error: error => {
        console.error('Failed to load translations:', error);
        this.errorSubject.next('Failed to load translations');
        this.loadingSubject.next(false);
      },
    });
  }

  /**
   * Get nested translation value from dot-notation key
   * @param key Dot-notation key (e.g., 'common.buttons.save')
   * @returns Translation string or null if not found
   */
  private getNestedTranslation(key: string): string | null {
    const result = key.split('.').reduce((obj, k) => obj?.[k], this.translations);
    return typeof result === 'string' ? result : null;
  }

  /**
   * Interpolate parameters in translation string
   * @param template Translation template with {{param}} placeholders
   * @param params Parameter values
   * @returns Interpolated string
   */
  private interpolateParameters(template: string, params: TranslationParameters): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
      const value = params[paramName];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Cleanup method for service destruction
   */
  public cleanup(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Get debug information about current state
   */
  getDebugInfo(): Record<string, any> {
    return {
      currentLanguage: this.languageService.getCurrentLanguage(),
      translationKeysCount: this.countTranslationKeys(this.translations),
      isLoading: this.loadingSubject.value,
      error: this.errorSubject.value,
      cacheStatus: this.translationLoader.getCacheStatus(),
    };
  }

  /**
   * Count total translation keys recursively
   * @param obj Translation object
   * @returns Total key count
   */
  private countTranslationKeys(obj: any): number {
    let count = 0;
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        count += this.countTranslationKeys(obj[key]);
      } else {
        count++;
      }
    }
    return count;
  }
}
