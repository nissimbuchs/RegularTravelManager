import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { ManagerDashboardService } from '../services/manager-dashboard.service';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dashboard-container">
      <div class="welcome-section">
        <h1>Manager Dashboard</h1>
        <p>Overview of travel requests, budgets, and team metrics.</p>
      </div>

      <div *ngIf="loading" class="loading-spinner">
        <mat-spinner></mat-spinner>
        <p>Loading dashboard data...</p>
      </div>

      <div *ngIf="dashboardData && !loading">
        <!-- Summary Cards -->
        <div class="summary-grid">
          <mat-card class="summary-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>people</mat-icon>
              <mat-card-title>{{ dashboardData.summary.totalEmployees }}</mat-card-title>
              <mat-card-subtitle>Total Employees</mat-card-subtitle>
            </mat-card-header>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>business_center</mat-icon>
              <mat-card-title>{{ dashboardData.summary.activeProjects }}</mat-card-title>
              <mat-card-subtitle>Active Projects</mat-card-subtitle>
            </mat-card-header>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>pending_actions</mat-icon>
              <mat-card-title>{{ dashboardData.summary.pendingRequests }}</mat-card-title>
              <mat-card-subtitle>Pending Requests</mat-card-subtitle>
            </mat-card-header>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>account_balance</mat-icon>
              <mat-card-title
                >CHF {{ dashboardData.summary.monthlyBudget | number: '1.0-0' }}</mat-card-title
              >
              <mat-card-subtitle>Monthly Budget</mat-card-subtitle>
            </mat-card-header>
          </mat-card>
        </div>

        <!-- Pending Requests -->
        <div class="section">
          <mat-card>
            <mat-card-header>
              <mat-card-title
                >Pending Travel Requests ({{ dashboardData.totalPending }})</mat-card-title
              >
              <mat-card-subtitle *ngIf="dashboardData.urgentCount > 0" class="urgent-indicator">
                {{ dashboardData.urgentCount }} urgent request(s)
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="request-list">
                <div *ngFor="let request of dashboardData.pendingRequests" class="request-item">
                  <div class="request-info">
                    <h4>{{ request.employeeName }}</h4>
                    <p>{{ request.projectName }} - {{ request.subProjectName }}</p>
                    <span class="days">{{ request.daysPerWeek }} days/week</span>
                    <span class="urgency" [class]="'urgency-' + request.urgencyLevel">
                      {{ request.urgencyLevel }} priority
                    </span>
                  </div>
                  <div class="request-amount">
                    <span class="amount"
                      >CHF {{ request.calculatedAllowance | number: '1.2-2' }}/month</span
                    >
                    <span class="days-since">{{ request.daysSinceSubmission }} days ago</span>
                  </div>
                </div>
              </div>
            </mat-card-content>
            <mat-card-actions>
              <button mat-raised-button color="primary" routerLink="/manager/approvals">
                View All Requests
              </button>
            </mat-card-actions>
          </mat-card>
        </div>

        <!-- Quick Actions -->
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

      .loading-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px;
      }

      .loading-spinner p {
        margin-top: 16px;
        color: #666;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
      }

      .summary-card {
        text-align: center;
      }

      .summary-card mat-card-title {
        font-size: 2em;
        font-weight: bold;
        color: #2e7d32;
      }

      .section {
        margin-bottom: 32px;
      }

      .request-list {
        margin: 16px 0;
      }

      .request-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #eee;
      }

      .request-item:last-child {
        border-bottom: none;
      }

      .request-info h4 {
        margin: 0 0 4px;
        font-size: 16px;
      }

      .request-info p {
        margin: 0 0 4px;
        color: #666;
        font-size: 14px;
      }

      .request-info .days {
        font-size: 12px;
        background: #e3f2fd;
        color: #1976d2;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .request-amount {
        text-align: right;
      }

      .request-amount .amount {
        display: block;
        font-weight: bold;
        color: #2e7d32;
      }

      .request-amount .status {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .status-pending {
        background: #fff3e0;
        color: #f57c00;
      }

      .status-approved {
        background: #e8f5e8;
        color: #2e7d32;
      }

      .status-rejected {
        background: #ffebee;
        color: #c62828;
      }

      .urgent-indicator {
        color: #d32f2f !important;
        font-weight: 500;
      }

      .urgency {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 3px;
        margin-left: 8px;
        text-transform: uppercase;
        font-weight: 500;
      }

      .urgency-low {
        background: #e8f5e8;
        color: #2e7d32;
      }

      .urgency-medium {
        background: #fff3e0;
        color: #f57c00;
      }

      .urgency-high {
        background: #ffebee;
        color: #c62828;
      }

      .days-since {
        font-size: 12px;
        color: #666;
        margin-top: 4px;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  dashboardData: any = null;
  loading = false;
  private destroy$ = new Subject<void>();

  constructor(private dashboardService: ManagerDashboardService) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData() {
    this.loading = true;

    // Simple call without complex filters for basic dashboard
    const pagination = {
      pageIndex: 0,
      pageSize: 10,
      totalItems: 0,
      pageSizeOptions: [5, 10, 25],
    };
    const sort = { active: 'submittedAt', direction: 'desc' as 'asc' | 'desc' };

    this.dashboardService
      .getDashboardData({}, pagination, sort)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.dashboardData = data;
          this.loading = false;
        },
        error: error => {
          console.error('Failed to load dashboard data:', error);
          this.loading = false;
        },
      });
  }
}
