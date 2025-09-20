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
  styleUrls: ['./dashboard.component.scss'],
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
