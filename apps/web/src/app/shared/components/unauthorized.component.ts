import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';

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
            <h2>{{ translationService.translateSync('unauthorized.title') }}</h2>
            <p>{{ translationService.translateSync('unauthorized.message') }}</p>
            <p>{{ translationService.translateSync('unauthorized.contact_admin') }}</p>

            <div class="action-buttons">
              <button mat-raised-button color="primary" (click)="goBack()">
                <mat-icon>arrow_back</mat-icon>
                {{ translationService.translateSync('unauthorized.actions.go_back') }}
              </button>
              <button mat-raised-button color="warn" (click)="logout()">
                <mat-icon>logout</mat-icon>
                {{ translationService.translateSync('unauthorized.actions.sign_out') }}
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./unauthorized.component.scss'],
})
export class UnauthorizedComponent {
  constructor(
    private router: Router,
    private authService: AuthService,
    public translationService: TranslationService
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
