import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, timer, Subject } from 'rxjs';
import { map, switchMap, tap, takeUntil } from 'rxjs/operators';
import {
  EmployeeDashboard,
  EmployeeRequestSummary,
  RequestDetails,
  RequestFilters,
  PaginationConfig,
  SortConfig,
  GetEmployeeRequestsResponse,
  GetRequestDetailsResponse,
  WithdrawRequestResponse,
} from '../models/employee-dashboard.model';
import { ConfigService } from '../../../core/services/config.service';

@Injectable({
  providedIn: 'root',
})
export class EmployeeDashboardService implements OnDestroy {
  private configService = inject(ConfigService);
  private dashboardSubject = new BehaviorSubject<EmployeeDashboard | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables following established patterns
  public dashboard$ = this.dashboardSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  // Auto-refresh configuration matching manager dashboard
  private autoRefreshInterval = 2 * 60 * 1000; // 2 minutes
  private autoRefreshSubscription?: any;
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  /**
   * Get employee dashboard data with filtering, pagination, and sorting
   * Following the same pattern as manager dashboard service
   */
  getDashboardData(
    filters: RequestFilters = {},
    pagination: PaginationConfig,
    sort: SortConfig
  ): Observable<EmployeeDashboard> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    let params = new HttpParams()
      .set('pageIndex', pagination.pageIndex.toString())
      .set('pageSize', pagination.pageSize.toString())
      .set('sortActive', sort.active)
      .set('sortDirection', sort.direction);

    // Add filters if present
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    if (filters.projectName) {
      params = params.set('projectName', filters.projectName);
    }
    if (filters.dateRange) {
      params = params.set('dateRangeStart', filters.dateRange.start.toISOString());
      params = params.set('dateRangeEnd', filters.dateRange.end.toISOString());
    }

    return this.http
      .get<GetEmployeeRequestsResponse>(`${this.baseUrl}/employees/dashboard/requests`, { params })
      .pipe(
        map(response => {
          const dashboard = response.data;
          // Transform date strings back to Date objects
          dashboard.requests = dashboard.requests.map(request => ({
            ...request,
            submittedDate: new Date(request.submittedDate),
            processedDate: request.processedDate ? new Date(request.processedDate) : undefined,
            statusHistory:
              request.statusHistory?.map(history => ({
                ...history,
                timestamp: new Date(history.timestamp),
              })) || [],
          }));
          return dashboard;
        }),
        tap(dashboard => {
          this.dashboardSubject.next(dashboard);
          this.loadingSubject.next(false);
        }),
        takeUntil(this.destroy$)
      );
  }

  /**
   * Get detailed information for a specific request
   */
  getRequestDetails(requestId: string): Observable<RequestDetails> {
    return this.http
      .get<GetRequestDetailsResponse>(`${this.baseUrl}/employees/requests/${requestId}/details`)
      .pipe(
        map(response => {
          const details = response.data;
          // Transform dates
          return {
            ...details,
            submittedDate: new Date(details.submittedDate),
            processedDate: details.processedDate ? new Date(details.processedDate) : undefined,
            statusHistory: (details.statusHistory || []).map(history => ({
              ...history,
              timestamp: new Date(history.timestamp),
            })),
          };
        }),
        takeUntil(this.destroy$)
      );
  }

  /**
   * Withdraw a pending travel request
   */
  withdrawRequest(requestId: string): Observable<WithdrawRequestResponse> {
    return this.http
      .put<WithdrawRequestResponse>(`${this.baseUrl}/employees/requests/${requestId}/withdraw`, {})
      .pipe(
        tap(() => {
          // Refresh dashboard data after withdrawal
          const currentDashboard = this.dashboardSubject.value;
          if (currentDashboard) {
            // Update the request status locally for immediate feedback
            const updatedRequests = currentDashboard.requests.map(request =>
              request.id === requestId ? { ...request, status: 'withdrawn' as const } : request
            );

            // Update counts
            const updatedDashboard = {
              ...currentDashboard,
              requests: updatedRequests,
              pendingCount: currentDashboard.pendingCount - 1,
              withdrawnCount: currentDashboard.withdrawnCount + 1,
            };

            this.dashboardSubject.next(updatedDashboard);
          }
        }),
        takeUntil(this.destroy$)
      );
  }

  /**
   * Start auto-refresh functionality following manager dashboard pattern
   */
  startAutoRefresh(): Observable<EmployeeDashboard | null> {
    this.stopAutoRefresh();

    // Get current dashboard state for refresh parameters
    const currentDashboard = this.dashboardSubject.value;
    const defaultPagination: PaginationConfig = { pageIndex: 0, pageSize: 25, totalCount: 0 };
    const defaultSort: SortConfig = { active: 'submittedDate', direction: 'desc' };

    this.autoRefreshSubscription = timer(this.autoRefreshInterval, this.autoRefreshInterval)
      .pipe(
        switchMap(() => this.getDashboardData({}, defaultPagination, defaultSort)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: dashboard => {
          this.dashboardSubject.next(dashboard);
        },
        error: error => {
          // Handle auto-refresh errors silently to avoid overwhelming user
          if (error.status !== 401 && error.status !== 403) {
            console.error('Auto-refresh failed:', error);
          }
        },
      });

    return this.dashboard$;
  }

  /**
   * Stop auto-refresh functionality
   */
  stopAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = null;
    }
  }

  /**
   * Manual refresh of dashboard data
   */
  refreshDashboard(
    filters: RequestFilters = {},
    pagination: PaginationConfig,
    sort: SortConfig
  ): Observable<EmployeeDashboard> {
    return this.getDashboardData(filters, pagination, sort);
  }

  /**
   * Get current dashboard state
   */
  getCurrentDashboard(): EmployeeDashboard | null {
    return this.dashboardSubject.value;
  }

  /**
   * Clear dashboard state
   */
  clearDashboard(): void {
    this.dashboardSubject.next(null);
    this.loadingSubject.next(false);
    this.errorSubject.next(null);
  }

  /**
   * Cleanup method for logout scenarios following established patterns
   */
  public cleanup(): void {
    this.destroy$.next();
    this.stopAutoRefresh();
    this.clearDashboard();
    console.log('EmployeeDashboardService: All subscriptions cleaned up');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoRefresh();
  }
}
