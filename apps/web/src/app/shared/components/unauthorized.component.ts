import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="unauthorized-container">
      <mat-card class="unauthorized-card">
        <mat-card-content>
          <div class="unauthorized-content">
            <mat-icon class="unauthorized-icon">block</mat-icon>
            <h2>Access Denied</h2>
            <p>You don't have permission to access this page.</p>
            <p>Please contact your administrator if you believe this is an error.</p>

            <div class="action-buttons">
              <button mat-raised-button color="primary" (click)="goBack()">
                <mat-icon>arrow_back</mat-icon>
                Go Back
              </button>
              <button mat-raised-button color="warn" (click)="logout()">
                <mat-icon>logout</mat-icon>
                Sign Out
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .unauthorized-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f5f5f5;
        padding: 20px;
      }

      .unauthorized-card {
        max-width: 500px;
        text-align: center;
      }

      .unauthorized-content {
        padding: 40px 20px;
      }

      .unauthorized-icon {
        font-size: 72px;
        height: 72px;
        width: 72px;
        color: #f44336;
        margin-bottom: 24px;
      }

      h2 {
        margin: 16px 0;
        color: #333;
      }

      p {
        margin: 12px 0;
        color: #666;
        line-height: 1.5;
      }

      .action-buttons {
        margin-top: 32px;
        display: flex;
        gap: 16px;
        justify-content: center;
        flex-wrap: wrap;
      }

      @media (max-width: 480px) {
        .action-buttons {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class UnauthorizedComponent {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  goBack(): void {
    window.history.back();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      },
    });
  }
}
