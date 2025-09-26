import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TranslationService } from '../translation.service';
import { TranslationLoaderService } from '../translation-loader.service';
import { LanguageService } from '../language.service';
import { SupportedLanguage } from '../../types/translation.types';

describe('TranslationService', () => {
  let service: TranslationService;
  let httpMock: HttpTestingController;
  let mockTranslationLoader: jasmine.SpyObj<TranslationLoaderService>;
  let mockLanguageService: jasmine.SpyObj<LanguageService>;

  const mockTranslations = {
    'common.buttons.save': 'Save',
    'common.buttons.cancel': 'Cancel',
    'employee.dashboard.title': 'Employee Dashboard',
    'employee.dashboard.welcome': 'Welcome, {{name}}',
  };

  beforeEach(() => {
    const translationLoaderSpy = jasmine.createSpyObj('TranslationLoaderService', [
      'loadTranslations',
      'getCacheStatus',
    ]);
    const languageServiceSpy = jasmine.createSpyObj(
      'LanguageService',
      ['getCurrentLanguage', 'setLanguage'],
      {
        currentLanguage$: jasmine.createSpy().and.returnValue({
          pipe: jasmine.createSpy().and.returnValue({ subscribe: jasmine.createSpy() }),
        }),
      }
    );

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TranslationService,
        { provide: TranslationLoaderService, useValue: translationLoaderSpy },
        { provide: LanguageService, useValue: languageServiceSpy },
      ],
    });

    service = TestBed.inject(TranslationService);
    httpMock = TestBed.inject(HttpTestingController);
    mockTranslationLoader = TestBed.inject(
      TranslationLoaderService
    ) as jasmine.SpyObj<TranslationLoaderService>;
    mockLanguageService = TestBed.inject(LanguageService) as jasmine.SpyObj<LanguageService>;

    // Setup default mock behavior
    mockLanguageService.getCurrentLanguage.and.returnValue('en' as SupportedLanguage);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('translateSync', () => {
    beforeEach(() => {
      // Set up mock translations
      (service as any).translations = {
        common: {
          buttons: {
            save: 'Save',
            cancel: 'Cancel',
          },
        },
        employee: {
          dashboard: {
            title: 'Employee Dashboard',
            welcome: 'Welcome, {{name}}',
          },
        },
      };
    });

    it('should return translated text for valid key', () => {
      const result = service.translateSync('common.buttons.save');
      expect(result).toBe('Save');
    });

    it('should return nested translation', () => {
      const result = service.translateSync('employee.dashboard.title');
      expect(result).toBe('Employee Dashboard');
    });

    it('should interpolate parameters', () => {
      const result = service.translateSync('employee.dashboard.welcome', { name: 'John' });
      expect(result).toBe('Welcome, John');
    });

    it('should return key when translation not found', () => {
      spyOn(console, 'warn');
      const result = service.translateSync('invalid.key');
      expect(result).toBe('invalid.key');
      expect(console.warn).toHaveBeenCalledWith('Translation key not found: invalid.key');
    });

    it('should handle missing parameters gracefully', () => {
      const result = service.translateSync('employee.dashboard.welcome', {});
      expect(result).toBe('Welcome, {{name}}');
    });

    it('should handle numeric parameters', () => {
      (service as any).translations.test = { count: 'Count: {{count}}' };
      const result = service.translateSync('test.count', { count: 42 });
      expect(result).toBe('Count: 42');
    });

    it('should handle boolean parameters', () => {
      (service as any).translations.test = { active: 'Active: {{active}}' };
      const result = service.translateSync('test.active', { active: true });
      expect(result).toBe('Active: true');
    });
  });

  describe('setLanguage', () => {
    it('should call language service setLanguage', () => {
      service.setLanguage('de');
      expect(mockLanguageService.setLanguage).toHaveBeenCalledWith('de');
    });
  });

  describe('getCurrentLanguage', () => {
    it('should return current language from language service', () => {
      const result = service.getCurrentLanguage();
      expect(result).toBe('en');
      expect(mockLanguageService.getCurrentLanguage).toHaveBeenCalled();
    });
  });

  describe('getDebugInfo', () => {
    beforeEach(() => {
      (service as any).translations = { test: { key: 'value' } };
      mockLanguageService.getCurrentLanguage.and.returnValue('fr' as SupportedLanguage);
      mockTranslationLoader.getCacheStatus.and.returnValue({
        de: true,
        fr: false,
        it: true,
        en: false,
      });
    });

    it('should return debug information', () => {
      const debugInfo = service.getDebugInfo();

      expect(debugInfo).toEqual({
        currentLanguage: 'fr',
        translationKeysCount: 1,
        isLoading: false,
        error: null,
        cacheStatus: {
          de: true,
          fr: false,
          it: true,
          en: false,
        },
      });
    });
  });

  describe('cleanup', () => {
    it('should complete destroy subject', () => {
      spyOn((service as any).destroy$, 'next');
      spyOn((service as any).destroy$, 'complete');

      service.cleanup();

      expect((service as any).destroy$.next).toHaveBeenCalled();
      expect((service as any).destroy$.complete).toHaveBeenCalled();
    });
  });

  describe('private methods', () => {
    describe('getNestedTranslation', () => {
      beforeEach(() => {
        (service as any).translations = {
          level1: {
            level2: {
              level3: 'deep value',
            },
          },
        };
      });

      it('should get nested translation', () => {
        const result = (service as any).getNestedTranslation('level1.level2.level3');
        expect(result).toBe('deep value');
      });

      it('should return null for invalid path', () => {
        const result = (service as any).getNestedTranslation('invalid.path');
        expect(result).toBeNull();
      });

      it('should return null for partial path', () => {
        const result = (service as any).getNestedTranslation('level1.level2.invalid');
        expect(result).toBeNull();
      });
    });

    describe('interpolateParameters', () => {
      it('should interpolate single parameter', () => {
        const result = (service as any).interpolateParameters('Hello {{name}}', { name: 'World' });
        expect(result).toBe('Hello World');
      });

      it('should interpolate multiple parameters', () => {
        const result = (service as any).interpolateParameters(
          '{{greeting}} {{name}}, you have {{count}} messages',
          { greeting: 'Hello', name: 'John', count: 5 }
        );
        expect(result).toBe('Hello John, you have 5 messages');
      });

      it('should leave unmatched placeholders', () => {
        const result = (service as any).interpolateParameters('Hello {{name}}', { other: 'value' });
        expect(result).toBe('Hello {{name}}');
      });

      it('should handle undefined values', () => {
        const result = (service as any).interpolateParameters('Hello {{name}}', {
          name: undefined,
        });
        expect(result).toBe('Hello {{name}}');
      });
    });

    describe('countTranslationKeys', () => {
      it('should count flat object keys', () => {
        const count = (service as any).countTranslationKeys({ a: '1', b: '2', c: '3' });
        expect(count).toBe(3);
      });

      it('should count nested object keys recursively', () => {
        const count = (service as any).countTranslationKeys({
          level1: {
            a: '1',
            b: '2',
            level2: {
              c: '3',
              d: '4',
            },
          },
          e: '5',
        });
        expect(count).toBe(5);
      });

      it('should handle empty object', () => {
        const count = (service as any).countTranslationKeys({});
        expect(count).toBe(0);
      });
    });
  });
});
