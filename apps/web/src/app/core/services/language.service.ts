import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupportedLanguage, TRANSLATION_CONFIG, LANGUAGE_INFO } from '../types/translation.types';

/**
 * Enhanced language service for state management and persistence
 */
@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly STORAGE_KEY = 'rtm_preferred_language';
  private currentLanguageSubject = new BehaviorSubject<SupportedLanguage>(
    TRANSLATION_CONFIG.defaultLanguage
  );

  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor() {
    this.initializeLanguage();
  }

  /**
   * Get current language synchronously
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguageSubject.value;
  }

  /**
   * Set current language with persistence
   * @param language Target language code
   */
  setLanguage(language: SupportedLanguage): void {
    if (!this.isLanguageSupported(language)) {
      console.warn(
        `Unsupported language: ${language}, falling back to ${TRANSLATION_CONFIG.fallbackLanguage}`
      );
      language = TRANSLATION_CONFIG.fallbackLanguage;
    }

    this.currentLanguageSubject.next(language);
    this.persistLanguage(language);
    console.log(`Language changed to: ${language}`);
  }

  /**
   * Get all supported languages with metadata
   */
  getSupportedLanguages(): typeof LANGUAGE_INFO {
    return LANGUAGE_INFO;
  }

  /**
   * Get supported language codes
   */
  getSupportedLanguageCodes(): SupportedLanguage[] {
    return TRANSLATION_CONFIG.supportedLanguages;
  }

  /**
   * Detect browser language with Swiss locale priority
   * @returns Best matching supported language
   */
  detectBrowserLanguage(): SupportedLanguage {
    const browserLanguages = navigator.languages || [navigator.language];

    console.log('Browser languages detected:', browserLanguages);

    // First priority: Swiss locales
    for (const browserLang of browserLanguages) {
      if (TRANSLATION_CONFIG.swissLocales.includes(browserLang)) {
        const langCode = browserLang.split('-')[0] as SupportedLanguage;
        if (this.isLanguageSupported(langCode)) {
          console.log(`Swiss locale detected: ${browserLang} -> ${langCode}`);
          return langCode;
        }
      }
    }

    // Second priority: Exact language matches
    for (const browserLang of browserLanguages) {
      const langCode = browserLang.split('-')[0] as SupportedLanguage;
      if (this.isLanguageSupported(langCode)) {
        console.log(`Browser language detected: ${browserLang} -> ${langCode}`);
        return langCode;
      }
    }

    console.log(
      `No supported browser language found, using fallback: ${TRANSLATION_CONFIG.fallbackLanguage}`
    );
    return TRANSLATION_CONFIG.fallbackLanguage;
  }

  /**
   * Initialize language on service startup
   */
  private initializeLanguage(): void {
    // Priority: Stored preference > Browser detection > Default
    const storedLanguage = this.getStoredLanguage();
    const detectedLanguage = this.detectBrowserLanguage();

    const initialLanguage = storedLanguage || detectedLanguage;

    console.log(
      `Language initialization: stored=${storedLanguage}, detected=${detectedLanguage}, final=${initialLanguage}`
    );

    this.setLanguage(initialLanguage);
  }

  /**
   * Check if language is supported
   * @param language Language code to check
   */
  private isLanguageSupported(language: string): language is SupportedLanguage {
    return TRANSLATION_CONFIG.supportedLanguages.includes(language as SupportedLanguage);
  }

  /**
   * Persist language preference to localStorage
   * @param language Language to persist
   */
  private persistLanguage(language: SupportedLanguage): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, language);
    } catch (error) {
      console.warn('Failed to persist language preference:', error);
    }
  }

  /**
   * Retrieve stored language preference
   * @returns Stored language or null if not found/invalid
   */
  private getStoredLanguage(): SupportedLanguage | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored && this.isLanguageSupported(stored)) {
        return stored as SupportedLanguage;
      }
    } catch (error) {
      console.warn('Failed to retrieve language preference:', error);
    }
    return null;
  }
}
