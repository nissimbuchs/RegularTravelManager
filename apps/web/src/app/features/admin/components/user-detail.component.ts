import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

import { UserDetails } from '../../../../../../../packages/shared/src/types/api';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    MatTabsModule,
  ],
  template: `
    <div class="user-detail-container">
      <!-- Loading State -->
      <div *ngIf="loading" class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading user details...</p>
      </div>

      <!-- User Details -->
      <div *ngIf="!loading && user" class="user-content">
        <!-- Header -->
        <mat-card class="user-header">
          <mat-card-header>
            <mat-card-title>
              {{ user.firstName }} {{ user.lastName }}
              <mat-chip [color]="getRoleColor(user.role)">
                {{ user.role | titlecase }}
              </mat-chip>
            </mat-card-title>
            <mat-card-subtitle> {{ user.email }} • {{ user.employeeNumber }} </mat-card-subtitle>
          </mat-card-header>

          <mat-card-actions>
            <button mat-button (click)="goBack()">
              <mat-icon>arrow_back</mat-icon>
              Back to Users
            </button>
            <button mat-raised-button color="primary">
              <mat-icon>edit</mat-icon>
              Edit User
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- User Information Tabs -->
        <mat-tab-group>
          <!-- Basic Information -->
          <mat-tab label="Basic Information">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Personal Information</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="info-grid">
                    <div class="info-item">
                      <label>Full Name</label>
                      <span>{{ user.firstName }} {{ user.lastName }}</span>
                    </div>
                    <div class="info-item">
                      <label>Email</label>
                      <span>{{ user.email }}</span>
                    </div>
                    <div class="info-item">
                      <label>Employee Number</label>
                      <span>{{ user.employeeNumber }}</span>
                    </div>
                    <div class="info-item">
                      <label>Phone Number</label>
                      <span>{{ user.phoneNumber || 'Not provided' }}</span>
                    </div>
                    <div class="info-item">
                      <label>Status</label>
                      <mat-chip [color]="getStatusColor(user.status)">
                        {{ user.status | titlecase }}
                      </mat-chip>
                    </div>
                    <div class="info-item">
                      <label>Verified</label>
                      <mat-chip [color]="user.isVerified ? 'primary' : 'warn'">
                        {{ user.isVerified ? 'Yes' : 'No' }}
                      </mat-chip>
                    </div>
                    <div class="info-item">
                      <label>Registration Date</label>
                      <span>{{ user.registrationDate | date: 'medium' }}</span>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Address Information -->
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Address Information</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="address-content">
                    <div>{{ user.homeAddress.street }}</div>
                    <div>{{ user.homeAddress.postalCode }} {{ user.homeAddress.city }}</div>
                    <div>{{ user.homeAddress.country }}</div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Management Hierarchy -->
          <mat-tab label="Management">
            <div class="tab-content">
              <!-- Manager Information -->
              <mat-card *ngIf="user.managerName">
                <mat-card-header>
                  <mat-card-title>Reports To</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="manager-info">
                    <mat-icon>supervisor_account</mat-icon>
                    <span>{{ user.managerName }}</span>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Direct Reports -->
              <mat-card *ngIf="user.directReports.length > 0">
                <mat-card-header>
                  <mat-card-title>Direct Reports ({{ user.directReports.length }})</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="direct-reports">
                    <div *ngFor="let report of user.directReports" class="report-item">
                      <div class="report-info">
                        <strong>{{ report.firstName }} {{ report.lastName }}</strong>
                        <span class="report-email">{{ report.email }}</span>
                      </div>
                      <mat-chip [color]="getStatusColor(report.status)">
                        {{ report.status | titlecase }}
                      </mat-chip>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Activity Summary -->
          <mat-tab label="Activity">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Travel Request Activity</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="activity-stats">
                    <div class="stat-item">
                      <div class="stat-value">{{ user.activitySummary.totalRequests }}</div>
                      <div class="stat-label">Total Requests</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-value">{{ user.activitySummary.requestsThisMonth }}</div>
                      <div class="stat-label">This Month</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-value">
                        {{ user.activitySummary.averageRequestValue | currency: 'CHF' }}
                      </div>
                      <div class="stat-label">Average Value</div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Recent Requests -->
              <mat-card *ngIf="user.recentRequests.length > 0">
                <mat-card-header>
                  <mat-card-title>Recent Travel Requests</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="recent-requests">
                    <div *ngFor="let request of user.recentRequests" class="request-item">
                      <div class="request-info">
                        <div class="request-project">
                          {{ request.projectName }} - {{ request.subprojectName }}
                        </div>
                        <div class="request-date">{{ request.requestDate | date: 'short' }}</div>
                      </div>
                      <div class="request-details">
                        <mat-chip [color]="getRequestStatusColor(request.status)">
                          {{ request.status | titlecase }}
                        </mat-chip>
                        <span class="request-amount">{{
                          request.allowanceAmount | currency: 'CHF'
                        }}</span>
                      </div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <!-- Error State -->
      <div *ngIf="!loading && !user" class="error-container">
        <mat-icon>error</mat-icon>
        <h3>User not found</h3>
        <p>The requested user could not be found.</p>
        <button mat-raised-button color="primary" (click)="goBack()">Back to Users</button>
      </div>
    </div>
  `,
  styles: [
    `
      .user-detail-container {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .loading-container,
      .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        gap: 16px;
      }

      .user-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .user-header mat-card-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .tab-content {
        padding: 20px 0;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
      }

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .info-item label {
        font-weight: 500;
        color: rgba(0, 0, 0, 0.6);
        font-size: 0.875rem;
      }

      .address-content {
        line-height: 1.5;
      }

      .manager-info {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .direct-reports {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .report-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 4px;
      }

      .report-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .report-email {
        color: rgba(0, 0, 0, 0.6);
        font-size: 0.875rem;
      }

      .activity-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
      }

      .stat-item {
        text-align: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 8px;
      }

      .stat-value {
        font-size: 2rem;
        font-weight: bold;
        color: #1976d2;
      }

      .stat-label {
        color: rgba(0, 0, 0, 0.6);
        font-size: 0.875rem;
        margin-top: 4px;
      }

      .recent-requests {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .request-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 4px;
      }

      .request-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .request-project {
        font-weight: 500;
      }

      .request-date {
        color: rgba(0, 0, 0, 0.6);
        font-size: 0.875rem;
      }

      .request-details {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .request-amount {
        font-weight: 500;
        color: #2e7d32;
      }

      @media (max-width: 768px) {
        .user-detail-container {
          padding: 12px;
        }

        .info-grid {
          grid-template-columns: 1fr;
        }

        .request-item {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }

        .request-details {
          align-self: flex-end;
        }
      }
    `,
  ],
})
export class UserDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  user: UserDetails | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(
        switchMap(params => {
          const userId = params['id'];
          return this.adminService.getUserDetails(userId);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: user => {
          this.user = user;
          this.loading = false;
        },
        error: error => {
          console.error('Failed to load user details:', error);
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }

  getRoleColor(role: string): 'primary' | 'accent' | 'warn' | undefined {
    switch (role) {
      case 'administrator':
        return 'warn';
      case 'manager':
        return 'accent';
      case 'employee':
      default:
        return 'primary';
    }
  }

  getStatusColor(status: string): 'primary' | 'accent' | 'warn' | undefined {
    switch (status) {
      case 'active':
        return 'primary';
      case 'inactive':
        return 'warn';
      case 'pending':
        return 'accent';
      default:
        return undefined;
    }
  }

  getRequestStatusColor(status: string): 'primary' | 'accent' | 'warn' | undefined {
    switch (status) {
      case 'approved':
        return 'primary';
      case 'pending':
        return 'accent';
      case 'rejected':
      case 'withdrawn':
        return 'warn';
      default:
        return undefined;
    }
  }
}
