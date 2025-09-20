import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <div class="welcome-section">
        <h1>Employee Dashboard</h1>
        <p>Welcome to RegularTravelManager. Manage your travel requests and profile information.</p>
      </div>

      <div class="dashboard-grid">
        <mat-card class="dashboard-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>add_location</mat-icon>
            <mat-card-title>My Address</mat-card-title>
            <mat-card-subtitle>Update your home address</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <button mat-raised-button color="primary" routerLink="/employee/address">
              Manage Address
            </button>
          </mat-card-actions>
        </mat-card>

        <mat-card class="dashboard-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>add_circle</mat-icon>
            <mat-card-title>New Travel Request</mat-card-title>
            <mat-card-subtitle>Submit a new travel allowance request</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <button mat-raised-button color="primary" routerLink="/employee/request">
              Create Request
            </button>
          </mat-card-actions>
        </mat-card>

        <mat-card class="dashboard-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>history</mat-icon>
            <mat-card-title>Request History</mat-card-title>
            <mat-card-subtitle>View your past travel requests</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <button mat-raised-button color="primary" disabled>Coming Soon</button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {}
