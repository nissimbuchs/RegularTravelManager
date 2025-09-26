import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SupportedLanguage, LANGUAGE_INFO } from '../../../core/types/translation.types';
import { TranslationService } from '../../../core/services/translation.service';
import { LanguageService } from '../../../core/services/language.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

/**
 * Language switcher component with Swiss flag icons and proper accessibility
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, ClickOutsideDirective],
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss'],
})
export class LanguageSwitcherComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentLanguage: SupportedLanguage = 'en';
  supportedLanguages = LANGUAGE_INFO;
  isDropdownOpen = false;

  constructor(
    public translationService: TranslationService,
    private languageService: LanguageService
  ) {}

  ngOnInit(): void {
    // Subscribe to language changes
    this.languageService.currentLanguage$.pipe(takeUntil(this.destroy$)).subscribe(language => {
      this.currentLanguage = language;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Toggle dropdown visibility
   */
  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  /**
   * Select a language and close dropdown
   * @param language Selected language code
   */
  selectLanguage(language: SupportedLanguage): void {
    if (language !== this.currentLanguage) {
      this.translationService.setLanguage(language);
    }
    this.isDropdownOpen = false;
  }

  /**
   * Close dropdown when clicking outside
   */
  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  /**
   * Handle keyboard navigation
   * @param event Keyboard event
   */
  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.toggleDropdown();
        break;
      case 'Escape':
        this.closeDropdown();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.focusNextLanguage();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusPreviousLanguage();
        break;
    }
  }

  /**
   * Handle language selection via keyboard
   * @param event Keyboard event
   * @param language Language to select
   */
  onLanguageKeyDown(event: KeyboardEvent, language: SupportedLanguage): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectLanguage(language);
    }
  }

  /**
   * Get flag asset path for language
   * @param language Language code
   * @returns Flag SVG path
   */
  getFlagPath(language: SupportedLanguage): string {
    return `/assets/images/flags/${LANGUAGE_INFO[language].flag}.svg`;
  }

  /**
   * Get language display name
   * @param language Language code
   * @returns Localized language name
   */
  getLanguageName(language: SupportedLanguage): string {
    return LANGUAGE_INFO[language].name;
  }

  /**
   * Helper method to cast string to SupportedLanguage type
   * Used in template for keyvalue pipe results
   * @param key String key from keyvalue pipe
   * @returns SupportedLanguage type
   */
  asLanguage(key: string): SupportedLanguage {
    return key as SupportedLanguage;
  }

  /**
   * Focus next language in dropdown (for keyboard navigation)
   */
  private focusNextLanguage(): void {
    // Implementation for keyboard navigation would go here
    // This is a basic implementation - could be enhanced with more sophisticated focus management
  }

  /**
   * Focus previous language in dropdown (for keyboard navigation)
   */
  private focusPreviousLanguage(): void {
    // Implementation for keyboard navigation would go here
    // This is a basic implementation - could be enhanced with more sophisticated focus management
  }
}
