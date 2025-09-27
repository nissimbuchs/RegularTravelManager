import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { ManagerDashboardService } from '../services/manager-dashboard.service';
import { TranslationService } from '../../../core/services/translation.service';

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
        <h1>{{ translationService.translateSync('manager.dashboard.title') }}</h1>
        <p>{{ translationService.translateSync('manager.dashboard.subtitle') }}</p>
      </div>

      <div *ngIf="loading" class="loading-spinner">
        <mat-spinner></mat-spinner>
        <p>{{ translationService.translateSync('manager.dashboard.loading') }}</p>
      </div>

      <div *ngIf="dashboardData && !loading">
        <!-- Summary Cards -->
        <div class="summary-grid">
          <mat-card class="summary-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>people</mat-icon>
              <mat-card-title>{{ dashboardData.summary.totalEmployees }}</mat-card-title>
              <mat-card-subtitle>{{ translationService.translateSync('manager.dashboard.summary.total_employees') }}</mat-card-subtitle>
            </mat-card-header>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>business_center</mat-icon>
              <mat-card-title>{{ dashboardData.summary.activeProjects }}</mat-card-title>
              <mat-card-subtitle>{{ translationService.translateSync('manager.dashboard.summary.active_projects') }}</mat-card-subtitle>
            </mat-card-header>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>pending_actions</mat-icon>
              <mat-card-title>{{ dashboardData.summary.pendingRequests }}</mat-card-title>
              <mat-card-subtitle>{{ translationService.translateSync('manager.dashboard.summary.pending_requests') }}</mat-card-subtitle>
            </mat-card-header>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>account_balance</mat-icon>
              <mat-card-title
                >CHF {{ dashboardData.summary.monthlyBudget | number: '1.0-0' }}</mat-card-title
              >
              <mat-card-subtitle>{{ translationService.translateSync('manager.dashboard.summary.monthly_budget') }}</mat-card-subtitle>
            </mat-card-header>
          </mat-card>
        </div>

        <!-- Pending Requests -->
        <div class="section">
          <mat-card>
            <mat-card-header>
              <mat-card-title
                >{{ translationService.translateSync('manager.dashboard.pending_requests.title', { count: dashboardData.totalPending }) }}</mat-card-title
              >
              <mat-card-subtitle *ngIf="dashboardData.urgentCount > 0" class="urgent-indicator">
                {{ translationService.translateSync('manager.dashboard.pending_requests.urgent_count', { count: dashboardData.urgentCount }) }}
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="request-list">
                <div *ngFor="let request of dashboardData.pendingRequests" class="request-item">
                  <div class="request-info">
                    <h4>{{ request.employeeName }}</h4>
                    <p>{{ request.projectName }} - {{ request.subProjectName }}</p>
                    <span class="days">{{ translationService.translateSync('manager.dashboard.pending_requests.days_per_week', { days: request.daysPerWeek }) }}</span>
                    <span class="urgency" [class]="'urgency-' + request.urgencyLevel">
                      {{ translationService.translateSync('manager.dashboard.pending_requests.priority', { level: translationService.translateSync('manager.dashboard.priority_levels.' + request.urgencyLevel) }) }}
                    </span>
                  </div>
                  <div class="request-amount">
                    <span class="amount"
                      >{{ translationService.translateSync('manager.dashboard.pending_requests.amount_per_month', { amount: request.calculatedAllowance.toFixed(2) }) }}</span
                    >
                    <span class="days-since">{{ translationService.translateSync('manager.dashboard.pending_requests.days_ago', { days: request.daysSinceSubmission }) }}</span>
                  </div>
                </div>
              </div>
            </mat-card-content>
            <mat-card-actions>
              <button mat-raised-button color="primary" routerLink="/manager/approvals">
                {{ translationService.translateSync('manager.dashboard.actions.view_all_requests') }}
              </button>
            </mat-card-actions>
          </mat-card>
        </div>

        <!-- Quick Actions -->
        <div class="dashboard-grid">
          <mat-card class="dashboard-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>check_circle</mat-icon>
              <mat-card-title>{{ translationService.translateSync('manager.dashboard.quick_actions.pending_approvals.title') }}</mat-card-title>
              <mat-card-subtitle>{{ translationService.translateSync('manager.dashboard.quick_actions.pending_approvals.subtitle') }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <button mat-raised-button color="primary" routerLink="/manager/approvals">
                {{ translationService.translateSync('manager.dashboard.quick_actions.pending_approvals.button') }}
              </button>
            </mat-card-actions>
          </mat-card>

          <mat-card class="dashboard-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>people</mat-icon>
              <mat-card-title>{{ translationService.translateSync('manager.dashboard.quick_actions.employee_management.title') }}</mat-card-title>
              <mat-card-subtitle>{{ translationService.translateSync('manager.dashboard.quick_actions.employee_management.subtitle') }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <button mat-raised-button color="primary" routerLink="/manager/employees">
                {{ translationService.translateSync('manager.dashboard.quick_actions.employee_management.button') }}
              </button>
            </mat-card-actions>
          </mat-card>

          <mat-card class="dashboard-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>business_center</mat-icon>
              <mat-card-title>{{ translationService.translateSync('manager.dashboard.quick_actions.project_management.title') }}</mat-card-title>
              <mat-card-subtitle>{{ translationService.translateSync('manager.dashboard.quick_actions.project_management.subtitle') }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <button mat-raised-button color="primary" routerLink="/manager/projects">
                {{ translationService.translateSync('manager.dashboard.quick_actions.project_management.button') }}
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

  constructor(
    private dashboardService: ManagerDashboardService,
    public translationService: TranslationService
  ) {}

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
