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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

import { UserDetails } from '@rtm/shared';
import { AdminService } from '../../../core/services/admin.service';
import { TranslationService } from '../../../core/services/translation.service';
import { UserProfileDialogComponent } from './user-profile-dialog.component';

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
    MatDialogModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="user-detail-container">
      <!-- Loading State -->
      <div *ngIf="loading" class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
        <p>{{ translationService.translateSync('admin.user_detail.loading') }}</p>
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
              {{ translationService.translateSync('admin.user_detail.actions.back_to_users') }}
            </button>
            <button mat-raised-button color="primary" (click)="editUser()">
              <mat-icon>edit</mat-icon>
              {{ translationService.translateSync('admin.user_detail.actions.edit_user') }}
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- User Information Tabs -->
        <mat-tab-group>
          <!-- Basic Information -->
          <mat-tab [label]="translationService.translateSync('admin.user_detail.tabs.basic_information')">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>{{ translationService.translateSync('admin.user_detail.sections.personal_information') }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="info-grid">
                    <div class="info-item">
                      <label>{{ translationService.translateSync('admin.user_detail.labels.full_name') }}</label>
                      <span>{{ user.firstName }} {{ user.lastName }}</span>
                    </div>
                    <div class="info-item">
                      <label>{{ translationService.translateSync('admin.user_detail.labels.email') }}</label>
                      <span>{{ user.email }}</span>
                    </div>
                    <div class="info-item">
                      <label>{{ translationService.translateSync('admin.user_detail.labels.employee_number') }}</label>
                      <span>{{ user.employeeNumber }}</span>
                    </div>
                    <div class="info-item">
                      <label>{{ translationService.translateSync('admin.user_detail.labels.phone_number') }}</label>
                      <span>{{ user.phoneNumber || translationService.translateSync('admin.user_detail.values.not_provided') }}</span>
                    </div>
                    <div class="info-item">
                      <label>{{ translationService.translateSync('admin.user_detail.labels.status') }}</label>
                      <mat-chip [color]="getStatusColor(user.status)">
                        {{ user.status | titlecase }}
                      </mat-chip>
                    </div>
                    <div class="info-item">
                      <label>{{ translationService.translateSync('admin.user_detail.labels.verified') }}</label>
                      <mat-chip [color]="user.isVerified ? 'primary' : 'warn'">
                        {{ user.isVerified ? translationService.translateSync('common.values.yes') : translationService.translateSync('common.values.no') }}
                      </mat-chip>
                    </div>
                    <div class="info-item">
                      <label>{{ translationService.translateSync('admin.user_detail.labels.registration_date') }}</label>
                      <span>{{ user.registrationDate | date: 'medium' }}</span>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Address Information -->
              <mat-card>
                <mat-card-header>
                  <mat-card-title>{{ translationService.translateSync('admin.user_detail.sections.address_information') }}</mat-card-title>
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
          <mat-tab [label]="translationService.translateSync('admin.user_detail.tabs.management')">
            <div class="tab-content">
              <!-- Manager Information -->
              <mat-card *ngIf="user.managerName">
                <mat-card-header>
                  <mat-card-title>{{ translationService.translateSync('admin.user_detail.sections.reports_to') }}</mat-card-title>
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
                  <mat-card-title>{{ translationService.translateSync('admin.user_detail.sections.direct_reports', { count: user.directReports.length }) }}</mat-card-title>
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
          <mat-tab [label]="translationService.translateSync('admin.user_detail.tabs.activity')">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>{{ translationService.translateSync('admin.user_detail.sections.travel_request_activity') }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="activity-stats">
                    <div class="stat-item">
                      <div class="stat-value">{{ user.activitySummary.totalRequests }}</div>
                      <div class="stat-label">{{ translationService.translateSync('admin.user_detail.stats.total_requests') }}</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-value">{{ user.activitySummary.requestsThisMonth }}</div>
                      <div class="stat-label">{{ translationService.translateSync('admin.user_detail.stats.this_month') }}</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-value">
                        {{ user.activitySummary.averageRequestValue | currency: 'CHF' }}
                      </div>
                      <div class="stat-label">{{ translationService.translateSync('admin.user_detail.stats.average_value') }}</div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Recent Requests -->
              <mat-card *ngIf="user.recentRequests.length > 0">
                <mat-card-header>
                  <mat-card-title>{{ translationService.translateSync('admin.user_detail.sections.recent_travel_requests') }}</mat-card-title>
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
        <h3>{{ translationService.translateSync('admin.user_detail.errors.user_not_found') }}</h3>
        <p>{{ translationService.translateSync('admin.user_detail.errors.user_not_found_message') }}</p>
        <button mat-raised-button color="primary" (click)="goBack()">{{ translationService.translateSync('admin.user_detail.actions.back_to_users') }}</button>
      </div>
    </div>
  `,
  styleUrls: ['./user-detail.component.scss'],
})
export class UserDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  user: UserDetails | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminService: AdminService,
    public translationService: TranslationService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
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

  editUser(): void {
    if (!this.user) return;

    const dialogRef = this.dialog.open(UserProfileDialogComponent, {
      width: '800px',
      data: {
        title: this.translationService.translateSync('admin.user_detail.dialogs.edit_user_profile'),
        user: this.user,
        isAdminEdit: true,
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        // Reload user details to show updated data
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
              this.snackBar.open(
                this.translationService.translateSync('admin.user_detail.messages.profile_updated'),
                this.translationService.translateSync('common.buttons.close'),
                { duration: 3000 }
              );
            },
            error: error => {
              console.error('Failed to reload user details:', error);
            },
          });
      }
    });
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
