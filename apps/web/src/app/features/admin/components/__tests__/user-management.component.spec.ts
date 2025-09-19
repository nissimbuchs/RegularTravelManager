import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError, BehaviorSubject } from 'rxjs';

import { UserManagementComponent } from '../user-management.component';
import { AdminService } from '../../../../core/services/admin.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { UserSummary, AdminUserListing } from '@rtm/shared';

describe('UserManagementComponent', () => {
  let component: UserManagementComponent;
  let fixture: ComponentFixture<UserManagementComponent>;
  let mockAdminService: jasmine.SpyObj<AdminService>;
  let mockLoadingService: jasmine.SpyObj<LoadingService>;
  let mockDialog: jasmine.SpyObj<MatDialog>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;

  const mockUserSummary: UserSummary = {
    id: '123',
    employeeNumber: 'EMP-001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.ch',
    role: 'employee',
    status: 'active',
    managerId: '456',
    managerName: 'Jane Smith',
    registrationDate: '2023-01-01T00:00:00Z',
    requestCount: 5,
    isVerified: true,
  };

  const mockUserListing: AdminUserListing = {
    users: [mockUserSummary],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalUsers: 1,
      pageSize: 25,
    },
    filters: {},
    sortBy: 'registrationDate',
    sortOrder: 'desc',
  };

  beforeEach(async () => {
    const adminServiceSpy = jasmine.createSpyObj(
      'AdminService',
      ['loadUsers', 'updateUserStatus', 'deleteUser'],
      {
        users$: new BehaviorSubject([mockUserSummary]),
        pagination$: new BehaviorSubject(mockUserListing.pagination),
        loading$: new BehaviorSubject(false),
        error$: new BehaviorSubject(null),
      }
    );

    const loadingServiceSpy = jasmine.createSpyObj('LoadingService', ['setLoading']);
    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    const snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [
        UserManagementComponent,
        ReactiveFormsModule,
        RouterTestingModule,
        NoopAnimationsModule,
        MatDialogModule,
        MatSnackBarModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatChipsModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        MatCardModule,
      ],
      providers: [
        { provide: AdminService, useValue: adminServiceSpy },
        { provide: LoadingService, useValue: loadingServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagementComponent);
    component = fixture.componentInstance;
    mockAdminService = TestBed.inject(AdminService) as jasmine.SpyObj<AdminService>;
    mockLoadingService = TestBed.inject(LoadingService) as jasmine.SpyObj<LoadingService>;
    mockDialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    mockSnackBar = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;

    mockAdminService.loadUsers.and.returnValue(of(mockUserListing));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default state', () => {
    fixture.detectChanges();

    expect(component.displayedColumns).toEqual([
      'name',
      'role',
      'status',
      'manager',
      'activity',
      'registration',
      'actions',
    ]);
    expect(component.totalUsers).toBe(0);
    expect(component.pageSize).toBe(25);
    expect(component.currentPage).toBe(1);
  });

  it('should load users on init', () => {
    fixture.detectChanges();

    expect(mockAdminService.loadUsers).toHaveBeenCalledWith(
      {
        search: undefined,
        role: undefined,
        status: undefined,
      },
      {
        page: 1,
        pageSize: 25,
        sortBy: 'registrationDate',
        sortOrder: 'desc',
      }
    );
  });

  it('should update data source when users are loaded', () => {
    fixture.detectChanges();

    expect(component.dataSource.data).toEqual([mockUserSummary]);
    expect(component.totalUsers).toBe(1);
    expect(component.pageSize).toBe(25);
    expect(component.currentPage).toBe(1);
  });

  it('should handle filter changes with debouncing', done => {
    fixture.detectChanges();

    // Reset the spy to count calls after initialization
    mockAdminService.loadUsers.calls.reset();

    component.filterForm.patchValue({
      search: 'John',
      role: 'employee',
      status: 'active',
    });

    // Should debounce the filter changes
    setTimeout(() => {
      expect(mockAdminService.loadUsers).toHaveBeenCalledWith(
        {
          search: 'John',
          role: 'employee',
          status: 'active',
        },
        {
          page: 1,
          pageSize: 25,
          sortBy: 'registrationDate',
          sortOrder: 'desc',
        }
      );
      expect(component.currentPage).toBe(1); // Should reset to page 1
      done();
    }, 350); // Wait for debounce time
  });

  it('should handle page changes', () => {
    fixture.detectChanges();
    mockAdminService.loadUsers.calls.reset();

    const pageEvent = {
      pageIndex: 1,
      pageSize: 50,
      length: 100,
      previousPageIndex: 0,
    };

    component.onPageChange(pageEvent);

    expect(component.currentPage).toBe(2);
    expect(component.pageSize).toBe(50);
    expect(mockAdminService.loadUsers).toHaveBeenCalledWith(
      {
        search: undefined,
        role: undefined,
        status: undefined,
      },
      {
        page: 2,
        pageSize: 50,
        sortBy: 'registrationDate',
        sortOrder: 'desc',
      }
    );
  });

  it('should clear filters', () => {
    fixture.detectChanges();

    component.filterForm.patchValue({
      search: 'John',
      role: 'employee',
      status: 'active',
    });

    component.clearFilters();

    expect(component.filterForm.value).toEqual({
      search: '',
      role: null,
      status: null,
    });
  });

  describe('user actions', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should toggle user status', () => {
      const mockDialogRef = {
        afterClosed: () => of(true),
      };
      mockDialog.open.and.returnValue(mockDialogRef as any);
      mockAdminService.updateUserStatus.and.returnValue(of({ success: true }));

      const inactiveUser = { ...mockUserSummary, status: 'inactive' as const };
      component.toggleUserStatus(inactiveUser);

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockAdminService.updateUserStatus).toHaveBeenCalledWith('123', {
        isActive: true,
        reason: 'User activated by administrator',
      });
      expect(mockSnackBar.open).toHaveBeenCalledWith('User activated successfully', 'Close', {
        duration: 3000,
      });
    });

    it('should handle toggle status cancellation', () => {
      const mockDialogRef = {
        afterClosed: () => of(false),
      };
      mockDialog.open.and.returnValue(mockDialogRef as any);

      component.toggleUserStatus(mockUserSummary);

      expect(mockAdminService.updateUserStatus).not.toHaveBeenCalled();
    });

    it('should handle toggle status error', () => {
      const mockDialogRef = {
        afterClosed: () => of(true),
      };
      mockDialog.open.and.returnValue(mockDialogRef as any);
      mockAdminService.updateUserStatus.and.returnValue(throwError({ message: 'Server error' }));

      component.toggleUserStatus(mockUserSummary);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to deactivate user', 'Close', {
        duration: 3000,
      });
    });

    it('should delete user', () => {
      const mockDialogRef = {
        afterClosed: () => of(true),
      };
      mockDialog.open.and.returnValue(mockDialogRef as any);
      mockAdminService.deleteUser.and.returnValue(
        of({
          userId: '123',
          travelRequestsArchived: 5,
          auditRecordsPreserved: 10,
          directReportsUpdated: 0,
          deletedAt: '2023-01-01T00:00:00Z',
        })
      );

      component.deleteUser(mockUserSummary);

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockAdminService.deleteUser).toHaveBeenCalledWith('123', {
        reason: 'User deleted by administrator',
      });
      expect(mockSnackBar.open).toHaveBeenCalledWith('User deleted successfully', 'Close', {
        duration: 3000,
      });
    });

    it('should handle delete user cancellation', () => {
      const mockDialogRef = {
        afterClosed: () => of(false),
      };
      mockDialog.open.and.returnValue(mockDialogRef as any);

      component.deleteUser(mockUserSummary);

      expect(mockAdminService.deleteUser).not.toHaveBeenCalled();
    });

    it('should handle delete user error', () => {
      const mockDialogRef = {
        afterClosed: () => of(true),
      };
      mockDialog.open.and.returnValue(mockDialogRef as any);
      mockAdminService.deleteUser.and.returnValue(throwError({ message: 'Server error' }));

      component.deleteUser(mockUserSummary);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to delete user', 'Close', {
        duration: 3000,
      });
    });
  });

  describe('utility methods', () => {
    it('should return correct role colors', () => {
      expect(component.getRoleColor('administrator')).toBe('warn');
      expect(component.getRoleColor('manager')).toBe('accent');
      expect(component.getRoleColor('employee')).toBe('primary');
    });

    it('should return correct status colors', () => {
      expect(component.getStatusColor('active')).toBe('primary');
      expect(component.getStatusColor('inactive')).toBe('warn');
      expect(component.getStatusColor('pending')).toBe('accent');
    });

    it('should return correct status icons', () => {
      expect(component.getStatusIcon('active')).toBe('check_circle');
      expect(component.getStatusIcon('inactive')).toBe('block');
      expect(component.getStatusIcon('pending')).toBe('schedule');
      expect(component.getStatusIcon('unknown')).toBe('help');
    });
  });

  it('should handle loading errors', () => {
    mockAdminService.loadUsers.and.returnValue(throwError({ message: 'Server error' }));

    fixture.detectChanges();

    expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to load users', 'Close', {
      duration: 3000,
    });
  });

  it('should show placeholder dialogs for unimplemented features', () => {
    fixture.detectChanges();

    component.changeUserRole(mockUserSummary);
    expect(mockSnackBar.open).toHaveBeenCalledWith('Role change dialog coming soon', 'Close', {
      duration: 2000,
    });

    component.assignManager(mockUserSummary);
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Manager assignment dialog coming soon',
      'Close',
      { duration: 2000 }
    );
  });

  it('should cleanup subscriptions on destroy', () => {
    fixture.detectChanges();
    const destroySpy = spyOn(component['destroy$'], 'next');
    const completeSpy = spyOn(component['destroy$'], 'complete');

    component.ngOnDestroy();

    expect(destroySpy).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
  });
});
