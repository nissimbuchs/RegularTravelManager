/**
 * Translation system type definitions for synchronous JSON-based translation
 */

export type SupportedLanguage = 'de' | 'fr' | 'it' | 'en';

export interface TranslationParameters {
  [key: string]: string | number | boolean;
}

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  flag: string;
}

export interface TranslationLoadResult {
  language: SupportedLanguage;
  translations: Record<string, any>;
  loadTime: number;
}

export interface TranslationConfig {
  supportedLanguages: SupportedLanguage[];
  defaultLanguage: SupportedLanguage;
  fallbackLanguage: SupportedLanguage;
  swissLocales: string[];
  cacheTimeout: number;
}

export const TRANSLATION_CONFIG: TranslationConfig = {
  supportedLanguages: ['de', 'fr', 'it', 'en'],
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  swissLocales: ['de-CH', 'fr-CH', 'it-CH'],
  cacheTimeout: 3600000, // 1 hour in milliseconds
};

export const LANGUAGE_INFO: Record<SupportedLanguage, LanguageInfo> = {
  de: { code: 'de', name: 'Deutsch', flag: 'ch-de' },
  fr: { code: 'fr', name: 'Français', flag: 'ch-fr' },
  it: { code: 'it', name: 'Italiano', flag: 'ch-it' },
  en: { code: 'en', name: 'English', flag: 'ch-en' },
};
