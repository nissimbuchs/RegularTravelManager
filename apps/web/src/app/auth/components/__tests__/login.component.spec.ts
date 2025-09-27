import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { LoginComponent } from '../login.component';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslationLoaderService } from '../../../core/services/translation-loader.service';
import { LanguageService } from '../../../core/services/language.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockLoadingService: jasmine.SpyObj<LoadingService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['login', 'getCurrentUser'], {
      isAuthenticated$: of(false),
    });

    const loadingServiceSpy = jasmine.createSpyObj('LoadingService', ['setLoading'], {
      loading$: of(false),
    });

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule, NoopAnimationsModule, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: LoadingService, useValue: loadingServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
        TranslationService,
        TranslationLoaderService,
        LanguageService,
      ],
    }).compileComponents();

    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockLoadingService = TestBed.inject(LoadingService) as jasmine.SpyObj<LoadingService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    mockSnackBar = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with invalid form', () => {
    expect(component.loginForm.valid).toBeFalsy();
  });

  it('should require email and password', () => {
    const emailControl = component.loginForm.get('email');
    const passwordControl = component.loginForm.get('password');

    expect(emailControl?.hasError('required')).toBeTruthy();
    expect(passwordControl?.hasError('required')).toBeTruthy();
  });

  it('should validate email format', () => {
    const emailControl = component.loginForm.get('email');

    emailControl?.setValue('invalid-email');
    expect(emailControl?.hasError('email')).toBeTruthy();

    emailControl?.setValue('valid@email.com');
    expect(emailControl?.hasError('email')).toBeFalsy();
  });

  it('should validate password minimum length', () => {
    const passwordControl = component.loginForm.get('password');

    passwordControl?.setValue('short');
    expect(passwordControl?.hasError('minlength')).toBeTruthy();

    passwordControl?.setValue('longenoughpassword');
    expect(passwordControl?.hasError('minlength')).toBeFalsy();
  });

  it('should not submit invalid form', () => {
    component.onSubmit();

    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('should normalize email input (trim and lowercase)', () => {
    const emailControl = component.loginForm.get('email');

    emailControl?.setValue('  TEST@EXAMPLE.COM  ');
    // Allow time for the valueChanges subscription to process
    fixture.detectChanges();

    expect(emailControl?.value).toBe('test@example.com');
  });

  it('should handle login error correctly', fakeAsync(() => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'employee' as const,
      groups: [],
    };
    mockAuthService.login.and.returnValue(throwError(() => new Error('Invalid credentials')));
    mockAuthService.getCurrentUser.and.returnValue(of(mockUser));

    component.loginForm.patchValue({
      email: 'test@example.com',
      password: 'testpassword123',
    });

    component.onSubmit();
    tick(); // Wait for async operations to complete

    expect(mockLoadingService.setLoading).toHaveBeenCalledWith(true);
    expect(mockLoadingService.setLoading).toHaveBeenCalledWith(false);
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Invalid credentials',
      'Close',
      jasmine.objectContaining({
        duration: 5000,
        panelClass: ['error-snackbar'],
      })
    );

    // Password should be cleared but email preserved
    expect(component.loginForm.get('password')?.value).toBe('');
    expect(component.loginForm.get('email')?.value).toBe('test@example.com');

    // Form should be marked as untouched and pristine for retry
    expect(component.loginForm.untouched).toBeTruthy();
    expect(component.loginForm.pristine).toBeTruthy();
  }));

  it('should handle successful login', fakeAsync(() => {
    const mockResponse = {
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'employee' as const,
        groups: [],
      },
      accessToken: 'mock-token',
    };
    mockAuthService.login.and.returnValue(of(mockResponse));
    mockAuthService.getCurrentUser.and.returnValue(of(mockResponse.user));

    component.loginForm.patchValue({
      email: 'test@example.com',
      password: 'testpassword123',
    });

    component.onSubmit();
    tick(); // Wait for async operations to complete

    expect(mockLoadingService.setLoading).toHaveBeenCalledWith(true);
    expect(mockLoadingService.setLoading).toHaveBeenCalledWith(false);
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Welcome back, Test User!',
      'Close',
      jasmine.objectContaining({
        duration: 3000,
        panelClass: ['success-snackbar'],
      })
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/employee/dashboard']);
  }));

  it('should use translation service for UI text', () => {
    // Test that the component properly integrates with the translation service
    expect(component.translationService).toBeDefined();

    // Verify that translation service is properly injected and working
    const translationService = component.translationService;

    // Test that translation keys exist and return string values (not the key itself)
    const appTitle = translationService.translateSync('auth.login.app_title');
    expect(typeof appTitle).toBe('string');
    expect(appTitle).not.toBe('auth.login.app_title'); // Should not return the key itself

    const emailLabel = translationService.translateSync('auth.login.email_label');
    expect(typeof emailLabel).toBe('string');
    expect(emailLabel).not.toBe('auth.login.email_label');

    const passwordLabel = translationService.translateSync('auth.login.password_label');
    expect(typeof passwordLabel).toBe('string');
    expect(passwordLabel).not.toBe('auth.login.password_label');
  });

  it('should handle translation with parameters', () => {
    const translationService = component.translationService;
    const result = translationService.translateSync('auth.login.welcome_back', { name: 'John Doe' });
    expect(typeof result).toBe('string');
    expect(result).toContain('John Doe'); // Should interpolate the name parameter
    expect(result).not.toBe('auth.login.welcome_back'); // Should not return the key itself
  });
});
