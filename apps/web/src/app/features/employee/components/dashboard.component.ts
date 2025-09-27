import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <div class="welcome-section">
        <h1>{{ translationService.translateSync('employee.dashboard.title') }}</h1>
        <p>{{ translationService.translateSync('employee.dashboard.subtitle') }}</p>
      </div>

      <div class="dashboard-grid">
        <mat-card class="dashboard-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>add_location</mat-icon>
            <mat-card-title>{{ translationService.translateSync('employee.dashboard.cards.address.title') }}</mat-card-title>
            <mat-card-subtitle>{{ translationService.translateSync('employee.dashboard.cards.address.subtitle') }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <button mat-raised-button color="primary" routerLink="/employee/address">
              {{ translationService.translateSync('employee.dashboard.cards.address.button') }}
            </button>
          </mat-card-actions>
        </mat-card>

        <mat-card class="dashboard-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>add_circle</mat-icon>
            <mat-card-title>{{ translationService.translateSync('employee.dashboard.cards.new_request.title') }}</mat-card-title>
            <mat-card-subtitle>{{ translationService.translateSync('employee.dashboard.cards.new_request.subtitle') }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <button mat-raised-button color="primary" routerLink="/employee/request">
              {{ translationService.translateSync('employee.dashboard.cards.new_request.button') }}
            </button>
          </mat-card-actions>
        </mat-card>

        <mat-card class="dashboard-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>history</mat-icon>
            <mat-card-title>{{ translationService.translateSync('employee.dashboard.cards.my_requests.title') }}</mat-card-title>
            <mat-card-subtitle>{{ translationService.translateSync('employee.dashboard.cards.my_requests.subtitle') }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <button mat-raised-button color="primary" routerLink="/employee/requests">
              {{ translationService.translateSync('employee.dashboard.cards.my_requests.button') }}
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  constructor(public translationService: TranslationService) {}
}
