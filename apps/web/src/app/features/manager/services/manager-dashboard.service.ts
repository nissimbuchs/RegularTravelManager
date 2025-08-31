import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, timer } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { 
  ManagerDashboard, 
  TravelRequestSummary, 
  EmployeeContext, 
  DashboardFilters,
  PaginationConfig,
  SortConfig
} from '../models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class ManagerDashboardService {
  private readonly baseUrl = 'https://api.your-domain.com'; // Update with actual API URL
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
    // Mock data for development - replace with actual API call
    const mockDashboard: ManagerDashboard = {
      pendingRequests: this.generateMockRequests(),
      totalPending: 23,
      urgentCount: 5,
      filters,
      employeeContext: undefined
    };

    return of(mockDashboard).pipe(
      map(dashboard => this.applyFiltersAndSorting(dashboard, filters, pagination, sort)),
      tap(dashboard => this.dashboardSubject.next(dashboard)),
      catchError(error => {
        console.error('Failed to load dashboard data:', error);
        throw error;
      })
    );
    
    // Actual API call (uncomment when backend is ready):
    // let params = new HttpParams()
    //   .set('pageIndex', pagination.pageIndex.toString())
    //   .set('pageSize', pagination.pageSize.toString())
    //   .set('sortActive', sort.active)
    //   .set('sortDirection', sort.direction);
    
    // if (filters.employeeName) params = params.set('employeeName', filters.employeeName);
    // if (filters.projectName) params = params.set('projectName', filters.projectName);
    // // Add other filter parameters...
    
    // return this.http.get<ApiResponse<ManagerDashboard>>(`${this.baseUrl}/api/manager/dashboard`, { params })
    //   .pipe(
    //     map(response => response.data),
    //     tap(dashboard => this.dashboardSubject.next(dashboard)),
    //     catchError(this.handleError<ManagerDashboard>('getDashboardData'))
    //   );
  }

  getEmployeeContext(employeeId: string): Observable<EmployeeContext> {
    // Mock data for development - enhanced with more detailed context
    const mockContext: EmployeeContext = {
      employee: {
        id: employeeId,
        name: 'John Doe',
        email: 'john.doe@company.com',
        department: 'Engineering',
        position: 'Senior Software Developer',
        managerId: 'current-manager-id'
      },
      currentWeeklyAllowance: 245.50,
      activeRequestsCount: 2,
      recentHistory: [],
      totalRequestsThisYear: 18,
      averageWeeklyAllowance: 220.75,
      departmentBudgetUtilization: 72.5, // percentage
      recentApprovals: 15,
      recentRejections: 1,
      performanceScore: 8.7
    };

    return of(mockContext).pipe(
      catchError(error => {
        console.error('Failed to load employee context:', error);
        throw error;
      })
    );

    // Actual API call (uncomment when backend is ready):
    // return this.http.get<ApiResponse<EmployeeContext>>(`${this.baseUrl}/api/manager/employee-context/${employeeId}`)
    //   .pipe(
    //     map(response => response.data),
    //     catchError(this.handleError<EmployeeContext>('getEmployeeContext'))
    //   );
  }

  startAutoRefresh(filters: DashboardFilters, pagination: PaginationConfig, sort: SortConfig): void {
    this.stopAutoRefresh();
    
    this.autoRefreshSubscription = timer(this.autoRefreshInterval, this.autoRefreshInterval)
      .pipe(
        switchMap(() => this.getDashboardData(filters, pagination, sort))
      )
      .subscribe({
        next: (dashboard) => {
          // Notify about new requests if count increased
          const currentDashboard = this.dashboardSubject.value;
          if (currentDashboard && dashboard.totalPending > currentDashboard.totalPending) {
            this.notifyNewRequests(dashboard.totalPending - currentDashboard.totalPending);
          }
        },
        error: (error) => {
          console.error('Auto-refresh failed:', error);
        }
      });
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = undefined;
    }
  }

  private generateMockRequests(): TravelRequestSummary[] {
    const mockEmployees = [
      'Anna Mueller', 'Hans Schmidt', 'Lisa Weber', 'Thomas Fischer', 
      'Maria Schneider', 'Peter Meier', 'Claudia Bauer', 'Stefan Wolf'
    ];
    
    const mockProjects = [
      { project: 'Swiss Infrastructure Development', subproject: 'Zurich Office Complex' },
      { project: 'Digital Transformation Initiative', subproject: 'Basel Research Center' },
      { project: 'Green Energy Project', subproject: 'Bern Wind Farm' },
      { project: 'Smart Cities Program', subproject: 'Geneva Innovation Hub' }
    ];

    const requests: TravelRequestSummary[] = [];
    
    for (let i = 0; i < 15; i++) {
      const submittedDate = new Date();
      submittedDate.setDate(submittedDate.getDate() - Math.floor(Math.random() * 14));
      const daysSinceSubmission = Math.floor((new Date().getTime() - submittedDate.getTime()) / (1000 * 3600 * 24));
      
      const employee = mockEmployees[Math.floor(Math.random() * mockEmployees.length)];
      const project = mockProjects[Math.floor(Math.random() * mockProjects.length)];
      const daysPerWeek = Math.floor(Math.random() * 5) + 1;
      const calculatedAllowance = Math.round((Math.random() * 200 + 50) * 100) / 100;
      
      let urgencyLevel: 'low' | 'medium' | 'high' = 'low';
      if (daysSinceSubmission > 7) urgencyLevel = 'high';
      else if (daysSinceSubmission > 3) urgencyLevel = 'medium';

      requests.push({
        id: `req-${i + 1}`,
        employeeName: employee,
        employeeEmail: `${employee.toLowerCase().replace(' ', '.')}@company.com`,
        projectName: project.project,
        subProjectName: project.subproject,
        daysPerWeek,
        calculatedAllowance,
        submittedDate,
        urgencyLevel,
        daysSinceSubmission
      });
    }

    return requests.sort((a, b) => b.submittedDate.getTime() - a.submittedDate.getTime());
  }

  private applyFiltersAndSorting(
    dashboard: ManagerDashboard, 
    filters: DashboardFilters,
    pagination: PaginationConfig,
    sort: SortConfig
  ): ManagerDashboard {
    let filteredRequests = [...dashboard.pendingRequests];

    // Apply filters
    if (filters.employeeName) {
      const searchTerm = filters.employeeName.toLowerCase();
      filteredRequests = filteredRequests.filter(req => 
        req.employeeName.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.projectName) {
      filteredRequests = filteredRequests.filter(req => 
        req.projectName.toLowerCase().includes(filters.projectName!.toLowerCase())
      );
    }

    if (filters.dateRange) {
      filteredRequests = filteredRequests.filter(req => 
        req.submittedDate >= filters.dateRange!.start && 
        req.submittedDate <= filters.dateRange!.end
      );
    }

    if (filters.allowanceRange) {
      filteredRequests = filteredRequests.filter(req => 
        req.calculatedAllowance >= filters.allowanceRange!.min &&
        req.calculatedAllowance <= filters.allowanceRange!.max
      );
    }

    if (filters.urgencyLevels && filters.urgencyLevels.length > 0) {
      filteredRequests = filteredRequests.filter(req => 
        filters.urgencyLevels!.includes(req.urgencyLevel)
      );
    }

    // Apply sorting
    filteredRequests.sort((a, b) => {
      let comparison = 0;
      
      switch (sort.active) {
        case 'employeeName':
          comparison = a.employeeName.localeCompare(b.employeeName);
          break;
        case 'submittedDate':
          comparison = a.submittedDate.getTime() - b.submittedDate.getTime();
          break;
        case 'calculatedAllowance':
          comparison = a.calculatedAllowance - b.calculatedAllowance;
          break;
        case 'urgencyLevel':
          const urgencyOrder = { high: 3, medium: 2, low: 1 };
          comparison = urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
          break;
        default:
          comparison = b.submittedDate.getTime() - a.submittedDate.getTime(); // Default: newest first
      }
      
      return sort.direction === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const startIndex = pagination.pageIndex * pagination.pageSize;
    const paginatedRequests = filteredRequests.slice(startIndex, startIndex + pagination.pageSize);

    return {
      ...dashboard,
      pendingRequests: paginatedRequests,
      totalPending: filteredRequests.length,
      urgentCount: filteredRequests.filter(req => req.urgencyLevel === 'high').length
    };
  }

  private notifyNewRequests(count: number): void {
    // This could integrate with a notification service
    console.log(`${count} new travel request${count > 1 ? 's' : ''} received`);
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      return of(result as T);
    };
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }
}