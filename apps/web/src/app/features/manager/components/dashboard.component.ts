import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <div class="welcome-section">
        <h1>Manager Dashboard</h1>
        <p>Manage employee travel requests, projects, and team information.</p>
      </div>

      <div class="dashboard-grid">
        <mat-card class="dashboard-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>check_circle</mat-icon>
            <mat-card-title>Pending Approvals</mat-card-title>
            <mat-card-subtitle>Review and approve travel requests</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <button mat-raised-button color="primary" routerLink="/manager/approvals">
              View Requests
            </button>
          </mat-card-actions>
        </mat-card>

        <mat-card class="dashboard-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>people</mat-icon>
            <mat-card-title>Employee Management</mat-card-title>
            <mat-card-subtitle>View and manage employee information</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <button mat-raised-button color="primary" routerLink="/manager/employees">
              Manage Employees
            </button>
          </mat-card-actions>
        </mat-card>

        <mat-card class="dashboard-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>business_center</mat-icon>
            <mat-card-title>Project Management</mat-card-title>
            <mat-card-subtitle>Manage projects and locations</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <button mat-raised-button color="primary" routerLink="/manager/projects">
              Manage Projects
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }

      .welcome-section {
        margin-bottom: 32px;
        text-align: center;
      }

      .welcome-section h1 {
        margin: 0 0 16px;
        color: #333;
      }

      .welcome-section p {
        margin: 0;
        color: #666;
        font-size: 16px;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 24px;
      }

      .dashboard-card {
        transition: transform 0.2s ease-in-out;
      }

      .dashboard-card:hover {
        transform: translateY(-4px);
      }

      mat-card-header mat-icon {
        background-color: #fff3e0;
        color: #f57c00;
      }
    `,
  ],
})
export class DashboardComponent {}
