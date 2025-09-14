import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BehaviorSubject } from 'rxjs';

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
    MatSnackBarModule
  ],
  template: `
    <div class="verification-container">
      <mat-card class="verification-card">
        <mat-card-content>
          <!-- Loading State -->
          <div *ngIf="state.status === 'loading'" class="verification-step">
            <mat-spinner diameter="64"></mat-spinner>
            <h2>Verifying Your Email</h2>
            <p>Please wait while we verify your email address...</p>
          </div>

          <!-- Success State -->
          <div *ngIf="state.status === 'success'" class="verification-step success">
            <mat-icon class="status-icon success-icon">check_circle</mat-icon>
            <h2>Email Verified!</h2>
            <p>{{ state.message }}</p>
            <div class="action-buttons">
              <button mat-raised-button color="primary" (click)="goToLogin()">
                <mat-icon>login</mat-icon>
                Continue to Login
              </button>
            </div>
          </div>

          <!-- Error State -->
          <div *ngIf="state.status === 'error'" class="verification-step error">
            <mat-icon class="status-icon error-icon">error</mat-icon>
            <h2>Verification Failed</h2>
            <p>{{ state.message }}</p>
            <div class="action-buttons">
              <button mat-button (click)="resendVerification()">
                <mat-icon>refresh</mat-icon>
                Resend Verification Email
              </button>
              <button mat-button (click)="goToRegister()">
                <mat-icon>person_add</mat-icon>
                Back to Registration
              </button>
              <button mat-button (click)="goToLogin()">
                <mat-icon>login</mat-icon>
                Go to Login
              </button>
            </div>
          </div>

          <!-- Expired State -->
          <div *ngIf="state.status === 'expired'" class="verification-step expired">
            <mat-icon class="status-icon warning-icon">warning</mat-icon>
            <h2>Verification Link Expired</h2>
            <p>{{ state.message }}</p>
            <div class="action-buttons">
              <button mat-raised-button color="primary" (click)="resendVerification()">
                <mat-icon>refresh</mat-icon>
                Get New Verification Link
              </button>
              <button mat-button (click)="goToLogin()">
                <mat-icon>login</mat-icon>
                Back to Login
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .verification-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%);
    }

    .verification-card {
      max-width: 500px;
      width: 100%;
      padding: 20px;
    }

    .verification-step {
      text-align: center;
      padding: 40px 20px;
    }

    h2 {
      margin: 20px 0 16px 0;
      color: #333;
    }

    p {
      color: #666;
      line-height: 1.5;
      margin-bottom: 30px;
    }

    .status-icon {
      font-size: 64px;
      height: 64px;
      width: 64px;
      margin-bottom: 20px;
    }

    .success-icon {
      color: #4caf50;
    }

    .error-icon {
      color: #f44336;
    }

    .warning-icon {
      color: #ff9800;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    }

    .action-buttons button {
      min-width: 200px;
    }

    mat-spinner {
      margin: 0 auto 20px;
    }

    @media (max-width: 600px) {
      .verification-container {
        padding: 10px;
      }
      
      .verification-card {
        padding: 10px;
      }
      
      .verification-step {
        padding: 20px 10px;
      }
    }
  `]
})
export class EmailVerificationComponent implements OnInit {
  private stateSubject = new BehaviorSubject<VerificationState>({
    status: 'loading',
    message: null
  });

  state$ = this.stateSubject.asObservable();

  get state() {
    return this.stateSubject.value;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const email = params['email'];

      if (!token || !email) {
        this.updateState({
          status: 'error',
          message: 'Invalid verification link. Please check your email for the correct link or request a new one.'
        });
        return;
      }

      this.verifyEmail(token, email);
    });
  }

  private verifyEmail(token: string, email: string): void {
    // Simulate API call
    setTimeout(() => {
      // For now, just simulate success
      this.updateState({
        status: 'success',
        message: 'Your email has been successfully verified! You can now log in to your account.'
      });
    }, 2000);
  }

  resendVerification(): void {
    // Implement resend logic
    this.snackBar.open('A new verification email has been sent', 'Close', {
      duration: 5000
    });
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