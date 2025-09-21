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

import { ManagerDashboardService } from '../services/manager-dashboard.service';
import {
  ManagerDashboard,
  TravelRequestSummary,
  DashboardFilters,
  PaginationConfig,
  SortConfig,
  EmployeeContext,
} from '../models/dashboard.model';

@Component({
  selector: 'app-manager-request-queue',
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
      state('in', style({ transform: 'translateX(0)' })),
      state('out', style({ transform: 'translateX(100%)' })),
      transition('in => out', animate('300ms ease-in-out')),
      transition('out => in', animate('300ms ease-in-out')),
    ]),
    trigger('fadeInOut', [
      transition(':enter', [style({ opacity: 0 }), animate('300ms', style({ opacity: 1 }))]),
      transition(':leave', [animate('300ms', style({ opacity: 0 }))]),
    ]),
  ],
  templateUrl: './manager-request-queue.component.html',
  styleUrls: ['./manager-request-queue.component.scss'],
})
export class ManagerRequestQueueComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'urgency',
    'employeeName',
    'projectName',
    'subProjectName',
    'daysPerWeek',
    'calculatedAllowance',
    'submittedDate',
    'daysSinceSubmission',
    'actions',
  ];

  dataSource = new MatTableDataSource<TravelRequestSummary>();
  dashboard: ManagerDashboard | null = null;
  selectedRequest: TravelRequestSummary | null = null;
  employeeContext: EmployeeContext | null = null;
  isLoading = false;
  isLoadingContext = false;
  isProcessingAction = false;
  actionType: 'approve' | 'reject' | null = null;
  showEmployeePanel = false;

  filterForm: FormGroup;

  pagination: PaginationConfig = {
    pageIndex: 0,
    pageSize: 25,
    totalItems: 0,
    pageSizeOptions: [10, 25, 50],
  };

  sortConfig: SortConfig = {
    active: 'submittedDate',
    direction: 'desc',
  };

  urgencyLevels = [
    { value: 'high', label: 'High Priority', color: '#f44336' },
    { value: 'medium', label: 'Medium Priority', color: '#ff9800' },
    { value: 'low', label: 'Low Priority', color: '#4caf50' },
  ];

  private destroy$ = new Subject<void>();
  private lastRefresh = new Date();

  constructor(
    private managerDashboardService: ManagerDashboardService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.filterForm = this.fb.group({
      employeeName: [''],
      projectName: [''],
      subProjectName: [''],
      dateRangeStart: [''],
      dateRangeEnd: [''],
      allowanceMin: [''],
      allowanceMax: [''],
      urgencyLevels: [[]],
    });
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.setupFilterSubscriptions();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.managerDashboardService.stopAutoRefresh();
  }

  private initializeComponent(): void {
    this.loadDashboardData();
  }

  private setupFilterSubscriptions(): void {
    // Debounce filter changes to avoid excessive API calls
    this.filterForm.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.pagination.pageIndex = 0; // Reset to first page when filters change
        this.loadDashboardData();
      });
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    const filters = this.buildFilters();

    this.managerDashboardService
      .getDashboardData(filters, this.pagination, this.sortConfig)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: dashboard => {
          this.dashboard = dashboard;
          this.dataSource.data = dashboard.pendingRequests;
          this.pagination.totalItems = dashboard.totalPending;
          this.isLoading = false;
          this.lastRefresh = new Date();
        },
        error: (error: any) => {
          console.error('Failed to load dashboard data:', error);
          this.isLoading = false;
          this.snackBar
            .open('Failed to load pending requests. Please try again.', 'Retry', { duration: 5000 })
            .onAction()
            .subscribe(() => {
              this.loadDashboardData();
            });
        },
      });
  }

  private buildFilters(): DashboardFilters {
    const formValue = this.filterForm.value;
    const filters: DashboardFilters = {};

    if (formValue.employeeName) filters.employeeName = formValue.employeeName;
    if (formValue.projectName) filters.projectName = formValue.projectName;
    if (formValue.subProjectName) filters.subProjectName = formValue.subProjectName;

    if (formValue.dateRangeStart && formValue.dateRangeEnd) {
      filters.dateRange = {
        start: new Date(formValue.dateRangeStart),
        end: new Date(formValue.dateRangeEnd),
      };
    }

    if (formValue.allowanceMin || formValue.allowanceMax) {
      filters.allowanceRange = {
        min: formValue.allowanceMin || 0,
        max: formValue.allowanceMax || 10000,
      };
    }

    if (formValue.urgencyLevels && formValue.urgencyLevels.length > 0) {
      filters.urgencyLevels = formValue.urgencyLevels;
    }

    return filters;
  }

  onPageChange(event: any): void {
    this.pagination.pageIndex = event.pageIndex;
    this.pagination.pageSize = event.pageSize;
    this.loadDashboardData();
  }

  onSortChange(event: any): void {
    this.sortConfig.active = event.active;
    this.sortConfig.direction = event.direction;
    this.pagination.pageIndex = 0; // Reset to first page when sorting changes
    this.loadDashboardData();
  }

  selectRequest(request: TravelRequestSummary): void {
    this.selectedRequest = request;
    this.loadEmployeeContext(request);
    this.showEmployeePanel = true;
  }

  closeEmployeePanel(): void {
    this.showEmployeePanel = false;
    this.selectedRequest = null;
    this.employeeContext = null;
  }

  private loadEmployeeContext(request: TravelRequestSummary): void {
    // Use the full email as employee ID since it matches the cognito_user_id in database
    const employeeId = request.employeeEmail;

    this.isLoadingContext = true;
    this.managerDashboardService
      .getEmployeeContext(employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: context => {
          this.employeeContext = context;
          this.isLoadingContext = false;
        },
        error: (error: any) => {
          console.error('Failed to load employee context:', error);
          this.isLoadingContext = false;
          this.snackBar.open('Failed to load employee details. Please try again.', 'Close', {
            duration: 5000,
          });
        },
      });
  }

  refreshData(): void {
    this.loadDashboardData();
    this.snackBar.open('Data refreshed', 'Close', { duration: 2000 });
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.pagination.pageIndex = 0;
    this.loadDashboardData();
  }

  private startAutoRefresh(): void {
    const filters = this.buildFilters();
    this.managerDashboardService.startAutoRefresh(filters, this.pagination, this.sortConfig);

    // Subscribe to dashboard updates
    this.managerDashboardService.dashboard$.pipe(takeUntil(this.destroy$)).subscribe(dashboard => {
      if (dashboard) {
        this.dashboard = dashboard;
        this.dataSource.data = dashboard.pendingRequests;
        this.pagination.totalItems = dashboard.totalPending;
      }
    });
  }

  getUrgencyColor(urgency: 'low' | 'medium' | 'high'): string {
    const level = this.urgencyLevels.find(u => u.value === urgency);
    return level ? level.color : '#666';
  }

  getUrgencyIcon(urgency: 'low' | 'medium' | 'high'): string {
    switch (urgency) {
      case 'high':
        return 'priority_high';
      case 'medium':
        return 'remove';
      case 'low':
        return 'keyboard_arrow_down';
      default:
        return 'remove';
    }
  }

  getUrgencyIconForLevel(level: { value: string; label: string; color: string }): string {
    return this.getUrgencyIcon(level.value as 'low' | 'medium' | 'high');
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  }

  get lastRefreshTime(): string {
    return new Intl.DateTimeFormat('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(this.lastRefresh);
  }

  // Action methods for request approval/rejection
  approveRequest(request: TravelRequestSummary): void {
    this.isProcessingAction = true;
    this.actionType = 'approve';

    this.managerDashboardService.approveRequest(request.id).subscribe({
      next: (response: any) => {
        this.snackBar.open(
          `Travel request for ${request.employeeName} has been approved successfully.`,
          'Close',
          { duration: 4000 }
        );

        // Remove request from table and refresh data
        this.removeRequestFromTable(request.id);
        this.isProcessingAction = false;
        this.actionType = null;
        this.closeEmployeePanel();
      },
      error: (error: any) => {
        console.error('Error approving request:', error);
        this.snackBar.open(
          `Failed to approve request for ${request.employeeName}. Please try again.`,
          'Close',
          { duration: 4000 }
        );
        this.isProcessingAction = false;
        this.actionType = null;
      },
    });
  }

  openRejectDialog(request: TravelRequestSummary): void {
    // For now, simulate rejection without dialog
    // In a real implementation, this would open a dialog for rejection reason
    this.rejectRequest(request, 'Rejected by manager');
  }

  private rejectRequest(request: TravelRequestSummary, reason: string): void {
    this.isProcessingAction = true;
    this.actionType = 'reject';

    this.managerDashboardService.rejectRequest(request.id, reason).subscribe({
      next: (response: any) => {
        this.snackBar.open(
          `Travel request for ${request.employeeName} has been rejected.`,
          'Close',
          { duration: 4000 }
        );

        // Remove request from table and refresh data
        this.removeRequestFromTable(request.id);
        this.isProcessingAction = false;
        this.actionType = null;
        this.closeEmployeePanel();
      },
      error: (error: any) => {
        console.error('Error rejecting request:', error);
        this.snackBar.open(
          `Failed to reject request for ${request.employeeName}. Please try again.`,
          'Close',
          { duration: 4000 }
        );
        this.isProcessingAction = false;
        this.actionType = null;
      },
    });
  }

  viewRequestDetails(request: TravelRequestSummary): void {
    // Show the employee's justification for the travel request
    this.snackBar.open(
      `Justification: ${request.justification}`,
      'Close',
      {
        duration: 8000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      }
    );
  }

  private removeRequestFromTable(requestId: string): void {
    // Remove from current data source
    const currentData = this.dataSource.data;
    const filteredData = currentData.filter(req => req.id !== requestId);
    this.dataSource.data = filteredData;

    // Update dashboard counts
    if (this.dashboard) {
      this.dashboard.totalPending = Math.max(0, this.dashboard.totalPending - 1);
      // Update urgent count if the removed request was urgent
      const removedRequest = currentData.find(req => req.id === requestId);
      if (removedRequest?.urgencyLevel === 'high') {
        this.dashboard.urgentCount = Math.max(0, this.dashboard.urgentCount - 1);
      }
    }

    // Update pagination total
    this.pagination.totalItems = Math.max(0, this.pagination.totalItems - 1);
  }
}
