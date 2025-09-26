import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, BehaviorSubject, Observable, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, timeout, catchError } from 'rxjs/operators';
import { RegistrationService } from '../../../core/services/registration.service';
import { ConfigService } from '../../../core/services/config.service';
import { TranslationService } from '../../../core/services/translation.service';
import { RegisterRequest } from '@rtm/shared';

// Custom validators
function passwordStrengthValidator(control: AbstractControl): { [key: string]: any } | null {
  const value = control.value;
  if (!value) {
    return null;
  }

  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumeric = /[0-9]/.test(value);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
  const isLongEnough = value.length >= 12;

  const passwordValid =
    hasUpperCase && hasLowerCase && hasNumeric && hasSpecialChar && isLongEnough;

  if (!passwordValid) {
    return {
      passwordStrength: {
        hasUpperCase,
        hasLowerCase,
        hasNumeric,
        hasSpecialChar,
        isLongEnough,
      },
    };
  }

  return null;
}

function confirmPasswordValidator(control: AbstractControl): { [key: string]: any } | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (password && confirmPassword && password.value !== confirmPassword.value) {
    // Set error on the confirmPassword field instead of the form
    confirmPassword.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  } else if (password && confirmPassword && password.value === confirmPassword.value) {
    // Clear passwordMismatch error if passwords match, but preserve other errors
    const errors = confirmPassword.errors;
    if (errors) {
      delete errors['passwordMismatch'];
      confirmPassword.setErrors(Object.keys(errors).length === 0 ? null : errors);
    }
  }

  return null;
}

interface RegistrationState {
  step: 'form' | 'submitting' | 'success' | 'verification-sent' | 'error';
  loading: boolean;
  error: string | null;
  message: string | null;
}

@Component({
  selector: 'app-user-registration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatStepperModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="registration-container">
      <mat-card class="registration-card">
        <mat-card-content>
          <!-- Staging Environment Notice -->
          <div *ngIf="isStaging" class="staging-notice">
            <mat-icon class="notice-icon">info</mat-icon>
            <div class="notice-content">
              <strong>{{
                translationService.translateSync('auth.registration.staging_notice_title')
              }}</strong>
              <p>
                {{ translationService.translateSync('auth.registration.staging_notice_message') }}
              </p>
            </div>
          </div>

          <!-- Submitting Step -->
          <div *ngIf="state.step === 'submitting'" class="success-step">
            <mat-spinner diameter="64"></mat-spinner>
            <h2>{{ translationService.translateSync('auth.registration.creating_account') }}</h2>
            <p>
              {{ translationService.translateSync('auth.registration.creating_account_message') }}
            </p>
          </div>

          <!-- Form Step -->
          <div *ngIf="state.step === 'form'">
            <div class="registration-header">
              <div class="elca-logo"></div>
              <h2>{{ translationService.translateSync('auth.registration.title') }}</h2>
              <p class="subtitle">
                {{ translationService.translateSync('auth.registration.subtitle') }}
              </p>
            </div>

            <form [formGroup]="registrationForm" (ngSubmit)="onSubmit()">
              <!-- Personal Information -->
              <mat-form-field appearance="outline">
                <mat-label>{{
                  translationService.translateSync('auth.registration.first_name')
                }}</mat-label>
                <input matInput formControlName="firstName" required />
                <mat-error *ngIf="registrationForm.get('firstName')?.hasError('required')">
                  {{ translationService.translateSync('auth.registration.first_name_required') }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{
                  translationService.translateSync('auth.registration.last_name')
                }}</mat-label>
                <input matInput formControlName="lastName" required />
                <mat-error *ngIf="registrationForm.get('lastName')?.hasError('required')">
                  {{ translationService.translateSync('auth.registration.last_name_required') }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{
                  translationService.translateSync('auth.registration.email')
                }}</mat-label>
                <input matInput type="email" formControlName="email" required />
                <mat-error *ngIf="registrationForm.get('email')?.hasError('required')">
                  {{ translationService.translateSync('auth.registration.email_required') }}
                </mat-error>
                <mat-error *ngIf="registrationForm.get('email')?.hasError('email')">
                  {{ translationService.translateSync('auth.registration.email_invalid') }}
                </mat-error>
              </mat-form-field>

              <!-- Password Section -->
              <mat-form-field appearance="outline">
                <mat-label>{{
                  translationService.translateSync('auth.registration.password')
                }}</mat-label>
                <input matInput type="password" formControlName="password" required />
                <mat-hint>{{
                  translationService.translateSync('auth.registration.password_hint')
                }}</mat-hint>
                <mat-error *ngIf="registrationForm.get('password')?.hasError('required')">
                  {{ translationService.translateSync('auth.registration.password_required') }}
                </mat-error>
                <mat-error *ngIf="registrationForm.get('password')?.hasError('minlength')">
                  {{ translationService.translateSync('auth.registration.password_min_length') }}
                </mat-error>
                <mat-error *ngIf="registrationForm.get('password')?.hasError('passwordStrength')">
                  {{ translationService.translateSync('auth.registration.password_strength') }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{
                  translationService.translateSync('auth.registration.confirm_password')
                }}</mat-label>
                <input matInput type="password" formControlName="confirmPassword" required />
                <mat-error *ngIf="registrationForm.get('confirmPassword')?.hasError('required')">
                  {{
                    translationService.translateSync('auth.registration.confirm_password_required')
                  }}
                </mat-error>
                <mat-error
                  *ngIf="registrationForm.get('confirmPassword')?.hasError('passwordMismatch')"
                >
                  {{ translationService.translateSync('auth.registration.passwords_mismatch') }}
                </mat-error>
              </mat-form-field>

              <!-- Address Section -->
              <h3>{{ translationService.translateSync('auth.registration.home_address') }}</h3>
              <div formGroupName="homeAddress">
                <mat-form-field appearance="outline">
                  <mat-label>{{
                    translationService.translateSync('auth.registration.street_address')
                  }}</mat-label>
                  <input matInput formControlName="street" required />
                  <mat-error
                    *ngIf="registrationForm.get('homeAddress.street')?.hasError('required')"
                  >
                    {{ translationService.translateSync('auth.registration.street_required') }}
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>{{
                    translationService.translateSync('auth.registration.city')
                  }}</mat-label>
                  <input matInput formControlName="city" required />
                  <mat-error *ngIf="registrationForm.get('homeAddress.city')?.hasError('required')">
                    {{ translationService.translateSync('auth.registration.city_required') }}
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>{{
                    translationService.translateSync('auth.registration.postal_code')
                  }}</mat-label>
                  <input
                    matInput
                    formControlName="postalCode"
                    [placeholder]="
                      translationService.translateSync('auth.registration.postal_code_placeholder')
                    "
                    required
                  />
                  <mat-hint>{{
                    translationService.translateSync('auth.registration.postal_code_hint')
                  }}</mat-hint>
                  <mat-error
                    *ngIf="registrationForm.get('homeAddress.postalCode')?.hasError('required')"
                  >
                    {{ translationService.translateSync('auth.registration.postal_code_required') }}
                  </mat-error>
                  <mat-error
                    *ngIf="registrationForm.get('homeAddress.postalCode')?.hasError('pattern')"
                  >
                    {{ translationService.translateSync('auth.registration.postal_code_invalid') }}
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>{{
                    translationService.translateSync('auth.registration.country')
                  }}</mat-label>
                  <input
                    matInput
                    formControlName="country"
                    [value]="
                      translationService.translateSync('auth.registration.country_switzerland')
                    "
                    readonly
                  />
                </mat-form-field>
              </div>

              <!-- Terms and Privacy -->
              <div class="checkbox-section">
                <mat-checkbox formControlName="acceptTerms" required>
                  {{ translationService.translateSync('auth.registration.accept_terms') }}
                  <a href="/terms" target="_blank">{{
                    translationService.translateSync('auth.registration.terms_of_service')
                  }}</a>
                </mat-checkbox>
                <mat-error *ngIf="registrationForm.get('acceptTerms')?.hasError('required')">
                  {{ translationService.translateSync('auth.registration.terms_required') }}
                </mat-error>
              </div>

              <div class="checkbox-section">
                <mat-checkbox formControlName="acceptPrivacy" required>
                  {{ translationService.translateSync('auth.registration.accept_privacy') }}
                  <a href="/privacy" target="_blank">{{
                    translationService.translateSync('auth.registration.privacy_policy')
                  }}</a>
                </mat-checkbox>
                <mat-error *ngIf="registrationForm.get('acceptPrivacy')?.hasError('required')">
                  {{ translationService.translateSync('auth.registration.privacy_required') }}
                </mat-error>
              </div>

              <!-- Submit Button -->
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="!registrationForm.valid || state.loading"
                class="submit-button"
              >
                <mat-icon *ngIf="state.loading">hourglass_empty</mat-icon>
                <mat-icon *ngIf="!state.loading">person_add</mat-icon>
                {{
                  state.loading
                    ? translationService.translateSync('auth.registration.creating_account_button')
                    : translationService.translateSync('auth.registration.create_account_button')
                }}
              </button>
            </form>
          </div>

          <!-- Verification Sent Step -->
          <div *ngIf="state.step === 'verification-sent'" class="success-step">
            <mat-icon class="success-icon">mark_email_unread</mat-icon>
            <h2>{{ translationService.translateSync('auth.registration.check_email_title') }}</h2>
            <p>{{ state.message }}</p>
            <div class="action-buttons">
              <button mat-button (click)="resendVerification()">
                <mat-icon>refresh</mat-icon>
                {{ translationService.translateSync('auth.registration.resend_email') }}
              </button>
              <button mat-button (click)="goBack()">
                <mat-icon>arrow_back</mat-icon>
                {{ translationService.translateSync('auth.registration.back_to_form') }}
              </button>
            </div>
          </div>

          <!-- Success Step -->
          <div *ngIf="state.step === 'success'" class="success-step">
            <mat-icon class="success-icon">check_circle</mat-icon>
            <h2>{{ translationService.translateSync('auth.registration.complete_title') }}</h2>
            <p>{{ state.message }}</p>
            <button mat-raised-button color="primary" (click)="goToLogin()">
              <mat-icon>login</mat-icon>
              {{ translationService.translateSync('auth.registration.go_to_login') }}
            </button>
          </div>

          <!-- Error Step -->
          <div *ngIf="state.step === 'error'" class="error-step">
            <mat-icon class="error-icon">error</mat-icon>
            <h2>{{ translationService.translateSync('auth.registration.failed_title') }}</h2>
            <p>{{ state.error }}</p>
            <button mat-button (click)="goBack()">
              <mat-icon>arrow_back</mat-icon>
              {{ translationService.translateSync('auth.registration.try_again') }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./user-registration.component.scss'],
})
export class UserRegistrationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  registrationForm!: FormGroup;

  private stateSubject = new BehaviorSubject<RegistrationState>({
    step: 'form',
    loading: false,
    error: null,
    message: null,
  });

  state$ = this.stateSubject.asObservable();

  // Environment detection
  isStaging = false;

  get state() {
    return this.stateSubject.value;
  }

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private snackBar: MatSnackBar,
    private registrationService: RegistrationService,
    private configService: ConfigService,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.detectEnvironment();
  }

  private detectEnvironment(): void {
    const config = this.configService.config;
    if (config) {
      this.isStaging = config.environment === 'staging';
    } else {
      // Subscribe to config changes if not yet loaded
      this.configService.config$.pipe(takeUntil(this.destroy$)).subscribe(config => {
        if (config) {
          this.isStaging = config.environment === 'staging';
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.registrationForm = this.formBuilder.group(
      {
        firstName: ['', [Validators.required, Validators.maxLength(50)]],
        lastName: ['', [Validators.required, Validators.maxLength(50)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(12), passwordStrengthValidator]],
        confirmPassword: ['', Validators.required],
        homeAddress: this.formBuilder.group({
          street: ['', [Validators.required, Validators.maxLength(100)]],
          city: ['', [Validators.required, Validators.maxLength(50)]],
          postalCode: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
          country: ['Switzerland'],
        }),
        acceptTerms: [false, Validators.requiredTrue],
        acceptPrivacy: [false, Validators.requiredTrue],
      },
      { validators: confirmPasswordValidator }
    );
  }

  onSubmit(): void {
    if (this.registrationForm.valid) {
      this.updateState({ loading: true, step: 'submitting' });

      const formData = this.registrationForm.value;

      // Transform form data to match API expected format
      const registerRequest: RegisterRequest = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        homeAddress: {
          street: formData.homeAddress.street,
          city: formData.homeAddress.city,
          postalCode: formData.homeAddress.postalCode,
          country: formData.homeAddress.country || 'Switzerland',
        },
        acceptTerms: formData.acceptTerms,
        acceptPrivacy: formData.acceptPrivacy,
      };

      // Call actual registration API
      this.registrationService
        .register(registerRequest)
        .pipe(
          timeout(30000), // 30 second timeout
          takeUntil(this.destroy$),
          catchError(error => {
            console.error('Registration error caught in pipe:', error);
            throw error; // Re-throw to be handled by error handler below
          })
        )
        .subscribe({
          next: response => {
            // Use staging-specific success message
            const successMessage = this.isStaging
              ? this.translationService.translateSync('auth.registration.staging_success')
              : response.data?.message ||
                this.translationService.translateSync('auth.registration.email_verification_sent');

            this.updateState({
              step: 'verification-sent',
              loading: false,
              message: successMessage,
            });
          },
          error: error => {
            console.error('Registration failed:', error);

            // Handle different error types
            let errorMessage = this.translationService.translateSync(
              'auth.registration.error_default'
            );

            if (error.name === 'TimeoutError') {
              errorMessage = this.translationService.translateSync(
                'auth.registration.error_timeout'
              );
            } else if (error.error?.code === 'EMAIL_EXISTS') {
              errorMessage = this.translationService.translateSync(
                'auth.registration.error_email_exists'
              );
            } else if (error.error?.code === 'VALIDATION_ERROR') {
              errorMessage = this.translationService.translateSync(
                'auth.registration.error_validation'
              );
            } else if (error.error?.code === 'GEOCODING_ERROR') {
              errorMessage = this.translationService.translateSync(
                'auth.registration.error_geocoding'
              );
            } else if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (error.status === 0) {
              errorMessage = this.translationService.translateSync(
                'auth.registration.error_connection'
              );
            }

            // Force error state regardless of error structure
            this.updateState({
              step: 'error',
              loading: false,
              error: errorMessage,
            });
          },
        });
    } else {
      this.snackBar.open(
        this.translationService.translateSync('auth.registration.form_invalid'),
        this.translationService.translateSync('common.buttons.close'),
        {
          duration: 5000,
        }
      );
    }
  }

  resendVerification(): void {
    const formData = this.registrationForm.value;

    if (!formData.email) {
      this.snackBar.open(
        this.translationService.translateSync('auth.registration.email_not_found'),
        this.translationService.translateSync('common.buttons.close'),
        {
          duration: 5000,
        }
      );
      return;
    }

    this.registrationService
      .resendVerification({ email: formData.email })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.snackBar.open(
            response.data.message ||
              this.translationService.translateSync('auth.registration.resend_success'),
            this.translationService.translateSync('common.buttons.close'),
            {
              duration: 3000,
            }
          );
        },
        error: error => {
          console.error('Resend verification failed:', error);
          this.snackBar.open(
            this.translationService.translateSync('auth.registration.resend_failed'),
            this.translationService.translateSync('common.buttons.close'),
            {
              duration: 5000,
            }
          );
        },
      });
  }

  goBack(): void {
    this.updateState({ step: 'form', error: null, message: null });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  private updateState(updates: Partial<RegistrationState>): void {
    this.stateSubject.next({ ...this.state, ...updates });
  }
}
