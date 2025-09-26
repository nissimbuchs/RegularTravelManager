import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { RouterModule } from '@angular/router';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';

import { UserSummary } from '@rtm/shared';
import { AdminService } from '../../../core/services/admin.service';
import { LoadingService } from '../../../core/services/loading.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import {
  RoleChangeDialogComponent,
  RoleChangeDialogData,
  RoleChangeResult,
} from './role-change-dialog.component';
import {
  ManagerAssignmentDialogComponent,
  ManagerAssignmentDialogData,
  ManagerAssignmentResult,
} from './manager-assignment-dialog.component';
import {
  UserDeletionDialogComponent,
  UserDeletionDialogData,
  UserDeletionResult,
} from './user-deletion-dialog.component';

@Component({
  selector: 'app-user-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatCardModule,
  ],
  template: `
    <div class="user-management-container">
      <!-- Header -->
      <mat-card class="header-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>people</mat-icon>
            {{ translationService.translateSync('admin.users.title') }}
          </mat-card-title>
          <mat-card-subtitle>{{ translationService.translateSync('admin.users.subtitle') }}</mat-card-subtitle>
        </mat-card-header>

        <!-- Search and Filters -->
        <mat-card-content>
          <form [formGroup]="filterForm" class="filter-form">
            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.users.search.label') }}</mat-label>
              <input
                matInput
                formControlName="search"
                [placeholder]="translationService.translateSync('admin.users.search.placeholder')"
              />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.users.filters.role.label') }}</mat-label>
              <mat-select formControlName="role">
                <mat-option [value]="null">{{ translationService.translateSync('admin.users.filters.role.all') }}</mat-option>
                <mat-option value="employee">{{ translationService.translateSync('admin.users.filters.role.employee') }}</mat-option>
                <mat-option value="manager">{{ translationService.translateSync('admin.users.filters.role.manager') }}</mat-option>
                <mat-option value="administrator">{{ translationService.translateSync('admin.users.filters.role.administrator') }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.users.filters.status.label') }}</mat-label>
              <mat-select formControlName="status">
                <mat-option [value]="null">{{ translationService.translateSync('admin.users.filters.status.all') }}</mat-option>
                <mat-option value="active">{{ translationService.translateSync('common.status.active') }}</mat-option>
                <mat-option value="inactive">{{ translationService.translateSync('common.status.inactive') }}</mat-option>
                <mat-option value="pending">{{ translationService.translateSync('common.status.pending') }}</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="filter-actions">
              <button mat-stroked-button (click)="clearFilters()">
                <mat-icon>clear</mat-icon>
                {{ translationService.translateSync('admin.users.actions.clear_filters') }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- User Table -->
      <mat-card class="table-card">
        <div class="table-container">
          <div *ngIf="loading$ | async" class="loading-container">
            <mat-spinner diameter="40"></mat-spinner>
            <p>{{ translationService.translateSync('admin.users.loading') }}</p>
          </div>

          <table
            mat-table
            [dataSource]="dataSource"
            matSort
            class="user-table"
            *ngIf="!(loading$ | async)"
          >
            <!-- Name Column -->
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ translationService.translateSync('admin.users.table.columns.name') }}</th>
              <td mat-cell *matCellDef="let user">
                <div class="user-info">
                  <div class="user-name">
                    <strong>{{ user.firstName }} {{ user.lastName }}</strong>
                    <span class="employee-number">({{ user.employeeNumber }})</span>
                  </div>
                  <div class="user-email">{{ user.email }}</div>
                </div>
              </td>
            </ng-container>

            <!-- Role Column -->
            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ translationService.translateSync('admin.users.table.columns.role') }}</th>
              <td mat-cell *matCellDef="let user">
                <mat-chip [color]="getRoleColor(user.role)">
                  {{ user.role | titlecase }}
                </mat-chip>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>{{ translationService.translateSync('admin.users.table.columns.status') }}</th>
              <td mat-cell *matCellDef="let user">
                <mat-chip [color]="getStatusColor(user.status)">
                  <mat-icon>{{ getStatusIcon(user.status) }}</mat-icon>
                  {{ user.status | titlecase }}
                </mat-chip>
              </td>
            </ng-container>

            <!-- Manager Column -->
            <ng-container matColumnDef="manager">
              <th mat-header-cell *matHeaderCellDef>{{ translationService.translateSync('admin.users.table.columns.manager') }}</th>
              <td mat-cell *matCellDef="let user">
                <span *ngIf="user.managerName; else noManager">
                  {{ user.managerName }}
                </span>
                <ng-template #noManager>
                  <span class="no-manager">{{ translationService.translateSync('admin.users.table.values.no_manager') }}</span>
                </ng-template>
              </td>
            </ng-container>

            <!-- Activity Column -->
            <ng-container matColumnDef="activity">
              <th mat-header-cell *matHeaderCellDef>{{ translationService.translateSync('admin.users.table.columns.activity') }}</th>
              <td mat-cell *matCellDef="let user">
                <div class="activity-info">
                  <div class="request-count">
                    <mat-icon>assignment</mat-icon>
                    {{ translationService.translateSync('admin.users.table.values.request_count', { count: user.requestCount }) }}
                  </div>
                  <div class="verification-status" *ngIf="!user.isVerified">
                    <mat-icon color="warn">warning</mat-icon>
                    {{ translationService.translateSync('admin.users.table.values.unverified') }}
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Registration Column -->
            <ng-container matColumnDef="registration">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ translationService.translateSync('admin.users.table.columns.registered') }}</th>
              <td mat-cell *matCellDef="let user">
                {{ user.registrationDate | date: 'short' }}
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>{{ translationService.translateSync('admin.users.table.columns.actions') }}</th>
              <td mat-cell *matCellDef="let user">
                <div class="action-buttons">
                  <button
                    mat-icon-button
                    [routerLink]="['/admin/users', user.id]"
                    [matTooltip]="translationService.translateSync('admin.users.actions.view_details')"
                  >
                    <mat-icon>visibility</mat-icon>
                  </button>

                  <button mat-icon-button [matMenuTriggerFor]="userMenu" [matTooltip]="translationService.translateSync('admin.users.actions.more_actions')">
                    <mat-icon>more_vert</mat-icon>
                  </button>

                  <mat-menu #userMenu="matMenu">
                    <button mat-menu-item (click)="changeUserRole(user)">
                      <mat-icon>security</mat-icon>
                      {{ translationService.translateSync('admin.users.actions.change_role') }}
                    </button>
                    <button mat-menu-item (click)="assignManager(user)">
                      <mat-icon>supervisor_account</mat-icon>
                      {{ translationService.translateSync('admin.users.actions.assign_manager') }}
                    </button>
                    <button mat-menu-item (click)="toggleUserStatus(user)">
                      <mat-icon>{{ user.status === 'active' ? 'block' : 'check_circle' }}</mat-icon>
                      {{ user.status === 'active' ? translationService.translateSync('admin.users.actions.deactivate') : translationService.translateSync('admin.users.actions.activate') }}
                    </button>
                    <mat-divider></mat-divider>
                    <button mat-menu-item (click)="deleteUser(user)" class="danger-action">
                      <mat-icon color="warn">delete</mat-icon>
                      {{ translationService.translateSync('admin.users.actions.delete_user') }}
                    </button>
                  </mat-menu>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>

          <!-- Pagination -->
          <mat-paginator
            [length]="totalUsers"
            [pageSize]="pageSize"
            [pageSizeOptions]="[10, 25, 50, 100]"
            [pageIndex]="currentPage - 1"
            (page)="onPageChange($event)"
            showFirstLastButtons
          >
          </mat-paginator>
        </div>

        <!-- No Results -->
        <div *ngIf="!(loading$ | async) && dataSource.data.length === 0" class="no-results">
          <mat-icon>people_outline</mat-icon>
          <h3>{{ translationService.translateSync('admin.users.no_results.title') }}</h3>
          <p>{{ translationService.translateSync('admin.users.no_results.message') }}</p>
        </div>
      </mat-card>
    </div>
  `,
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  displayedColumns: string[] = [
    'name',
    'role',
    'status',
    'manager',
    'activity',
    'registration',
    'actions',
  ];

  dataSource = new MatTableDataSource<UserSummary>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  filterForm = new FormGroup({
    search: new FormControl(''),
    role: new FormControl<string | null>(null),
    status: new FormControl<string | null>(null),
  });

  // State from service
  loading$ = this.adminService.loading$;
  error$ = this.adminService.error$;

  // Pagination state
  totalUsers = 0;
  pageSize = 25;
  currentPage = 1;

  constructor(
    private adminService: AdminService,
    private loadingService: LoadingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.setupUserDataSubscription();
    this.setupFilterWatchers();
    // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.loadUsers();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupFilterWatchers(): void {
    // Watch for filter changes with debouncing
    this.filterForm.valueChanges
      .pipe(
        startWith(this.filterForm.value),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.currentPage = 1; // Reset to first page on filter change
        this.loadUsers();
      });
  }

  private setupUserDataSubscription(): void {
    // Subscribe to users and pagination data
    combineLatest([this.adminService.users$, this.adminService.pagination$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([users, pagination]) => {
        this.dataSource.data = users;
        if (pagination) {
          this.totalUsers = pagination.totalUsers;
          this.pageSize = pagination.pageSize;
          this.currentPage = pagination.currentPage;
        }
        // Trigger change detection for OnPush strategy
        this.cdr.markForCheck();
      });
  }

  private loadUsers(): void {
    const formValue = this.filterForm.value;
    const filters = {
      search: formValue.search?.trim() || undefined,
      role: formValue.role as 'employee' | 'manager' | 'administrator' | undefined,
      status: formValue.status as 'active' | 'inactive' | 'pending' | undefined,
    };

    const pagination = {
      page: this.currentPage,
      pageSize: this.pageSize,
      sortBy: 'registrationDate' as const,
      sortOrder: 'desc' as const,
    };

    this.adminService.loadUsers(filters, pagination).subscribe({
      error: error => {
        console.error('Failed to load users:', error);
        this.snackBar.open(
          this.translationService.translateSync('admin.users.messages.load_failed'),
          this.translationService.translateSync('common.buttons.close'),
          { duration: 3000 }
        );
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadUsers();
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      role: null,
      status: null,
    });
  }

  changeUserRole(user: UserSummary): void {
    const dialogData: RoleChangeDialogData = { user };

    const dialogRef = this.dialog.open(RoleChangeDialogComponent, {
      data: dialogData,
      maxWidth: '90vw',
      maxHeight: '90vh',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: RoleChangeResult) => {
        if (result) {
          this.adminService
            .updateUserRole(user.id, {
              userId: user.id,
              newRole: result.newRole as any,
              reason: result.reason,
            })
            .subscribe({
              next: () => {
                this.snackBar.open(
                  this.translationService.translateSync('admin.users.messages.role_changed', { role: result.newRole }),
                  this.translationService.translateSync('common.buttons.close'),
                  {
                  duration: 3000,
                });
                // User list will be refreshed automatically by the admin service
              },
              error: error => {
                console.error('Failed to change user role:', error);
                this.snackBar.open(
                  this.translationService.translateSync('admin.users.messages.role_change_failed'),
                  this.translationService.translateSync('common.buttons.close'),
                  { duration: 3000 }
                );
              },
            });
        }
      });
  }

  assignManager(user: UserSummary): void {
    const dialogData: ManagerAssignmentDialogData = { user };

    const dialogRef = this.dialog.open(ManagerAssignmentDialogComponent, {
      data: dialogData,
      maxWidth: '90vw',
      maxHeight: '90vh',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: ManagerAssignmentResult) => {
        if (result) {
          this.adminService
            .updateUserManager(user.id, {
              userId: user.id,
              managerId: result.managerId,
              reason: result.reason,
            })
            .subscribe({
              next: () => {
                const action = result.managerId ? 'assigned' : 'removed';
                const messageKey = action === 'assigned' ? 'admin.users.messages.manager_assigned' : 'admin.users.messages.manager_removed';
                this.snackBar.open(
                  this.translationService.translateSync(messageKey),
                  this.translationService.translateSync('common.buttons.close'),
                  { duration: 3000 }
                );
                // User list will be refreshed automatically by the admin service
              },
              error: error => {
                console.error('Failed to update manager assignment:', error);
                this.snackBar.open(
                  this.translationService.translateSync('admin.users.messages.manager_assignment_failed'),
                  this.translationService.translateSync('common.buttons.close'),
                  {
                  duration: 3000,
                });
              },
            });
        }
      });
  }

  toggleUserStatus(user: UserSummary): void {
    const newStatus = user.status === 'active' ? false : true;
    const action = newStatus ? 'activate' : 'deactivate';

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: this.translationService.translateSync(action === 'activate' ? 'admin.users.dialogs.activate_user' : 'admin.users.dialogs.deactivate_user'),
        message: this.translationService.translateSync(action === 'activate' ? 'admin.users.dialogs.activate_user_message' : 'admin.users.dialogs.deactivate_user_message', { name: `${user.firstName} ${user.lastName}` }),
        confirmText: this.translationService.translateSync(action === 'activate' ? 'admin.users.dialogs.activate_confirm' : 'admin.users.dialogs.deactivate_confirm'),
        confirmColor: action === 'activate' ? 'primary' : 'warn',
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) {
          this.adminService
            .updateUserStatus(user.id, {
              isActive: newStatus,
              reason: this.translationService.translateSync(action === 'activate' ? 'admin.users.audit.user_activated' : 'admin.users.audit.user_deactivated'),
            })
            .subscribe({
              next: () => {
                const successKey = action === 'activate' ? 'admin.users.messages.user_activated' : 'admin.users.messages.user_deactivated';
                this.snackBar.open(
                  this.translationService.translateSync(successKey),
                  this.translationService.translateSync('common.buttons.close'),
                  {
                  duration: 3000,
                });
              },
              error: error => {
                console.error('Failed to update user status:', error);
                const errorKey = action === 'activate' ? 'admin.users.messages.user_activate_failed' : 'admin.users.messages.user_deactivate_failed';
                this.snackBar.open(
                  this.translationService.translateSync(errorKey),
                  this.translationService.translateSync('common.buttons.close'),
                  { duration: 3000 }
                );
              },
            });
        }
      });
  }

  deleteUser(user: UserSummary): void {
    const dialogData: UserDeletionDialogData = { user };

    const dialogRef = this.dialog.open(UserDeletionDialogComponent, {
      data: dialogData,
      maxWidth: '90vw',
      maxHeight: '90vh',
      disableClose: true, // Prevent accidental closure
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: UserDeletionResult) => {
        if (result && result.confirmed) {
          this.adminService.deleteUser(user.id, { reason: result.reason }).subscribe({
            next: summary => {
              this.snackBar.open(
                this.translationService.translateSync('admin.users.messages.user_deleted', { name: `${user.firstName} ${user.lastName}` }),
                this.translationService.translateSync('common.buttons.close'),
                { duration: 3000 }
              );
              console.log('Deletion summary:', summary);
              // User list will be refreshed automatically by the admin service
            },
            error: error => {
              console.error('Failed to delete user:', error);
              this.snackBar.open(
                this.translationService.translateSync('admin.users.messages.user_delete_failed'),
                this.translationService.translateSync('common.buttons.close'),
                { duration: 3000 }
              );
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

  getStatusIcon(status: string): string {
    switch (status) {
      case 'active':
        return 'check_circle';
      case 'inactive':
        return 'block';
      case 'pending':
        return 'schedule';
      default:
        return 'help';
    }
  }
}
