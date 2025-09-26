import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BehaviorSubject } from 'rxjs';
import { RegistrationService } from '../../../core/services/registration.service';
import { TranslationService } from '../../../core/services/translation.service';

interface VerificationState {
  status: 'loading' | 'success' | 'error' | 'expired';
  message: string | null;
}

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="verification-container">
      <mat-card class="verification-card">
        <mat-card-content>
          <!-- Loading State -->
          <div *ngIf="state.status === 'loading'" class="verification-step">
            <mat-spinner diameter="64"></mat-spinner>
            <h2>{{ translationService.translateSync('auth.verification.verifying_title') }}</h2>
            <p>{{ translationService.translateSync('auth.verification.verifying_message') }}</p>
          </div>

          <!-- Success State -->
          <div *ngIf="state.status === 'success'" class="verification-step success">
            <mat-icon class="status-icon success-icon">check_circle</mat-icon>
            <h2>{{ translationService.translateSync('auth.verification.success_title') }}</h2>
            <p>{{ state.message }}</p>
            <div class="action-buttons">
              <button mat-raised-button color="primary" (click)="goToLogin()">
                <mat-icon>login</mat-icon>
                {{ translationService.translateSync('auth.verification.continue_login') }}
              </button>
            </div>
          </div>

          <!-- Error State -->
          <div *ngIf="state.status === 'error'" class="verification-step error">
            <mat-icon class="status-icon error-icon">error</mat-icon>
            <h2>{{ translationService.translateSync('auth.verification.failed_title') }}</h2>
            <p>{{ state.message }}</p>
            <div class="action-buttons">
              <button mat-button (click)="resendVerification()">
                <mat-icon>refresh</mat-icon>
                {{ translationService.translateSync('auth.verification.resend_email') }}
              </button>
              <button mat-button (click)="goToRegister()">
                <mat-icon>person_add</mat-icon>
                {{ translationService.translateSync('auth.verification.back_to_registration') }}
              </button>
              <button mat-button (click)="goToLogin()">
                <mat-icon>login</mat-icon>
                {{ translationService.translateSync('auth.verification.go_to_login') }}
              </button>
            </div>
          </div>

          <!-- Expired State -->
          <div *ngIf="state.status === 'expired'" class="verification-step expired">
            <mat-icon class="status-icon warning-icon">warning</mat-icon>
            <h2>{{ translationService.translateSync('auth.verification.expired_title') }}</h2>
            <p>{{ state.message }}</p>
            <div class="action-buttons">
              <button mat-raised-button color="primary" (click)="resendVerification()">
                <mat-icon>refresh</mat-icon>
                {{ translationService.translateSync('auth.verification.get_new_link') }}
              </button>
              <button mat-button (click)="goToLogin()">
                <mat-icon>login</mat-icon>
                {{ translationService.translateSync('auth.verification.back_to_login') }}
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./email-verification.component.scss'],
})
export class EmailVerificationComponent implements OnInit {
  private stateSubject = new BehaviorSubject<VerificationState>({
    status: 'loading',
    message: null,
  });

  state$ = this.stateSubject.asObservable();

  get state() {
    return this.stateSubject.value;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private registrationService: RegistrationService,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const email = params['email'];

      if (!token || !email) {
        this.updateState({
          status: 'error',
          message: this.translationService.translateSync('auth.verification.invalid_link'),
        });
        return;
      }

      this.verifyEmail(token, email);
    });
  }

  private verifyEmail(token: string, email: string): void {
    // Call actual verification API
    this.registrationService.verifyEmail({ verificationToken: token, email }).subscribe({
      next: response => {
        this.updateState({
          status: 'success',
          message:
            response?.data?.message ||
            this.translationService.translateSync('auth.verification.success_message'),
        });
      },
      error: error => {
        console.error('Email verification failed:', error);

        let errorMessage = this.translationService.translateSync(
          'auth.verification.failed_default'
        );

        if (error.error?.error?.code === 'TOKEN_EXPIRED') {
          this.updateState({
            status: 'expired',
            message: this.translationService.translateSync('auth.verification.expired_message'),
          });
          return;
        } else if (error.error?.error?.code === 'TOKEN_INVALID') {
          errorMessage = this.translationService.translateSync('auth.verification.invalid_token');
        } else if (error.error?.error?.message) {
          errorMessage = error.error.error.message;
        }

        this.updateState({
          status: 'error',
          message: errorMessage,
        });
      },
    });
  }

  resendVerification(): void {
    // Implement resend logic
    this.snackBar.open(
      this.translationService.translateSync('auth.verification.email_sent'),
      this.translationService.translateSync('common.buttons.close'),
      {
        duration: 5000,
      }
    );
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }

  private updateState(updates: Partial<VerificationState>): void {
    this.stateSubject.next({ ...this.state, ...updates });
  }
}
