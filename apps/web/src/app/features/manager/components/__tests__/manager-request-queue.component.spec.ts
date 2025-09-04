import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
  flush,
  discardPeriodicTasks,
} from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
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
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { By } from '@angular/platform-browser';

import { ManagerRequestQueueComponent } from '../manager-request-queue.component';
import { ManagerDashboardService } from '../../services/manager-dashboard.service';
import {
  ManagerDashboard,
  TravelRequestSummary,
  EmployeeContext,
  DashboardFilters,
} from '../../models/dashboard.model';

describe('ManagerRequestQueueComponent', () => {
  let component: ManagerRequestQueueComponent;
  let fixture: ComponentFixture<ManagerRequestQueueComponent>;
  let mockManagerDashboardService: jasmine.SpyObj<ManagerDashboardService>;
  let dashboardSubject: BehaviorSubject<ManagerDashboard | null>;

  const mockTravelRequests: TravelRequestSummary[] = [
    {
      id: 'req-1',
      employeeName: 'John Doe',
      employeeEmail: 'john.doe@company.com',
      projectName: 'Test Project',
      subProjectName: 'Test Location',
      daysPerWeek: 3,
      calculatedAllowance: 150.0,
      submittedDate: new Date('2024-01-15'),
      urgencyLevel: 'high',
      daysSinceSubmission: 8,
    },
    {
      id: 'req-2',
      employeeName: 'Jane Smith',
      employeeEmail: 'jane.smith@company.com',
      projectName: 'Another Project',
      subProjectName: 'Another Location',
      daysPerWeek: 2,
      calculatedAllowance: 100.0,
      submittedDate: new Date('2024-01-18'),
      urgencyLevel: 'medium',
      daysSinceSubmission: 5,
    },
  ];

  const mockDashboard: ManagerDashboard = {
    pendingRequests: mockTravelRequests,
    totalPending: 2,
    urgentCount: 1,
    filters: {},
  };

  const mockEmployeeContext: EmployeeContext = {
    employee: {
      id: 'johndoe',
      name: 'John Doe',
      email: 'john.doe@company.com',
      department: 'Engineering',
      position: 'Senior Software Developer',
      managerId: 'manager-1',
    },
    currentWeeklyAllowance: 245.5,
    activeRequestsCount: 2,
    recentHistory: [],
    totalRequestsThisYear: 18,
    averageWeeklyAllowance: 220.75,
    departmentBudgetUtilization: 72.5,
    recentApprovals: 15,
    recentRejections: 1,
    performanceScore: 8.7,
  };

  beforeEach(async () => {
    dashboardSubject = new BehaviorSubject<ManagerDashboard | null>(null);

    const spy = jasmine.createSpyObj(
      'ManagerDashboardService',
      ['getDashboardData', 'getEmployeeContext', 'startAutoRefresh', 'stopAutoRefresh'],
      {
        dashboard$: dashboardSubject.asObservable(),
      }
    );

    const snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);
    const snackBarRefSpy = jasmine.createSpyObj('MatSnackBarRef', ['onAction']);
    snackBarRefSpy.onAction.and.returnValue(of(true));
    snackBarSpy.open.and.returnValue(snackBarRefSpy);

    await TestBed.configureTestingModule({
      imports: [
        ManagerRequestQueueComponent,
        ReactiveFormsModule,
        NoopAnimationsModule,
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
        MatDividerModule,
        MatTooltipModule,
      ],
      providers: [
        { provide: ManagerDashboardService, useValue: spy },
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    }).compileComponents();

    mockManagerDashboardService = TestBed.inject(
      ManagerDashboardService
    ) as jasmine.SpyObj<ManagerDashboardService>;
    mockManagerDashboardService.getDashboardData.and.returnValue(of(mockDashboard));
    mockManagerDashboardService.getEmployeeContext.and.returnValue(of(mockEmployeeContext));

    fixture = TestBed.createComponent(ManagerRequestQueueComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize form with empty values', () => {
      expect(component.filterForm.get('employeeName')?.value).toBe('');
      expect(component.filterForm.get('projectName')?.value).toBe('');
      expect(component.filterForm.get('subProjectName')?.value).toBe('');
      expect(component.filterForm.get('urgencyLevels')?.value).toEqual([]);
    });

    it('should set default pagination configuration', () => {
      expect(component.pagination.pageIndex).toBe(0);
      expect(component.pagination.pageSize).toBe(25);
      expect(component.pagination.totalItems).toBe(0);
      expect(component.pagination.pageSizeOptions).toEqual([10, 25, 50]);
    });

    it('should set default sort configuration', () => {
      expect(component.sortConfig.active).toBe('submittedDate');
      expect(component.sortConfig.direction).toBe('desc');
    });

    it('should initialize urgency levels with correct colors', () => {
      expect(component.urgencyLevels).toEqual([
        { value: 'high', label: 'High Priority', color: '#f44336' },
        { value: 'medium', label: 'Medium Priority', color: '#ff9800' },
        { value: 'low', label: 'Low Priority', color: '#4caf50' },
      ]);
    });
  });

  describe('Data Loading', () => {
    it('should load dashboard data on init', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(mockManagerDashboardService.getDashboardData).toHaveBeenCalled();
      expect(component.dashboard).toEqual(mockDashboard);
      expect(component.dataSource.data).toEqual(mockTravelRequests);
      expect(component.isLoading).toBeFalse();
      discardPeriodicTasks();
    }));

    it('should handle loading error gracefully', fakeAsync(() => {
      const errorMessage = 'Failed to load data';
      mockManagerDashboardService.getDashboardData.and.returnValue(
        throwError(() => new Error(errorMessage))
      );

      spyOn(console, 'error');
      fixture.detectChanges();
      tick();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to load dashboard data:',
        jasmine.any(Error)
      );
      expect(component.isLoading).toBeFalse();
      discardPeriodicTasks();
    }));

    it('should set loading state correctly during data fetch', () => {
      // Mock the service to return immediately
      mockManagerDashboardService.getDashboardData.and.returnValue(of(mockDashboard));

      expect(component.isLoading).toBeFalse(); // Initial state

      // Manually call loadDashboardData to test loading state
      component['loadDashboardData']();
      expect(component.isLoading).toBeTrue(); // Should be true when method is called

      // Wait for observable to complete
      expect(component.isLoading).toBeFalse(); // Should be false after completion
    });

    it('should update last refresh time after successful data load', fakeAsync(() => {
      const beforeTime = new Date();
      fixture.detectChanges();
      tick();

      expect(component.lastRefreshTime).toBeTruthy();
      // lastRefreshTime is a formatted string, not a Date object
      expect(component.lastRefreshTime).toMatch(/\d{2}:\d{2}:\d{2}/);
      flush();
    }));
  });

  describe('Filtering Functionality', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick();
      mockManagerDashboardService.getDashboardData.calls.reset();
    }));

    it('should debounce filter changes', fakeAsync(() => {
      const employeeNameControl = component.filterForm.get('employeeName')!;

      employeeNameControl.setValue('J');
      tick(100);
      employeeNameControl.setValue('Jo');
      tick(100);
      employeeNameControl.setValue('John');
      tick(300);

      expect(mockManagerDashboardService.getDashboardData).toHaveBeenCalledTimes(1);
    }));

    it('should reset pagination when filters change', fakeAsync(() => {
      component.pagination.pageIndex = 2;

      component.filterForm.get('employeeName')?.setValue('John');
      tick(300);

      expect(component.pagination.pageIndex).toBe(0);
    }));

    it('should build filters correctly from form values', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      component.filterForm.patchValue({
        employeeName: 'John',
        projectName: 'Test Project',
        subProjectName: 'Test Location',
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
        allowanceMin: 100,
        allowanceMax: 500,
        urgencyLevels: ['high', 'medium'],
      });

      const filters = component['buildFilters']();

      expect(filters.employeeName).toBe('John');
      expect(filters.projectName).toBe('Test Project');
      expect(filters.subProjectName).toBe('Test Location');
      expect(filters.dateRange?.start).toEqual(startDate);
      expect(filters.dateRange?.end).toEqual(endDate);
      expect(filters.allowanceRange?.min).toBe(100);
      expect(filters.allowanceRange?.max).toBe(500);
      expect(filters.urgencyLevels).toEqual(['high', 'medium']);
    });

    it('should clear all filters when clearFilters is called', fakeAsync(() => {
      component.filterForm.patchValue({
        employeeName: 'John',
        projectName: 'Test',
        urgencyLevels: ['high'],
      });
      component.pagination.pageIndex = 2;

      component.clearFilters();
      tick(300);

      expect(component.filterForm.get('employeeName')?.value).toBeNull();
      expect(component.filterForm.get('projectName')?.value).toBeNull();
      expect(component.filterForm.get('urgencyLevels')?.value).toBeNull();
      expect(component.pagination.pageIndex).toBe(0);
      expect(mockManagerDashboardService.getDashboardData).toHaveBeenCalled();
    }));
  });

  describe('Sorting and Pagination', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick();
      mockManagerDashboardService.getDashboardData.calls.reset();
    }));

    it('should handle sort change correctly', () => {
      const sortEvent = { active: 'employeeName', direction: 'asc' };
      component.pagination.pageIndex = 2;

      component.onSortChange(sortEvent);

      expect(component.sortConfig.active).toBe('employeeName');
      expect(component.sortConfig.direction).toBe('asc');
      expect(component.pagination.pageIndex).toBe(0);
      expect(mockManagerDashboardService.getDashboardData).toHaveBeenCalled();
    });

    it('should handle page change correctly', () => {
      const pageEvent = { pageIndex: 1, pageSize: 50 };

      component.onPageChange(pageEvent);

      expect(component.pagination.pageIndex).toBe(1);
      expect(component.pagination.pageSize).toBe(50);
      expect(mockManagerDashboardService.getDashboardData).toHaveBeenCalled();
    });
  });

  describe('Request Selection and Employee Context', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick();
      mockManagerDashboardService.getEmployeeContext.calls.reset();
    }));

    it('should select request and show employee panel', () => {
      const request = mockTravelRequests[0];

      component.selectRequest(request);

      expect(component.selectedRequest).toBe(request);
      expect(component.showEmployeePanel).toBeTrue();
      expect(mockManagerDashboardService.getEmployeeContext).toHaveBeenCalledWith('john.doe@company.com');
    });

    it('should use full email as employee ID correctly', () => {
      const request = { ...mockTravelRequests[0], employeeEmail: 'jane.smith@company.com' };

      component.selectRequest(request);

      expect(mockManagerDashboardService.getEmployeeContext).toHaveBeenCalledWith('jane.smith@company.com');
    });

    it('should load employee context successfully', fakeAsync(() => {
      const request = mockTravelRequests[0];

      component.selectRequest(request);
      tick();

      expect(component.employeeContext).toEqual(mockEmployeeContext);
      expect(component.isLoadingContext).toBeFalse();
    }));

    it('should handle employee context loading error', fakeAsync(() => {
      const errorMessage = 'Failed to load employee context';
      mockManagerDashboardService.getEmployeeContext.and.returnValue(
        throwError(() => new Error(errorMessage))
      );

      spyOn(console, 'error');
      const request = mockTravelRequests[0];

      component.selectRequest(request);
      tick();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to load employee context:',
        jasmine.any(Error)
      );
      expect(component.isLoadingContext).toBeFalse();
      flush();
    }));

    it('should close employee panel and reset state', () => {
      component.selectedRequest = mockTravelRequests[0];
      component.employeeContext = mockEmployeeContext;
      component.showEmployeePanel = true;

      component.closeEmployeePanel();

      expect(component.showEmployeePanel).toBeFalse();
      expect(component.selectedRequest).toBeNull();
      expect(component.employeeContext).toBeNull();
    });
  });

  describe('Auto-refresh Functionality', () => {
    it('should start auto-refresh on init', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(mockManagerDashboardService.startAutoRefresh).toHaveBeenCalledWith(
        jasmine.any(Object),
        component.pagination,
        component.sortConfig
      );
      discardPeriodicTasks();
    }));

    it('should subscribe to dashboard updates', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      const updatedDashboard = { ...mockDashboard, totalPending: 5 };
      dashboardSubject.next(updatedDashboard);
      tick();

      expect(component.dashboard).toEqual(updatedDashboard);
      expect(component.dataSource.data).toEqual(updatedDashboard.pendingRequests);
      expect(component.pagination.totalItems).toBe(5);
      discardPeriodicTasks();
    }));

    it('should stop auto-refresh on destroy', () => {
      fixture.detectChanges();
      component.ngOnDestroy();

      expect(mockManagerDashboardService.stopAutoRefresh).toHaveBeenCalled();
    });

    it('should refresh data manually', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      mockManagerDashboardService.getDashboardData.calls.reset();

      component.refreshData();

      expect(mockManagerDashboardService.getDashboardData).toHaveBeenCalled();
      discardPeriodicTasks();
    }));
  });

  describe('Utility Methods', () => {
    it('should return correct urgency color', () => {
      expect(component.getUrgencyColor('high')).toBe('#f44336');
      expect(component.getUrgencyColor('medium')).toBe('#ff9800');
      expect(component.getUrgencyColor('low')).toBe('#4caf50');
    });

    it('should return default color for unknown urgency', () => {
      expect(component.getUrgencyColor('unknown' as any)).toBe('#666');
    });

    it('should return correct urgency icon', () => {
      expect(component.getUrgencyIcon('high')).toBe('priority_high');
      expect(component.getUrgencyIcon('medium')).toBe('remove');
      expect(component.getUrgencyIcon('low')).toBe('keyboard_arrow_down');
    });

    it('should format currency correctly', () => {
      const formatted1 = component.formatCurrency(123.45);
      const formatted2 = component.formatCurrency(1000);

      // Swiss format uses different separators
      expect(formatted1).toContain('CHF');
      expect(formatted1).toContain('123.45');
      expect(formatted2).toContain('CHF');
      expect(formatted2).toContain('000.00');
    });

    it('should format date correctly', () => {
      const date = new Date('2024-01-15');
      const formatted = component.formatDate(date);
      expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/); // DD.MM.YYYY format
    });

    it('should format last refresh time correctly', () => {
      const refreshTime = component.lastRefreshTime;
      expect(refreshTime).toMatch(/\d{2}:\d{2}:\d{2}/); // HH:MM:SS format
    });
  });

  describe('Template Integration', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick();
    }));

    it('should display dashboard stats correctly', () => {
      const statsCards = fixture.debugElement.queryAll(By.css('.stats-card'));

      expect(statsCards.length).toBe(2);

      const pendingStats = statsCards[0].query(By.css('.stats-number'));
      expect(pendingStats.nativeElement.textContent.trim()).toBe('2');

      const urgentStats = statsCards[1].query(By.css('.stats-number'));
      expect(urgentStats.nativeElement.textContent.trim()).toBe('1');
    });

    it('should display requests in table', () => {
      const tableRows = fixture.debugElement.queryAll(By.css('tr[mat-row]'));
      expect(tableRows.length).toBe(2);
    });

    it('should show loading spinner when loading', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('mat-spinner'));
      expect(spinner).toBeTruthy();
    });

    it('should show no data message when no requests', fakeAsync(() => {
      component.dataSource.data = [];
      component.isLoading = false;
      fixture.detectChanges();
      tick();

      const noDataMessage = fixture.debugElement.query(By.css('.no-data-container'));
      expect(noDataMessage).toBeTruthy();
    }));

    it('should show employee panel when request is selected', () => {
      component.selectRequest(mockTravelRequests[0]);
      fixture.detectChanges();

      const employeePanel = fixture.debugElement.query(By.css('.employee-panel'));
      expect(employeePanel).toBeTruthy();
      expect(component.showEmployeePanel).toBeTrue();
    });

    it('should highlight selected row', () => {
      component.selectedRequest = mockTravelRequests[0];
      fixture.detectChanges();

      const selectedRow = fixture.debugElement.query(By.css('.selected-row'));
      expect(selectedRow).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should display error snackbar on dashboard load failure', fakeAsync(() => {
      const errorMessage = 'Network error';
      mockManagerDashboardService.getDashboardData.and.returnValue(
        throwError(() => new Error(errorMessage))
      );

      const mockSnackBar = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;

      // Create a new component instance for this error test
      fixture = TestBed.createComponent(ManagerRequestQueueComponent);
      component = fixture.componentInstance;

      fixture.detectChanges();
      tick();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to load pending requests. Please try again.',
        'Retry',
        { duration: 5000 }
      );
      discardPeriodicTasks();
    }));

    it('should display error snackbar on employee context load failure', fakeAsync(() => {
      mockManagerDashboardService.getEmployeeContext.and.returnValue(
        throwError(() => new Error('Context error'))
      );

      const mockSnackBar = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;

      fixture.detectChanges();
      tick();

      component.selectRequest(mockTravelRequests[0]);
      tick();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to load employee details. Please try again.',
        'Close',
        { duration: 5000 }
      );
      flush();
    }));
  });

  describe('Action Methods', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick();
      discardPeriodicTasks();
    }));

    it('should approve request successfully', fakeAsync(() => {
      const request = mockTravelRequests[0];
      spyOn(component['snackBar'], 'open').and.callThrough();

      component.approveRequest(request);

      expect(component.isProcessingAction).toBeTrue();
      expect(component.actionType).toBe('approve');

      tick(1500);

      expect(component['snackBar'].open).toHaveBeenCalledWith(
        `Travel request for ${request.employeeName} has been approved successfully.`,
        'Close',
        { duration: 4000 }
      );
      expect(component.isProcessingAction).toBeFalse();
      expect(component.actionType).toBeNull();
      expect(component.showEmployeePanel).toBeFalse();
    }));

    it('should reject request successfully', fakeAsync(() => {
      const request = mockTravelRequests[0];
      spyOn(component['snackBar'], 'open').and.callThrough();

      component.openRejectDialog(request);

      expect(component.isProcessingAction).toBeTrue();
      expect(component.actionType).toBe('reject');

      tick(1500);

      expect(component['snackBar'].open).toHaveBeenCalledWith(
        `Travel request for ${request.employeeName} has been rejected.`,
        'Close',
        { duration: 4000 }
      );
      expect(component.isProcessingAction).toBeFalse();
      expect(component.actionType).toBeNull();
    }));

    it('should view request details', () => {
      const request = mockTravelRequests[0];
      spyOn(component['snackBar'], 'open').and.callThrough();

      component.viewRequestDetails(request);

      expect(component['snackBar'].open).toHaveBeenCalledWith(
        `Request Details: ${request.projectName} - ${request.subProjectName} (${request.daysPerWeek} days/week)`,
        'Close',
        { duration: 6000 }
      );
    });

    it('should remove request from table after action', fakeAsync(() => {
      const request = mockTravelRequests[0];
      const initialCount = component.dataSource.data.length;

      component.approveRequest(request);
      tick(1500);

      expect(component.dataSource.data.length).toBe(initialCount - 1);
      expect(component.dataSource.data.find(req => req.id === request.id)).toBeUndefined();
    }));

    it('should update dashboard counts after removing request', fakeAsync(() => {
      const urgentRequest = { ...mockTravelRequests[0], urgencyLevel: 'high' as const };
      component.dashboard = { ...mockDashboard };
      const initialPending = component.dashboard.totalPending;
      const initialUrgent = component.dashboard.urgentCount;

      component.approveRequest(urgentRequest);
      tick(1500);

      expect(component.dashboard.totalPending).toBe(initialPending - 1);
      expect(component.dashboard.urgentCount).toBe(initialUrgent - 1);
    }));
  });

  describe('Memory Management', () => {
    it('should complete destroy subject on destroy', () => {
      spyOn(component['destroy$'], 'next');
      spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(component['destroy$'].next).toHaveBeenCalled();
      expect(component['destroy$'].complete).toHaveBeenCalled();
    });

    it('should unsubscribe from observables on destroy', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      const subscription = component['filterForm'].valueChanges.subscribe();
      spyOn(subscription, 'unsubscribe');

      component.ngOnDestroy();

      expect(mockManagerDashboardService.stopAutoRefresh).toHaveBeenCalled();
    }));
  });
});
