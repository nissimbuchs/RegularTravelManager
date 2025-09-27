import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { timer, of } from 'rxjs';

import { EmployeeDashboardService } from '../employee-dashboard.service';
import { ConfigService } from '../../../../core/services/config.service';
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
} from '../../models/employee-dashboard.model';

describe('EmployeeDashboardService', () => {
  let service: EmployeeDashboardService;
  let httpMock: HttpTestingController;
  let mockConfigService: jasmine.SpyObj<ConfigService>;

  const mockApiUrl = 'https://test-api.com';

  const mockDashboardData: EmployeeDashboard = {
    requests: [
      {
        id: 'request-1',
        projectName: 'Test Project',
        projectCode: 'TP-001',
        subProjectName: 'Test Subproject',
        status: 'pending',
        submittedDate: new Date('2025-09-20T10:00:00Z'),
        processedDate: undefined,
        dailyAllowance: 50.0,
        weeklyAllowance: 150.0,
        daysPerWeek: 3,
        justification: 'Test justification',
        managerName: 'Test Manager',
        managerEmail: 'manager@test.com',
        calculatedDistance: 25.5,
        costPerKm: 0.7,
      },
    ],
    totalRequests: 1,
    pendingCount: 1,
    approvedCount: 0,
    rejectedCount: 0,
    withdrawnCount: 0,
    totalApprovedAllowance: 0,
  };

  const mockRequestDetails: RequestDetails = {
    id: 'request-1',
    projectName: 'Test Project',
    subProjectName: 'Test Subproject',
    justification: 'Detailed justification',
    managerName: 'Test Manager',
    managerEmail: 'manager@test.com',
    calculatedDistance: 25.5,
    costPerKm: 0.7,
    dailyAllowance: 50.0,
    weeklyAllowance: 150.0,
    monthlyEstimate: 650.0,
    daysPerWeek: 3,
    status: 'pending',
    submittedDate: new Date('2025-09-20T10:00:00Z'),
    processedDate: undefined,
    statusHistory: [
      {
        status: 'pending',
        timestamp: new Date('2025-09-20T10:00:00Z'),
        processedBy: 'System',
        note: 'Request submitted',
      },
    ],
    employeeAddress: '123 Test Street, Test City',
    subprojectAddress: '456 Project Ave, Project City',
  };

  beforeEach(() => {
    const configServiceSpy = jasmine.createSpyObj('ConfigService', [], {
      apiUrl: mockApiUrl,
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [EmployeeDashboardService, { provide: ConfigService, useValue: configServiceSpy }],
    });

    service = TestBed.inject(EmployeeDashboardService);
    httpMock = TestBed.inject(HttpTestingController);
    mockConfigService = TestBed.inject(ConfigService) as jasmine.SpyObj<ConfigService>;
  });

  afterEach(() => {
    httpMock.verify();
    service.ngOnDestroy(); // Cleanup subscriptions
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getDashboardData', () => {
    const pagination: PaginationConfig = { pageIndex: 0, pageSize: 25, totalCount: 0 };
    const sort: SortConfig = { active: 'submittedDate', direction: 'desc' };

    it('should fetch dashboard data with basic parameters', () => {
      const filters: RequestFilters = {};

      service.getDashboardData(filters, pagination, sort).subscribe(dashboard => {
        expect(dashboard).toEqual(mockDashboardData);
        expect(dashboard.requests[0].submittedDate).toBeInstanceOf(Date);
      });

      const req = httpMock.expectOne(
        `${mockApiUrl}/employees/dashboard/requests?pageIndex=0&pageSize=25&sortActive=submittedDate&sortDirection=desc`
      );
      expect(req.request.method).toBe('GET');

      const response: GetEmployeeRequestsResponse = {
        data: {
          ...mockDashboardData,
          requests: [
            {
              ...mockDashboardData.requests[0],
              submittedDate: '2025-09-20T10:00:00Z' as any, // Simulate API string response
            },
          ],
        },
      };
      req.flush(response);
    });

    it('should include all filter parameters in request', () => {
      const filters: RequestFilters = {
        status: 'pending',
        projectName: 'Test',
        dateRange: {
          start: new Date('2025-09-01'),
          end: new Date('2025-09-30'),
        },
      };

      service.getDashboardData(filters, pagination, sort).subscribe();

      const req = httpMock.expectOne(request => {
        const url = request.url;
        return (
          url.includes('status=pending') &&
          url.includes('projectName=Test') &&
          url.includes('dateRangeStart=2025-09-01') &&
          url.includes('dateRangeEnd=2025-09-30')
        );
      });
      expect(req.request.method).toBe('GET');

      req.flush({ data: mockDashboardData });
    });

    it('should handle API errors', () => {
      const filters: RequestFilters = {};

      service.getDashboardData(filters, pagination, sort).subscribe({
        next: () => fail('should have failed'),
        error: error => {
          expect(error.status).toBe(500);
        },
      });

      const req = httpMock.expectOne(request =>
        request.url.includes('/employees/dashboard/requests')
      );
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should update loading states correctly', () => {
      const filters: RequestFilters = {};
      const loadingStates: boolean[] = [];

      service.loading$.subscribe(loading => loadingStates.push(loading));

      service.getDashboardData(filters, pagination, sort).subscribe();

      const req = httpMock.expectOne(request =>
        request.url.includes('/employees/dashboard/requests')
      );

      // Should start with loading true
      expect(loadingStates).toContain(true);

      req.flush({ data: mockDashboardData });

      // Should end with loading false
      expect(loadingStates[loadingStates.length - 1]).toBe(false);
    });

    it('should update dashboard subject with response data', () => {
      const filters: RequestFilters = {};
      const dashboardUpdates: (EmployeeDashboard | null)[] = [];

      service.dashboard$.subscribe(dashboard => dashboardUpdates.push(dashboard));

      service.getDashboardData(filters, pagination, sort).subscribe();

      const req = httpMock.expectOne(request =>
        request.url.includes('/employees/dashboard/requests')
      );
      req.flush({ data: mockDashboardData });

      expect(dashboardUpdates[dashboardUpdates.length - 1]).toEqual(mockDashboardData);
    });
  });

  describe('getRequestDetails', () => {
    it('should fetch request details successfully', () => {
      const requestId = 'request-1';

      service.getRequestDetails(requestId).subscribe(details => {
        expect(details).toEqual(mockRequestDetails);
        expect(details.submittedDate).toBeInstanceOf(Date);
        expect(details.statusHistory[0].timestamp).toBeInstanceOf(Date);
      });

      const req = httpMock.expectOne(`${mockApiUrl}/employees/requests/${requestId}/details`);
      expect(req.request.method).toBe('GET');

      const response: GetRequestDetailsResponse = {
        data: {
          ...mockRequestDetails,
          submittedDate: '2025-09-20T10:00:00Z' as any, // Simulate API string response
          statusHistory: [
            {
              ...mockRequestDetails.statusHistory[0],
              timestamp: '2025-09-20T10:00:00Z' as any,
            },
          ],
        },
      };
      req.flush(response);
    });

    it('should handle request details errors', () => {
      const requestId = 'nonexistent-request';

      service.getRequestDetails(requestId).subscribe({
        next: () => fail('should have failed'),
        error: error => {
          expect(error.status).toBe(404);
        },
      });

      const req = httpMock.expectOne(`${mockApiUrl}/employees/requests/${requestId}/details`);
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('withdrawRequest', () => {
    it('should withdraw request successfully', () => {
      const requestId = 'request-1';
      const mockResponse: WithdrawRequestResponse = {
        success: true,
        message: 'Request withdrawn successfully',
      };

      // Setup initial dashboard state
      service['dashboardSubject'].next(mockDashboardData);

      service.withdrawRequest(requestId).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${mockApiUrl}/employees/requests/${requestId}/withdraw`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockResponse);

      // Check that dashboard state was updated optimistically
      const updatedDashboard = service.getCurrentDashboard();
      expect(updatedDashboard?.requests[0].status).toBe('withdrawn');
      expect(updatedDashboard?.pendingCount).toBe(0);
      expect(updatedDashboard?.withdrawnCount).toBe(1);
    });

    it('should handle withdrawal errors', () => {
      const requestId = 'request-1';

      service.withdrawRequest(requestId).subscribe({
        next: () => fail('should have failed'),
        error: error => {
          expect(error.status).toBe(400);
        },
      });

      const req = httpMock.expectOne(`${mockApiUrl}/employees/requests/${requestId}/withdraw`);
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });
    });

    it('should not update dashboard state if request not found', () => {
      const requestId = 'nonexistent-request';
      const originalDashboard = { ...mockDashboardData };
      service['dashboardSubject'].next(originalDashboard);

      service.withdrawRequest(requestId).subscribe();

      const req = httpMock.expectOne(`${mockApiUrl}/employees/requests/${requestId}/withdraw`);
      req.flush({ success: true, message: 'Done' });

      // Dashboard should remain unchanged since request wasn't found
      const updatedDashboard = service.getCurrentDashboard();
      expect(updatedDashboard).toEqual(originalDashboard);
    });
  });

  describe('Auto-refresh functionality', () => {
    beforeEach(() => {
      // Mock timer to avoid long waits in tests
      spyOn(window, 'setInterval').and.callFake((callback: any) => {
        // Execute immediately for testing
        setTimeout(callback, 0);
        return 123 as any; // Mock interval ID
      });
      spyOn(window, 'clearInterval');
    });

    it('should start auto-refresh', () => {
      service.startAutoRefresh().subscribe();

      // Auto-refresh should make periodic calls
      setTimeout(() => {
        const req = httpMock.expectOne(request =>
          request.url.includes('/employees/dashboard/requests')
        );
        req.flush({ data: mockDashboardData });
      }, 10);
    });

    it('should stop auto-refresh', () => {
      service.startAutoRefresh().subscribe();
      service.stopAutoRefresh();

      expect(window.clearInterval).toHaveBeenCalled();
    });

    it('should handle auto-refresh errors silently', () => {
      spyOn(console, 'error');

      service.startAutoRefresh().subscribe();

      setTimeout(() => {
        const req = httpMock.expectOne(request =>
          request.url.includes('/employees/dashboard/requests')
        );
        req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

        // Should log error but not propagate
        expect(console.error).toHaveBeenCalledWith('Auto-refresh failed:', jasmine.any(Object));
      }, 10);
    });

    it('should not log auth errors during auto-refresh', () => {
      spyOn(console, 'error');

      service.startAutoRefresh().subscribe();

      setTimeout(() => {
        const req = httpMock.expectOne(request =>
          request.url.includes('/employees/dashboard/requests')
        );
        req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

        // Should not log auth errors
        expect(console.error).not.toHaveBeenCalled();
      }, 10);
    });
  });

  describe('State management', () => {
    it('should provide current dashboard state', () => {
      service['dashboardSubject'].next(mockDashboardData);

      const currentDashboard = service.getCurrentDashboard();
      expect(currentDashboard).toEqual(mockDashboardData);
    });

    it('should clear dashboard state', () => {
      service['dashboardSubject'].next(mockDashboardData);

      service.clearDashboard();

      expect(service.getCurrentDashboard()).toBe(null);
    });

    it('should cleanup subscriptions', () => {
      spyOn(service['destroy$'], 'next');
      spyOn(console, 'log');

      service.cleanup();

      expect(service['destroy$'].next).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        'EmployeeDashboardService: All subscriptions cleaned up'
      );
    });

    it('should expose observables for reactive state', () => {
      expect(service.dashboard$).toBeDefined();
      expect(service.loading$).toBeDefined();
      expect(service.error$).toBeDefined();
    });
  });

  describe('Subscription lifecycle', () => {
    it('should complete destroy subject on ngOnDestroy', () => {
      spyOn(service['destroy$'], 'next');
      spyOn(service['destroy$'], 'complete');

      service.ngOnDestroy();

      expect(service['destroy$'].next).toHaveBeenCalled();
      expect(service['destroy$'].complete).toHaveBeenCalled();
    });

    it('should stop auto-refresh on ngOnDestroy', () => {
      spyOn(service, 'stopAutoRefresh');

      service.ngOnDestroy();

      expect(service.stopAutoRefresh).toHaveBeenCalled();
    });
  });
});
