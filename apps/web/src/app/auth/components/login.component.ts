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
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title class="login-title">
            <mat-icon>business</mat-icon>
            RegularTravelManager
          </mat-card-title>
          <mat-card-subtitle>Sign in to your account</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                placeholder="Enter your email"
                autocomplete="username"
                [class.mat-form-field-invalid]="
                  loginForm.get('email')?.invalid && loginForm.get('email')?.touched
                "
              />
              <mat-icon matSuffix>email</mat-icon>
              <mat-error *ngIf="loginForm.get('email')?.hasError('required')">
                Email is required
              </mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email')">
                Please enter a valid email
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="hidePassword ? 'password' : 'text'"
                formControlName="password"
                placeholder="Enter your password"
                autocomplete="current-password"
                [class.mat-form-field-invalid]="
                  loginForm.get('password')?.invalid && loginForm.get('password')?.touched
                "
              />
              <mat-icon matSuffix (click)="hidePassword = !hidePassword" class="password-toggle">
                {{ hidePassword ? 'visibility_off' : 'visibility' }}
              </mat-icon>
              <mat-error *ngIf="loginForm.get('password')?.hasError('required')">
                Password is required
              </mat-error>
              <mat-error *ngIf="loginForm.get('password')?.hasError('minlength')">
                Password must be at least 8 characters
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
              <span *ngIf="!(isLoading$ | async)">Sign In</span>
              <span *ngIf="isLoading$ | async">Signing In...</span>
            </button>

            <div class="registration-link">
              Don't have an account?
              <button
                mat-button
                color="primary"
                (click)="goToRegistration()"
                class="register-button"
              >
                Create Account
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px;
      }

      .login-card {
        width: 100%;
        max-width: 400px;
        padding: 0;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      }

      .login-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 24px;
        font-weight: 600;
        color: #333;
      }

      .login-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-top: 20px;
      }

      .full-width {
        width: 100%;
      }

      .login-button {
        height: 48px;
        font-size: 16px;
        font-weight: 500;
        margin-top: 10px;
      }

      .login-spinner {
        margin-right: 8px;
      }

      .password-toggle {
        cursor: pointer;
      }

      .registration-link {
        text-align: center;
        margin-top: 16px;
        color: #666;
      }

      .register-button {
        margin-left: 4px;
      }

      mat-card-header {
        padding: 24px 24px 0;
      }

      mat-card-content {
        padding: 0 24px 24px;
      }

      @media (max-width: 480px) {
        .login-container {
          padding: 16px;
        }

        .login-card {
          max-width: none;
        }
      }
    `,
  ],
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
    private snackBar: MatSnackBar
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit(): void {
    // Reset loading state when component initializes
    this.loadingService.resetLoading();

    // Check if already authenticated
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.redirectAfterLogin();
      }
    });

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
          this.snackBar.open(`Welcome back, ${response.user.name}!`, 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar'],
          });
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

          this.snackBar.open(
            error.message || 'Login failed. Please check your credentials and try again.',
            'Close',
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
