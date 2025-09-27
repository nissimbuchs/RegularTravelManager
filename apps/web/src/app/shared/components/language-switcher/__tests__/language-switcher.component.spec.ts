import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { LanguageSwitcherComponent } from '../language-switcher.component';
import { TranslationService } from '../../../core/services/translation.service';
import { LanguageService } from '../../../core/services/language.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { SupportedLanguage, LANGUAGE_INFO } from '../../../core/types/translation.types';

describe('LanguageSwitcherComponent', () => {
  let component: LanguageSwitcherComponent;
  let fixture: ComponentFixture<LanguageSwitcherComponent>;
  let mockTranslationService: jasmine.SpyObj<TranslationService>;
  let mockLanguageService: jasmine.SpyObj<LanguageService>;
  let mockCurrentLanguageSubject: BehaviorSubject<SupportedLanguage>;

  beforeEach(async () => {
    mockCurrentLanguageSubject = new BehaviorSubject<SupportedLanguage>('en');

    const translationServiceSpy = jasmine.createSpyObj('TranslationService', [
      'translateSync',
      'setLanguage',
    ]);

    const languageServiceSpy = jasmine.createSpyObj('LanguageService', ['setLanguage'], {
      currentLanguage$: mockCurrentLanguageSubject.asObservable(),
    });

    await TestBed.configureTestingModule({
      imports: [CommonModule, ClickOutsideDirective, LanguageSwitcherComponent],
      providers: [
        { provide: TranslationService, useValue: translationServiceSpy },
        { provide: LanguageService, useValue: languageServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSwitcherComponent);
    component = fixture.componentInstance;
    mockTranslationService = TestBed.inject(
      TranslationService
    ) as jasmine.SpyObj<TranslationService>;
    mockLanguageService = TestBed.inject(LanguageService) as jasmine.SpyObj<LanguageService>;

    // Setup default translation mock
    mockTranslationService.translateSync.and.returnValue('Select Language');

    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.currentLanguage).toBe('en');
      expect(component.supportedLanguages).toEqual(LANGUAGE_INFO);
      expect(component.isDropdownOpen).toBeFalse();
    });

    it('should subscribe to language changes', () => {
      mockCurrentLanguageSubject.next('de');
      expect(component.currentLanguage).toBe('de');
    });
  });

  describe('Language Button', () => {
    it('should display current language', () => {
      const languageButton = fixture.debugElement.query(By.css('.language-button'));
      const languageName = languageButton.query(By.css('.language-name'));

      expect(languageName.nativeElement.textContent.trim()).toBe('English');
    });

    it('should display flag for current language', () => {
      const flagImg = fixture.debugElement.query(By.css('.language-button .flag-icon'));
      expect(flagImg.nativeElement.src).toContain('/assets/images/flags/ch-en.svg');
      expect(flagImg.nativeElement.alt).toBe('English');
    });

    it('should toggle dropdown when clicked', () => {
      const languageButton = fixture.debugElement.query(By.css('.language-button'));

      expect(component.isDropdownOpen).toBeFalse();

      languageButton.nativeElement.click();
      fixture.detectChanges();

      expect(component.isDropdownOpen).toBeTrue();

      languageButton.nativeElement.click();
      fixture.detectChanges();

      expect(component.isDropdownOpen).toBeFalse();
    });

    it('should show arrow rotation when dropdown is open', () => {
      component.isDropdownOpen = true;
      fixture.detectChanges();

      const arrow = fixture.debugElement.query(By.css('.dropdown-arrow'));
      expect(arrow.nativeElement.classList).toContain('rotated');
    });
  });

  describe('Language Dropdown', () => {
    beforeEach(() => {
      component.isDropdownOpen = true;
      fixture.detectChanges();
    });

    it('should show all supported languages', () => {
      const languageOptions = fixture.debugElement.queryAll(By.css('.language-option'));
      expect(languageOptions.length).toBe(4); // de, fr, it, en
    });

    it('should mark current language as selected', () => {
      const selectedOption = fixture.debugElement.query(By.css('.language-option.selected'));
      expect(selectedOption).toBeTruthy();

      const languageName = selectedOption.query(By.css('.language-name'));
      expect(languageName.nativeElement.textContent.trim()).toBe('English');
    });

    it('should show selected icon for current language', () => {
      const selectedOption = fixture.debugElement.query(By.css('.language-option.selected'));
      const selectedIcon = selectedOption.query(By.css('.selected-icon'));
      expect(selectedIcon).toBeTruthy();
    });

    it('should call selectLanguage when option clicked', () => {
      spyOn(component, 'selectLanguage');
      const germanOption = fixture.debugElement.queryAll(By.css('.language-option'))[0];

      germanOption.nativeElement.click();

      expect(component.selectLanguage).toHaveBeenCalledWith('de');
    });

    it('should close dropdown after language selection', () => {
      const germanOption = fixture.debugElement.queryAll(By.css('.language-option'))[0];

      germanOption.nativeElement.click();
      fixture.detectChanges();

      expect(component.isDropdownOpen).toBeFalse();
    });
  });

  describe('Language Selection', () => {
    it('should change language through translation service', () => {
      component.selectLanguage('fr');

      expect(mockTranslationService.setLanguage).toHaveBeenCalledWith('fr');
    });

    it('should not call setLanguage if same language selected', () => {
      component.selectLanguage('en');

      expect(mockTranslationService.setLanguage).not.toHaveBeenCalled();
    });

    it('should close dropdown after selection', () => {
      component.isDropdownOpen = true;
      component.selectLanguage('de');

      expect(component.isDropdownOpen).toBeFalse();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should toggle dropdown on Enter key', () => {
      const languageButton = fixture.debugElement.query(By.css('.language-button'));
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

      spyOn(enterEvent, 'preventDefault');
      spyOn(component, 'toggleDropdown');

      languageButton.nativeElement.dispatchEvent(enterEvent);

      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(component.toggleDropdown).toHaveBeenCalled();
    });

    it('should toggle dropdown on Space key', () => {
      const languageButton = fixture.debugElement.query(By.css('.language-button'));
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });

      spyOn(spaceEvent, 'preventDefault');
      spyOn(component, 'toggleDropdown');

      languageButton.nativeElement.dispatchEvent(spaceEvent);

      expect(spaceEvent.preventDefault).toHaveBeenCalled();
      expect(component.toggleDropdown).toHaveBeenCalled();
    });

    it('should close dropdown on Escape key', () => {
      component.isDropdownOpen = true;
      const languageButton = fixture.debugElement.query(By.css('.language-button'));
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });

      languageButton.nativeElement.dispatchEvent(escapeEvent);

      expect(component.isDropdownOpen).toBeFalse();
    });

    it('should select language on Enter key in dropdown option', () => {
      component.isDropdownOpen = true;
      fixture.detectChanges();

      spyOn(component, 'selectLanguage');

      const germanOption = fixture.debugElement.queryAll(By.css('.language-option'))[0];
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

      spyOn(enterEvent, 'preventDefault');

      germanOption.nativeElement.dispatchEvent(enterEvent);

      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(component.selectLanguage).toHaveBeenCalledWith('de');
    });
  });

  describe('Click Outside', () => {
    it('should close dropdown when clicking outside', () => {
      component.isDropdownOpen = true;
      component.closeDropdown();

      expect(component.isDropdownOpen).toBeFalse();
    });
  });

  describe('Helper Methods', () => {
    it('should return correct flag path', () => {
      const flagPath = component.getFlagPath('de');
      expect(flagPath).toBe('/assets/images/flags/ch-de.svg');
    });

    it('should return correct language name', () => {
      const languageName = component.getLanguageName('fr');
      expect(languageName).toBe('Français');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const languageButton = fixture.debugElement.query(By.css('.language-button'));

      expect(languageButton.nativeElement.getAttribute('aria-expanded')).toBe('false');
      expect(languageButton.nativeElement.getAttribute('aria-haspopup')).toBe('listbox');
      expect(languageButton.nativeElement.getAttribute('aria-label')).toBe('Select Language');
    });

    it('should update aria-expanded when dropdown opens', () => {
      component.isDropdownOpen = true;
      fixture.detectChanges();

      const languageButton = fixture.debugElement.query(By.css('.language-button'));
      expect(languageButton.nativeElement.getAttribute('aria-expanded')).toBe('true');
    });

    it('should have proper role attributes in dropdown', () => {
      component.isDropdownOpen = true;
      fixture.detectChanges();

      const dropdown = fixture.debugElement.query(By.css('.language-dropdown'));
      const options = fixture.debugElement.queryAll(By.css('.language-option'));

      expect(dropdown.nativeElement.getAttribute('role')).toBe('listbox');
      options.forEach(option => {
        expect(option.nativeElement.getAttribute('role')).toBe('option');
      });
    });

    it('should set aria-selected for current language', () => {
      component.isDropdownOpen = true;
      fixture.detectChanges();

      const selectedOption = fixture.debugElement.query(By.css('.language-option.selected'));
      expect(selectedOption.nativeElement.getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('Component Cleanup', () => {
    it('should unsubscribe on destroy', () => {
      spyOn((component as any).destroy$, 'next');
      spyOn((component as any).destroy$, 'complete');

      component.ngOnDestroy();

      expect((component as any).destroy$.next).toHaveBeenCalled();
      expect((component as any).destroy$.complete).toHaveBeenCalled();
    });
  });
});
