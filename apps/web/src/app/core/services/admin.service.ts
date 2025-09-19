import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil, tap, catchError, map } from 'rxjs/operators';
import {
  UserSummary,
  UserDetails,
  AdminUserListing,
  UserStatusUpdateRequest,
  UserDeletionRequest,
  UserDeletionSummary,
  RoleChangeRequest,
  RoleChangeValidation,
  ManagerAssignmentRequest,
  ManagerAssignmentValidation,
} from '@rtm/shared';

interface UserFilters {
  search?: string;
  role?: 'employee' | 'manager' | 'administrator';
  status?: 'active' | 'inactive' | 'pending';
  department?: string;
  managerId?: string;
}

interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'email' | 'role' | 'lastLogin' | 'registrationDate';
  sortOrder?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root',
})
export class AdminService implements OnDestroy {
  private destroy$ = new Subject<void>();

  // State management for user listing
  private usersSubject = new BehaviorSubject<UserSummary[]>([]);
  private paginationSubject = new BehaviorSubject<AdminUserListing['pagination'] | null>(null);
  private filtersSubject = new BehaviorSubject<UserFilters>({});
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables
  public users$ = this.usersSubject.asObservable();
  public pagination$ = this.paginationSubject.asObservable();
  public filters$ = this.filtersSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Load users with pagination and filtering
   */
  loadUsers(
    filters: UserFilters = {},
    pagination: PaginationParams = {}
  ): Observable<AdminUserListing> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    // Build query parameters
    let params = new HttpParams();

    // Add pagination params
    if (pagination.page) params = params.set('page', pagination.page.toString());
    if (pagination.pageSize) params = params.set('pageSize', pagination.pageSize.toString());
    if (pagination.sortBy) params = params.set('sortBy', pagination.sortBy);
    if (pagination.sortOrder) params = params.set('sortOrder', pagination.sortOrder);

    // Add filter params
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.role) params = params.set('role', filters.role);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.department) params = params.set('department', filters.department);
    if (filters.managerId) params = params.set('managerId', filters.managerId);

    return this.http.get<{ data: AdminUserListing }>('/api/admin/users', { params }).pipe(
      map(response => response.data),
      tap(response => {
        this.usersSubject.next(response.users);
        this.paginationSubject.next(response.pagination);
        this.filtersSubject.next(filters);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.errorSubject.next(error.error?.message || 'Failed to load users');
        this.loadingSubject.next(false);
        throw error;
      }),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Get detailed user information
   */
  getUserDetails(userId: string): Observable<UserDetails> {
    return this.http.get<{ data: UserDetails }>(`/api/admin/users/${userId}`).pipe(
      map(response => response.data),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Update user status (activate/deactivate)
   */
  updateUserStatus(userId: string, statusUpdate: UserStatusUpdateRequest): Observable<any> {
    return this.http.put(`/api/admin/users/${userId}/status`, statusUpdate).pipe(
      tap(() => {
        // Refresh current user list
        const currentFilters = this.filtersSubject.value;
        this.refreshUsers(currentFilters);
      }),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Update user role with validation
   */
  updateUserRole(userId: string, roleChange: RoleChangeRequest): Observable<any> {
    return this.http.put(`/api/admin/users/${userId}/role`, roleChange).pipe(
      tap(() => {
        // Refresh current user list
        const currentFilters = this.filtersSubject.value;
        this.refreshUsers(currentFilters);
      }),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Validate role change before execution
   */
  validateRoleChange(userId: string, newRole: string): Observable<RoleChangeValidation> {
    return this.http
      .post<{ data: RoleChangeValidation }>(`/api/admin/users/${userId}/role/validate`, {
        newRole,
      })
      .pipe(
        map(response => response.data),
        takeUntil(this.destroy$)
      );
  }

  /**
   * Update user manager assignment
   */
  updateUserManager(userId: string, managerAssignment: ManagerAssignmentRequest): Observable<any> {
    return this.http.put(`/api/admin/users/${userId}/manager`, managerAssignment).pipe(
      tap(() => {
        // Refresh current user list
        const currentFilters = this.filtersSubject.value;
        this.refreshUsers(currentFilters);
      }),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Validate manager assignment before execution
   */
  validateManagerAssignment(
    userId: string,
    managerId: string
  ): Observable<ManagerAssignmentValidation> {
    return this.http
      .post<{ data: ManagerAssignmentValidation }>(`/api/admin/users/${userId}/manager/validate`, {
        managerId,
      })
      .pipe(
        map(response => response.data),
        takeUntil(this.destroy$)
      );
  }

  /**
   * Delete user with comprehensive cleanup
   */
  deleteUser(
    userId: string,
    deletionRequest: UserDeletionRequest
  ): Observable<UserDeletionSummary> {
    return this.http
      .delete<{ data: UserDeletionSummary }>(`/api/admin/users/${userId}`, {
        body: deletionRequest,
      })
      .pipe(
        map(response => response.data),
        tap(() => {
          // Refresh current user list
          const currentFilters = this.filtersSubject.value;
          this.refreshUsers(currentFilters);
        }),
        takeUntil(this.destroy$)
      );
  }

  /**
   * Search users by multiple criteria
   */
  searchUsers(searchTerm: string): Observable<UserSummary[]> {
    const filters: UserFilters = { search: searchTerm };
    return this.loadUsers(filters).pipe(
      map(response => response.users),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Get available managers for assignment
   */
  getAvailableManagers(): Observable<UserSummary[]> {
    const filters: UserFilters = {
      role: 'manager',
      status: 'active',
    };
    return this.loadUsers(filters, { pageSize: 100 }).pipe(
      map(response => response.users),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Get users by role
   */
  getUsersByRole(role: 'employee' | 'manager' | 'administrator'): Observable<UserSummary[]> {
    const filters: UserFilters = { role };
    return this.loadUsers(filters).pipe(
      map(response => response.users),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Clear current error state
   */
  clearError(): void {
    this.errorSubject.next(null);
  }

  /**
   * Reset filters and pagination
   */
  resetFilters(): void {
    this.filtersSubject.next({});
    this.loadUsers();
  }

  /**
   * Refresh users with current filters
   */
  private refreshUsers(filters: UserFilters = {}): void {
    const currentPagination = this.paginationSubject.value;
    const paginationParams: PaginationParams = {};

    if (currentPagination) {
      paginationParams.page = currentPagination.currentPage;
      paginationParams.pageSize = currentPagination.pageSize;
    }

    this.loadUsers(filters, paginationParams).subscribe({
      error: error => {
        // Handle refresh errors silently during logout
        if (error.status !== 401 && error.status !== 403) {
          console.error('Failed to refresh users:', error);
        }
      },
    });
  }

  /**
   * Cleanup method for logout scenarios
   */
  cleanup(): void {
    this.destroy$.next();
    console.log('AdminService: All subscriptions cleaned up');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
