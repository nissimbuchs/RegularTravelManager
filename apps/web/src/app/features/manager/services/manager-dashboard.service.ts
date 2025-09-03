import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, timer } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import {
  ManagerDashboard,
  EmployeeContext,
  DashboardFilters,
  PaginationConfig,
  SortConfig,
} from '../models/dashboard.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ManagerDashboardService {
  private readonly baseUrl = environment.apiUrl;
  private dashboardSubject = new BehaviorSubject<ManagerDashboard | null>(null);
  public dashboard$ = this.dashboardSubject.asObservable();

  private autoRefreshInterval = 2 * 60 * 1000; // 2 minutes
  private autoRefreshSubscription?: any;

  constructor(private http: HttpClient) {}

  getDashboardData(
    filters: DashboardFilters = {},
    pagination: PaginationConfig,
    sort: SortConfig
  ): Observable<ManagerDashboard> {
    let params = new HttpParams()
      .set('pageIndex', pagination.pageIndex.toString())
      .set('pageSize', pagination.pageSize.toString())
      .set('sortActive', sort.active)
      .set('sortDirection', sort.direction);

    if (filters.employeeName) {
      params = params.set('employeeName', filters.employeeName);
    }
    if (filters.projectName) {
      params = params.set('projectName', filters.projectName);
    }
    if (filters.dateRange) {
      params = params.set('dateRangeStart', filters.dateRange.start.toISOString());
      params = params.set('dateRangeEnd', filters.dateRange.end.toISOString());
    }
    if (filters.allowanceRange) {
      params = params.set('allowanceMin', filters.allowanceRange.min.toString());
      params = params.set('allowanceMax', filters.allowanceRange.max.toString());
    }
    if (filters.urgencyLevels && filters.urgencyLevels.length > 0) {
      params = params.set('urgencyLevels', filters.urgencyLevels.join(','));
    }

    return this.http
      .get<ManagerDashboard>(`${this.baseUrl}/api/manager/dashboard`, { params })
      .pipe(
        map(dashboard => {
          // Transform date strings back to Date objects
          dashboard.pendingRequests = dashboard.pendingRequests.map(request => ({
            ...request,
            submittedDate: new Date(request.submittedDate),
          }));
          return dashboard;
        }),
        tap(dashboard => this.dashboardSubject.next(dashboard))
      );
  }

  getEmployeeContext(employeeId: string): Observable<EmployeeContext> {
    return this.http
      .get<EmployeeContext>(`${this.baseUrl}/api/manager/employee-context/${employeeId}`);
  }

  startAutoRefresh(
    filters: DashboardFilters,
    pagination: PaginationConfig,
    sort: SortConfig
  ): void {
    this.stopAutoRefresh();

    this.autoRefreshSubscription = timer(this.autoRefreshInterval, this.autoRefreshInterval)
      .pipe(switchMap(() => this.getDashboardData(filters, pagination, sort)))
      .subscribe({
        next: dashboard => {
          // Notify about new requests if count increased
          const currentDashboard = this.dashboardSubject.value;
          if (currentDashboard && dashboard.totalPending > currentDashboard.totalPending) {
            this.notifyNewRequests(dashboard.totalPending - currentDashboard.totalPending);
          }
        },
        error: error => {
          console.error('Auto-refresh failed:', error);
        },
      });
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = undefined;
    }
  }

  approveRequest(
    requestId: string
  ): Observable<{ id: string; status: string; message: string }> {
    return this.http.put<{ id: string; status: string; message: string }>(
      `${this.baseUrl}/api/manager/requests/${requestId}/approve`,
      {}
    );
  }

  rejectRequest(
    requestId: string,
    reason: string
  ): Observable<{ id: string; status: string; message: string }> {
    return this.http.put<{ id: string; status: string; message: string }>(
      `${this.baseUrl}/api/manager/requests/${requestId}/reject`,
      { reason }
    );
  }

  private notifyNewRequests(count: number): void {
    // This could integrate with a notification service
    console.log(`${count} new travel request${count > 1 ? 's' : ''} received`);
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }
}
