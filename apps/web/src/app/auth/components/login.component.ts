import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { LoadingService } from '../../core/services/loading.service';
import { TranslationService } from '../../core/services/translation.service';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    LanguageSwitcherComponent,
  ],
  template: `
    <div class="login-container">
      <!-- Language Switcher for non-authenticated users -->
      <div class="login-language-switcher">
        <app-language-switcher></app-language-switcher>
      </div>

      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title class="login-title">
            <div class="elca-logo"></div>
            {{ translationService.translateSync('auth.login.app_title') }}
          </mat-card-title>
          <mat-card-subtitle>{{
            translationService.translateSync('auth.login.subtitle')
          }}</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{
                translationService.translateSync('auth.login.email_label')
              }}</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                [placeholder]="translationService.translateSync('auth.login.email_placeholder')"
                autocomplete="username"
                [class.mat-form-field-invalid]="
                  loginForm.get('email')?.invalid && loginForm.get('email')?.touched
                "
              />
              <mat-icon matSuffix>email</mat-icon>
              <mat-error *ngIf="loginForm.get('email')?.hasError('required')">
                {{ translationService.translateSync('auth.login.email_required') }}
              </mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email')">
                {{ translationService.translateSync('auth.login.email_invalid') }}
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{
                translationService.translateSync('auth.login.password_label')
              }}</mat-label>
              <input
                matInput
                [type]="hidePassword ? 'password' : 'text'"
                formControlName="password"
                [placeholder]="translationService.translateSync('auth.login.password_placeholder')"
                autocomplete="current-password"
                [class.mat-form-field-invalid]="
                  loginForm.get('password')?.invalid && loginForm.get('password')?.touched
                "
              />
              <mat-icon matSuffix (click)="hidePassword = !hidePassword" class="password-toggle">
                {{ hidePassword ? 'visibility_off' : 'visibility' }}
              </mat-icon>
              <mat-error *ngIf="loginForm.get('password')?.hasError('required')">
                {{ translationService.translateSync('auth.login.password_required') }}
              </mat-error>
              <mat-error *ngIf="loginForm.get('password')?.hasError('minlength')">
                {{ translationService.translateSync('auth.login.password_min_length') }}
              </mat-error>
            </mat-form-field>

            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="loginForm.invalid || (isLoading$ | async)"
              class="login-button full-width"
            >
              <mat-spinner
                *ngIf="isLoading$ | async"
                diameter="20"
                class="login-spinner"
              ></mat-spinner>
              <span *ngIf="!(isLoading$ | async)">{{
                translationService.translateSync('auth.login.sign_in_button')
              }}</span>
              <span *ngIf="isLoading$ | async">{{
                translationService.translateSync('auth.login.signing_in')
              }}</span>
            </button>

            <div class="registration-link">
              {{ translationService.translateSync('auth.login.no_account') }}
              <button
                mat-button
                color="primary"
                (click)="goToRegistration()"
                class="register-button"
              >
                {{ translationService.translateSync('auth.login.create_account') }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  hidePassword = true;
  isLoading$ = this.loadingService.loading$;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private loadingService: LoadingService,
    private router: Router,
    private snackBar: MatSnackBar,
    public translationService: TranslationService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit(): void {
    // Reset loading state when component initializes
    this.loadingService.resetLoading();

    // Only check authentication status - don't auto-redirect
    // This allows users to navigate to registration without being immediately redirected
    // The auth guard will handle redirects appropriately for protected routes

    // Normalize email input on changes (trim and lowercase)
    this.loginForm.get('email')?.valueChanges.subscribe(value => {
      if (value && typeof value === 'string') {
        const normalizedEmail = value.trim().toLowerCase();
        if (normalizedEmail !== value) {
          this.loginForm.patchValue(
            {
              email: normalizedEmail,
            },
            { emitEvent: false }
          );
        }
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      const credentials = this.loginForm.value;
      this.loadingService.setLoading(true);

      this.authService.login(credentials).subscribe({
        next: response => {
          this.loadingService.setLoading(false);
          const welcomeMessage = this.translationService.translateSync('auth.login.welcome_back', {
            name: response.user.name,
          });
          this.snackBar.open(
            welcomeMessage,
            this.translationService.translateSync('common.buttons.close'),
            {
              duration: 3000,
              panelClass: ['success-snackbar'],
            }
          );
          this.redirectAfterLogin();
        },
        error: error => {
          this.loadingService.setLoading(false);

          // Reset form validation state to ensure proper re-validation
          this.loginForm.markAsUntouched();
          this.loginForm.markAsPristine();

          // Clear password field but keep email for user convenience
          this.loginForm.patchValue({
            password: '',
          });

          // Focus back to password field for retry
          setTimeout(() => {
            const passwordField = document.querySelector(
              'input[formControlName="password"]'
            ) as HTMLInputElement;
            if (passwordField) {
              passwordField.focus();
            }
          }, 100);

          const errorMessage =
            error.message || this.translationService.translateSync('auth.login.login_failed');
          this.snackBar.open(
            errorMessage,
            this.translationService.translateSync('common.buttons.close'),
            {
              duration: 5000,
              panelClass: ['error-snackbar'],
            }
          );
        },
      });
    } else {
      // Mark all fields as touched to show validation errors
      this.loginForm.markAllAsTouched();
    }
  }

  private redirectAfterLogin(): void {
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        // Redirect based on user role
        let redirectUrl = '/employee/dashboard';
        if (user.role === 'admin') {
          redirectUrl = '/admin/projects';
        } else if (user.role === 'manager') {
          redirectUrl = '/manager/dashboard';
        }
        this.router.navigate([redirectUrl]);
      }
    });
  }

  goToRegistration(): void {
    this.router.navigate(['/register']);
  }
}
