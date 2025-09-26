import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError, BehaviorSubject } from 'rxjs';

import { EmployeeRequestDashboardComponent } from '../employee-request-dashboard.component';
import { EmployeeDashboardService } from '../../services/employee-dashboard.service';
import {
  EmployeeDashboard,
  EmployeeRequestSummary,
  RequestFilters,
  PaginationConfig,
  SortConfig,
} from '../../models/employee-dashboard.model';

describe('EmployeeRequestDashboardComponent', () => {
  let component: EmployeeRequestDashboardComponent;
  let fixture: ComponentFixture<EmployeeRequestDashboardComponent>;
  let mockEmployeeDashboardService: jasmine.SpyObj<EmployeeDashboardService>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;

  const mockDashboardData: EmployeeDashboard = {
    requests: [
      {
        id: 'request-1',
        projectName: 'Test Project',
        projectCode: 'TP-001',
        subProjectName: 'Test Subproject',
        status: 'pending',
        submittedDate: new Date('2025-09-20'),
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
      {
        id: 'request-2',
        projectName: 'Another Project',
        subProjectName: 'Another Subproject',
        status: 'approved',
        submittedDate: new Date('2025-09-18'),
        processedDate: new Date('2025-09-19'),
        dailyAllowance: 75.0,
        weeklyAllowance: 300.0,
        daysPerWeek: 4,
        justification: 'Another justification',
        managerName: 'Another Manager',
        calculatedDistance: 35.2,
        costPerKm: 0.75,
      },
    ],
    totalRequests: 2,
    pendingCount: 1,
    approvedCount: 1,
    rejectedCount: 0,
    withdrawnCount: 0,
    totalApprovedAllowance: 1300.0,
  };

  beforeEach(async () => {
    const employeeDashboardServiceSpy = jasmine.createSpyObj(
      'EmployeeDashboardService',
      [
        'getDashboardData',
        'getRequestDetails',
        'withdrawRequest',
        'refreshDashboard',
        'startAutoRefresh',
        'stopAutoRefresh',
        'getCurrentDashboard',
        'clearDashboard',
        'cleanup',
      ],
      {
        dashboard$: new BehaviorSubject<EmployeeDashboard | null>(mockDashboardData),
        loading$: new BehaviorSubject<boolean>(false),
        error$: new BehaviorSubject<string | null>(null),
      }
    );

    const snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [
        EmployeeRequestDashboardComponent,
        ReactiveFormsModule,
        BrowserAnimationsModule,
        HttpClientTestingModule,
      ],
      providers: [
        FormBuilder,
        { provide: EmployeeDashboardService, useValue: employeeDashboardServiceSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeRequestDashboardComponent);
    component = fixture.componentInstance;
    mockEmployeeDashboardService = TestBed.inject(
      EmployeeDashboardService
    ) as jasmine.SpyObj<EmployeeDashboardService>;
    mockSnackBar = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should initialize with default pagination and sort settings', () => {
      expect(component.pagination).toEqual({
        pageIndex: 0,
        pageSize: 25,
        totalCount: 0,
      });

      expect(component.sortConfig).toEqual({
        active: 'submittedDate',
        direction: 'desc',
      });
    });

    it('should create filter form with correct controls', () => {
      component.ngOnInit();

      expect(component.filterForm.get('status')).toBeTruthy();
      expect(component.filterForm.get('projectName')).toBeTruthy();
      expect(component.filterForm.get('dateRangeStart')).toBeTruthy();
      expect(component.filterForm.get('dateRangeEnd')).toBeTruthy();
    });

    it('should load dashboard data on initialization', () => {
      mockEmployeeDashboardService.getDashboardData.and.returnValue(of(mockDashboardData));

      component.ngOnInit();

      expect(mockEmployeeDashboardService.getDashboardData).toHaveBeenCalledWith(
        {},
        component.pagination,
        component.sortConfig
      );
    });
  });

  describe('Dashboard Data Loading', () => {
    beforeEach(() => {
      mockEmployeeDashboardService.getDashboardData.and.returnValue(of(mockDashboardData));
    });

    it('should load dashboard data successfully', () => {
      component.loadDashboardData();

      expect(mockEmployeeDashboardService.getDashboardData).toHaveBeenCalled();
      expect(component.dashboard).toEqual(mockDashboardData);
      expect(component.pagination.totalCount).toBe(2);
    });

    it('should handle dashboard loading errors', () => {
      const error = new Error('Failed to load data');
      mockEmployeeDashboardService.getDashboardData.and.returnValue(throwError(() => error));
      spyOn(console, 'error');

      component.loadDashboardData();

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to load dashboard data', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      expect(console.error).toHaveBeenCalledWith('Failed to load dashboard data:', error);
    });

    it('should update data source when dashboard data changes', () => {
      component.loadDashboardData();

      expect(component.dataSource.data).toEqual(mockDashboardData.requests);
    });
  });

  describe('Filtering', () => {
    it('should apply filters with all form values', () => {
      mockEmployeeDashboardService.getDashboardData.and.returnValue(of(mockDashboardData));

      const startDate = new Date('2025-09-01');
      const endDate = new Date('2025-09-30');

      component.filterForm.patchValue({
        status: 'pending',
        projectName: 'Test',
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
      });

      component.applyFilters();

      const expectedFilters: RequestFilters = {
        status: 'pending',
        projectName: 'Test',
        dateRange: {
          start: startDate,
          end: endDate,
        },
      };

      expect(mockEmployeeDashboardService.getDashboardData).toHaveBeenCalledWith(
        expectedFilters,
        jasmine.objectContaining({ pageIndex: 0 }), // Should reset page
        component.sortConfig
      );
    });

    it('should handle partial filter values', () => {
      mockEmployeeDashboardService.getDashboardData.and.returnValue(of(mockDashboardData));

      component.filterForm.patchValue({
        status: 'approved',
        projectName: '',
        dateRangeStart: null,
        dateRangeEnd: null,
      });

      component.applyFilters();

      const expectedFilters: RequestFilters = {
        status: 'approved',
        projectName: undefined,
        dateRange: undefined,
      };

      expect(mockEmployeeDashboardService.getDashboardData).toHaveBeenCalledWith(
        expectedFilters,
        jasmine.objectContaining({ pageIndex: 0 }),
        component.sortConfig
      );
    });

    it('should clear all filters', () => {
      mockEmployeeDashboardService.getDashboardData.and.returnValue(of(mockDashboardData));

      component.filterForm.patchValue({
        status: 'pending',
        projectName: 'Test',
      });

      component.clearFilters();

      expect(component.filterForm.get('status')?.value).toBe(null);
      expect(component.filterForm.get('projectName')?.value).toBe(null);
      expect(mockEmployeeDashboardService.getDashboardData).toHaveBeenCalledWith(
        {},
        jasmine.objectContaining({ pageIndex: 0 }),
        component.sortConfig
      );
    });
  });

  describe('Pagination', () => {
    it('should handle page changes', () => {
      mockEmployeeDashboardService.getDashboardData.and.returnValue(of(mockDashboardData));

      const pageEvent = { pageIndex: 1, pageSize: 50 };
      component.onPageChange(pageEvent);

      expect(component.pagination.pageIndex).toBe(1);
      expect(component.pagination.pageSize).toBe(50);
      expect(mockEmployeeDashboardService.getDashboardData).toHaveBeenCalled();
    });
  });

  describe('Sorting', () => {
    it('should handle sort changes', () => {
      mockEmployeeDashboardService.getDashboardData.and.returnValue(of(mockDashboardData));

      const mockSort = { active: 'status', direction: 'asc' } as any;
      component.onSortChange(mockSort);

      expect(component.sortConfig.active).toBe('status');
      expect(component.sortConfig.direction).toBe('asc');
      expect(component.pagination.pageIndex).toBe(0); // Should reset page
      expect(mockEmployeeDashboardService.getDashboardData).toHaveBeenCalled();
    });
  });

  describe('Request Details', () => {
    const mockRequestDetails = {
      id: 'request-1',
      projectName: 'Test Project',
      subProjectName: 'Test Subproject',
      justification: 'Detailed justification',
      managerName: 'Test Manager',
      calculatedDistance: 25.5,
      costPerKm: 0.7,
      dailyAllowance: 50.0,
      weeklyAllowance: 150.0,
      monthlyEstimate: 650.0,
      daysPerWeek: 3,
      status: 'pending',
      submittedDate: new Date('2025-09-20'),
      statusHistory: [],
    };

    it('should toggle request details expansion', () => {
      const request = mockDashboardData.requests[0];
      mockEmployeeDashboardService.getRequestDetails.and.returnValue(of(mockRequestDetails as any));

      component.toggleRequestDetails(request);

      expect(component.expandedRequestId).toBe(request.id);
      expect(component.selectedRequest).toBe(request);
      expect(mockEmployeeDashboardService.getRequestDetails).toHaveBeenCalledWith(request.id);
    });

    it('should collapse request details when same request is clicked', () => {
      const request = mockDashboardData.requests[0];
      component.expandedRequestId = request.id;
      component.selectedRequest = request;

      component.toggleRequestDetails(request);

      expect(component.expandedRequestId).toBeNull();
      expect(component.selectedRequest).toBeNull();
    });

    it('should handle request details loading errors', () => {
      const request = mockDashboardData.requests[0];
      const error = new Error('Failed to load details');
      mockEmployeeDashboardService.getRequestDetails.and.returnValue(throwError(() => error));
      spyOn(console, 'error');

      component.toggleRequestDetails(request);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to load request details', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      expect(console.error).toHaveBeenCalledWith('Failed to load request details:', error);
    });
  });

  describe('Request Withdrawal', () => {
    it('should withdraw pending request successfully', () => {
      const request = mockDashboardData.requests[0]; // pending status
      mockEmployeeDashboardService.withdrawRequest.and.returnValue(
        of({ success: true, message: 'Withdrawn' })
      );
      mockEmployeeDashboardService.getDashboardData.and.returnValue(of(mockDashboardData));
      spyOn(window, 'confirm').and.returnValue(true);

      component.withdrawRequest(request);

      expect(mockEmployeeDashboardService.withdrawRequest).toHaveBeenCalledWith(request.id);
      expect(mockSnackBar.open).toHaveBeenCalledWith('Request withdrawn successfully', 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar'],
      });
      expect(mockEmployeeDashboardService.getDashboardData).toHaveBeenCalled(); // Refresh
    });

    it('should not withdraw non-pending request', () => {
      const request = { ...mockDashboardData.requests[1], status: 'approved' as const }; // non-pending

      component.withdrawRequest(request);

      expect(mockEmployeeDashboardService.withdrawRequest).not.toHaveBeenCalled();
    });

    it('should handle withdrawal cancellation', () => {
      const request = mockDashboardData.requests[0];
      spyOn(window, 'confirm').and.returnValue(false);

      component.withdrawRequest(request);

      expect(mockEmployeeDashboardService.withdrawRequest).not.toHaveBeenCalled();
    });

    it('should handle withdrawal errors', () => {
      const request = mockDashboardData.requests[0];
      const error = new Error('Withdrawal failed');
      mockEmployeeDashboardService.withdrawRequest.and.returnValue(throwError(() => error));
      spyOn(window, 'confirm').and.returnValue(true);
      spyOn(console, 'error');

      component.withdrawRequest(request);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to withdraw request', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      expect(console.error).toHaveBeenCalledWith('Failed to withdraw request:', error);
    });
  });

  describe('Auto-refresh', () => {
    it('should start auto-refresh on initialization', () => {
      mockEmployeeDashboardService.startAutoRefresh.and.returnValue(of(mockDashboardData));

      component.ngOnInit();

      expect(mockEmployeeDashboardService.startAutoRefresh).toHaveBeenCalled();
    });

    it('should stop auto-refresh on destroy', () => {
      component.ngOnDestroy();

      expect(mockEmployeeDashboardService.stopAutoRefresh).toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    it('should return correct status chip class', () => {
      const result = component.getStatusChipClass('pending');

      expect(result).toEqual({
        color: '#ff9800',
        'background-color': '#fff3e0',
      });
    });

    it('should return correct status icon', () => {
      expect(component.getStatusIcon('pending')).toBe('hourglass_empty');
      expect(component.getStatusIcon('approved')).toBe('check_circle');
      expect(component.getStatusIcon('rejected')).toBe('cancel');
      expect(component.getStatusIcon('withdrawn')).toBe('remove_circle');
    });

    it('should format currency correctly', () => {
      const result = component.formatCurrency(123.45);

      expect(result).toBe('CHF 123.45');
    });

    it('should format dates correctly', () => {
      const date = new Date('2025-09-20');
      const result = component.formatDate(date);

      expect(result).toBe('20.09.2025');
    });

    it('should check if request is expanded', () => {
      component.expandedRequestId = 'request-1';

      expect(component.isRequestExpanded('request-1')).toBe(true);
      expect(component.isRequestExpanded('request-2')).toBe(false);
    });

    it('should check if request can be withdrawn', () => {
      expect(component.canWithdrawRequest('pending')).toBe(true);
      expect(component.canWithdrawRequest('approved')).toBe(false);
    });
  });

  describe('Subscription Cleanup', () => {
    it('should complete destroy subject on component destroy', () => {
      spyOn(component['destroy$'], 'next');
      spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(component['destroy$'].next).toHaveBeenCalled();
      expect(component['destroy$'].complete).toHaveBeenCalled();
      expect(mockEmployeeDashboardService.stopAutoRefresh).toHaveBeenCalled();
    });
  });
});
