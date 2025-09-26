import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, merge } from 'rxjs';

import { EmployeeDashboardService } from '../services/employee-dashboard.service';
import { TranslationService } from '../../../core/services/translation.service';
import {
  EmployeeDashboard,
  EmployeeRequestSummary,
  RequestFilters,
  PaginationConfig,
  SortConfig,
} from '../models/employee-dashboard.model';

@Component({
  selector: 'app-employee-request-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatExpansionModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  animations: [
    trigger('slideInOut', [
      state('in', style({ height: '*', opacity: 1 })),
      state('out', style({ height: '0px', opacity: 0 })),
      transition('in => out', animate('300ms ease-in-out')),
      transition('out => in', animate('300ms ease-in-out')),
    ]),
    trigger('fadeInOut', [
      transition(':enter', [style({ opacity: 0 }), animate('300ms', style({ opacity: 1 }))]),
      transition(':leave', [animate('300ms', style({ opacity: 0 }))]),
    ]),
  ],
  templateUrl: './employee-request-dashboard.component.html',
  styleUrls: ['./employee-request-dashboard.component.scss'],
})
export class EmployeeRequestDashboardComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'status',
    'projectName',
    'subProjectName',
    'daysPerWeek',
    'dailyAllowance',
    'weeklyAllowance',
    'submittedDate',
    'processedDate',
    'actions',
  ];

  dataSource = new MatTableDataSource<EmployeeRequestSummary>();
  dashboard: EmployeeDashboard | null = null;
  selectedRequest: EmployeeRequestSummary | null = null;
  isLoading = false;
  showDetailsPanel = false;

  filterForm: FormGroup;

  pagination: PaginationConfig = {
    pageIndex: 0,
    pageSize: 25,
    totalCount: 0,
  };

  sortConfig: SortConfig = {
    active: 'submittedDate',
    direction: 'desc',
  };

  filters: RequestFilters = {};

  private destroy$ = new Subject<void>();
  private autoRefreshSubscription?: any;

  // Status color mappings following established patterns
  statusConfig = {
    pending: { color: '#ff9800', backgroundColor: '#fff3e0', icon: 'hourglass_empty' },
    approved: { color: '#4caf50', backgroundColor: '#e8f5e9', icon: 'check_circle' },
    rejected: { color: '#f44336', backgroundColor: '#ffebee', icon: 'cancel' },
    withdrawn: { color: '#9e9e9e', backgroundColor: '#f5f5f5', icon: 'remove_circle' },
  };

  constructor(
    private fb: FormBuilder,
    private employeeDashboardService: EmployeeDashboardService,
    private snackBar: MatSnackBar,
    public translationService: TranslationService
  ) {
    this.filterForm = this.createFilterForm();
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.setupFilterWatchers();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoRefresh();
  }

  private createFilterForm(): FormGroup {
    return this.fb.group({
      status: [''],
      projectName: [''],
      dateRangeStart: [''],
      dateRangeEnd: [''],
    });
  }

  private initializeComponent(): void {
    this.loadDashboardData();
  }

  private setupFilterWatchers(): void {
    // Watch for filter changes with debouncing
    this.filterForm.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  private startAutoRefresh(): void {
    // Auto-refresh every 2 minutes following manager dashboard pattern
    this.autoRefreshSubscription = this.employeeDashboardService
      .startAutoRefresh()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: dashboard => {
          if (dashboard) {
            this.dashboard = dashboard;
            this.updateDataSource();
            this.showRefreshNotification();
          }
        },
        error: error => {
          // Silently handle auto-refresh errors to avoid overwhelming user
          console.error('Auto-refresh failed:', error);
        },
      });
  }

  private stopAutoRefresh(): void {
    this.employeeDashboardService.stopAutoRefresh();
  }

  private showRefreshNotification(): void {
    this.snackBar.open(this.translationService.translateSync('employee.request_dashboard.messages.updated'), this.translationService.translateSync('common.actions.close'), {
      duration: 2000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['success-snackbar'],
    });
  }

  loadDashboardData(): void {
    this.isLoading = true;

    this.employeeDashboardService
      .getDashboardData(this.filters, this.pagination, this.sortConfig)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: dashboard => {
          this.dashboard = dashboard;
          this.pagination.totalCount = dashboard.totalRequests;
          this.updateDataSource();
          this.isLoading = false;
        },
        error: error => {
          console.error('Failed to load dashboard data:', error);
          this.snackBar.open(this.translationService.translateSync('employee.request_dashboard.errors.load_failed'), this.translationService.translateSync('common.actions.close'), {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.isLoading = false;
        },
      });
  }

  private updateDataSource(): void {
    if (this.dashboard) {
      this.dataSource.data = this.dashboard.requests;

      // Update paginator after data load
      if (this.paginator) {
        this.paginator.length = this.pagination.totalCount;
        this.paginator.pageIndex = this.pagination.pageIndex;
        this.paginator.pageSize = this.pagination.pageSize;
      }
    }
  }

  applyFilters(): void {
    const formValue = this.filterForm.value;

    this.filters = {
      status: formValue.status || undefined,
      projectName: formValue.projectName || undefined,
      dateRange:
        formValue.dateRangeStart && formValue.dateRangeEnd
          ? {
              start: formValue.dateRangeStart,
              end: formValue.dateRangeEnd,
            }
          : undefined,
    };

    // Reset to first page when applying filters
    this.pagination.pageIndex = 0;
    this.loadDashboardData();
  }

  onPageChange(event: any): void {
    this.pagination.pageIndex = event.pageIndex;
    this.pagination.pageSize = event.pageSize;
    this.loadDashboardData();
  }

  onSortChange(sort: any): void {
    this.sortConfig.active = sort.active;
    this.sortConfig.direction = sort.direction === '' ? 'asc' : sort.direction;
    this.pagination.pageIndex = 0; // Reset to first page on sort
    this.loadDashboardData();
  }

  selectRequest(request: EmployeeRequestSummary): void {
    this.selectedRequest = request;
    this.loadRequestDetails(request.id);
    this.showDetailsPanel = true;
  }

  closeDetailsPanel(): void {
    this.showDetailsPanel = false;
    this.selectedRequest = null;
  }

  private loadRequestDetails(requestId: string): void {
    this.employeeDashboardService
      .getRequestDetails(requestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: details => {
          if (this.selectedRequest) {
            this.selectedRequest = { ...this.selectedRequest, ...details };
          }
        },
        error: error => {
          console.error('Failed to load request details:', error);
          this.snackBar.open(this.translationService.translateSync('employee.request_dashboard.errors.details_failed'), this.translationService.translateSync('common.actions.close'), {
            duration: 3000,
            panelClass: ['error-snackbar'],
          });
        },
      });
  }

  withdrawRequest(request: EmployeeRequestSummary): void {
    if (!request || request.status !== 'pending') {
      return;
    }

    const confirmed = confirm(
      this.translationService.translateSync('employee.request_dashboard.confirm.withdraw', { project: request.projectName })
    );
    if (!confirmed) {
      return;
    }

    this.employeeDashboardService
      .withdrawRequest(request.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open(this.translationService.translateSync('employee.request_dashboard.messages.withdrawn'), this.translationService.translateSync('common.actions.close'), {
            duration: 3000,
            panelClass: ['success-snackbar'],
          });
          this.loadDashboardData(); // Refresh data
        },
        error: error => {
          console.error('Failed to withdraw request:', error);
          this.snackBar.open(this.translationService.translateSync('employee.request_dashboard.errors.withdraw_failed'), this.translationService.translateSync('common.actions.close'), {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
        },
      });
  }

  refreshDashboard(): void {
    this.loadDashboardData();
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.filters = {};
    this.pagination.pageIndex = 0;
    this.loadDashboardData();
  }

  getStatusChipClass(status: string): any {
    const config = this.statusConfig[status as keyof typeof this.statusConfig];
    return {
      color: config?.color || '#666',
      'background-color': config?.backgroundColor || '#f5f5f5',
    };
  }

  getStatusIcon(status: string): string {
    const config = this.statusConfig[status as keyof typeof this.statusConfig];
    return config?.icon || 'help';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('de-CH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateObj);
  }

  canWithdrawRequest(status: string): boolean {
    return status === 'pending';
  }
}
