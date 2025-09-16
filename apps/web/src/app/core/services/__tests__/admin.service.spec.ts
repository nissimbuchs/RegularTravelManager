import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AdminService } from '../admin.service';
import {
  UserSummary,
  UserDetails,
  AdminUserListing,
  UserStatusUpdateRequest,
  UserDeletionRequest,
  RoleChangeRequest,
  ManagerAssignmentRequest,
} from '../../../../../../packages/shared/src/types/api';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  const mockUserSummary: UserSummary = {
    id: '123',
    employeeNumber: 'EMP-001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.ch',
    role: 'employee',
    status: 'active',
    registrationDate: '2023-01-01T00:00:00Z',
    requestCount: 5,
    isVerified: true,
  };

  const mockUserDetails: UserDetails = {
    ...mockUserSummary,
    phoneNumber: '+41781234567',
    homeAddress: {
      street: 'Musterstrasse 1',
      city: 'Zürich',
      postalCode: '8001',
      country: 'Switzerland',
    },
    notificationPreferences: { email: true },
    activitySummary: {
      totalRequests: 5,
      requestsThisMonth: 2,
      averageRequestValue: 150.5,
      loginHistory: [],
      securityEvents: [],
    },
    directReports: [],
    recentRequests: [],
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AdminService],
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('loadUsers', () => {
    it('should load users successfully', () => {
      const filters = { search: 'John', role: 'employee' as const };
      const pagination = { page: 1, pageSize: 25 };

      service.loadUsers(filters, pagination).subscribe(response => {
        expect(response).toEqual(mockUserListing);
      });

      const req = httpMock.expectOne(request => {
        return (
          request.url === '/api/admin/users' &&
          request.params.get('search') === 'John' &&
          request.params.get('role') === 'employee' &&
          request.params.get('page') === '1' &&
          request.params.get('pageSize') === '25'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockUserListing);
    });

    it('should handle empty filters', () => {
      service.loadUsers().subscribe();

      const req = httpMock.expectOne('/api/admin/users');
      expect(req.request.params.keys().length).toBe(0);
      req.flush(mockUserListing);
    });

    it('should handle loading errors', () => {
      service.loadUsers().subscribe({
        error: error => {
          expect(error).toBeDefined();
        },
      });

      const req = httpMock.expectOne('/api/admin/users');
      req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('getUserDetails', () => {
    it('should get user details successfully', () => {
      const userId = '123';

      service.getUserDetails(userId).subscribe(response => {
        expect(response).toEqual(mockUserDetails);
      });

      const req = httpMock.expectOne(`/api/admin/users/${userId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUserDetails);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status successfully', () => {
      const userId = '123';
      const statusUpdate: UserStatusUpdateRequest = {
        isActive: false,
        reason: 'Account suspended',
      };

      service.updateUserStatus(userId, statusUpdate).subscribe(response => {
        expect(response).toBeDefined();
      });

      const req = httpMock.expectOne(`/api/admin/users/${userId}/status`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(statusUpdate);
      req.flush({ success: true });
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', () => {
      const userId = '123';
      const roleChange: RoleChangeRequest = {
        userId,
        newRole: 'manager',
        reason: 'Promotion',
      };

      service.updateUserRole(userId, roleChange).subscribe(response => {
        expect(response).toBeDefined();
      });

      const req = httpMock.expectOne(`/api/admin/users/${userId}/role`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(roleChange);
      req.flush({ success: true });
    });
  });

  describe('validateRoleChange', () => {
    it('should validate role change successfully', () => {
      const userId = '123';
      const newRole = 'manager';
      const mockValidation = {
        canChangeRole: true,
        warnings: [],
        impacts: [],
        confirmationRequired: false,
        existingPermissions: ['submit_travel_requests'],
        newPermissions: ['approve_travel_requests', 'submit_travel_requests'],
      };

      service.validateRoleChange(userId, newRole).subscribe(response => {
        expect(response).toEqual(mockValidation);
      });

      const req = httpMock.expectOne(`/api/admin/users/${userId}/role/validate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ newRole });
      req.flush(mockValidation);
    });
  });

  describe('updateUserManager', () => {
    it('should update user manager successfully', () => {
      const userId = '123';
      const managerAssignment: ManagerAssignmentRequest = {
        userId,
        managerId: '456',
        reason: 'Team restructuring',
      };

      service.updateUserManager(userId, managerAssignment).subscribe(response => {
        expect(response).toBeDefined();
      });

      const req = httpMock.expectOne(`/api/admin/users/${userId}/manager`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(managerAssignment);
      req.flush({ success: true });
    });
  });

  describe('validateManagerAssignment', () => {
    it('should validate manager assignment successfully', () => {
      const userId = '123';
      const managerId = '456';
      const mockValidation = {
        canAssignManager: true,
        warnings: [],
        hierarchyImpacts: [],
        loopDetected: false,
        managerCapacityOk: true,
      };

      service.validateManagerAssignment(userId, managerId).subscribe(response => {
        expect(response).toEqual(mockValidation);
      });

      const req = httpMock.expectOne(`/api/admin/users/${userId}/manager/validate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ managerId });
      req.flush(mockValidation);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', () => {
      const userId = '123';
      const deletionRequest: UserDeletionRequest = {
        reason: 'Employee departure',
        reassignRequestsTo: '456',
      };
      const mockDeletionSummary = {
        userId,
        travelRequestsArchived: 3,
        auditRecordsPreserved: 5,
        directReportsUpdated: 2,
        deletedAt: '2023-01-01T00:00:00Z',
      };

      service.deleteUser(userId, deletionRequest).subscribe(response => {
        expect(response).toEqual(mockDeletionSummary);
      });

      const req = httpMock.expectOne(`/api/admin/users/${userId}`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual(deletionRequest);
      req.flush(mockDeletionSummary);
    });
  });

  describe('searchUsers', () => {
    it('should search users successfully', () => {
      const searchTerm = 'John';

      service.searchUsers(searchTerm).subscribe(response => {
        expect(response).toEqual(mockUserListing);
      });

      const req = httpMock.expectOne(request => {
        return request.url === '/api/admin/users' && request.params.get('search') === searchTerm;
      });
      req.flush(mockUserListing);
    });
  });

  describe('getAvailableManagers', () => {
    it('should get available managers successfully', () => {
      service.getAvailableManagers().subscribe(response => {
        expect(response).toEqual(mockUserListing);
      });

      const req = httpMock.expectOne(request => {
        return (
          request.url === '/api/admin/users' &&
          request.params.get('role') === 'manager' &&
          request.params.get('status') === 'active' &&
          request.params.get('pageSize') === '100'
        );
      });
      req.flush(mockUserListing);
    });
  });

  describe('getUsersByRole', () => {
    it('should get users by role successfully', () => {
      const role = 'manager';

      service.getUsersByRole(role).subscribe(response => {
        expect(response).toEqual(mockUserListing);
      });

      const req = httpMock.expectOne(request => {
        return request.url === '/api/admin/users' && request.params.get('role') === role;
      });
      req.flush(mockUserListing);
    });
  });

  describe('state management', () => {
    it('should update internal state when loading users', () => {
      let users: UserSummary[] = [];
      let pagination: any = null;
      let loading = false;

      service.users$.subscribe(u => (users = u));
      service.pagination$.subscribe(p => (pagination = p));
      service.loading$.subscribe(l => (loading = l));

      service.loadUsers().subscribe();

      const req = httpMock.expectOne('/api/admin/users');
      req.flush(mockUserListing);

      expect(users).toEqual(mockUserListing.users);
      expect(pagination).toEqual(mockUserListing.pagination);
      expect(loading).toBe(false);
    });

    it('should handle errors in state management', () => {
      let error: string | null = null;
      let loading = true;

      service.error$.subscribe(e => (error = e));
      service.loading$.subscribe(l => (loading = l));

      service.loadUsers().subscribe({
        error: () => {}, // Suppress error
      });

      const req = httpMock.expectOne('/api/admin/users');
      req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      expect(error).toBeTruthy();
      expect(loading).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should clear error state', () => {
      let error: string | null = 'Some error';
      service.error$.subscribe(e => (error = e));

      service.clearError();

      expect(error).toBeNull();
    });

    it('should reset filters', () => {
      let filters: any = { search: 'test' };
      service.filters$.subscribe(f => (filters = f));

      service.resetFilters();

      expect(filters).toEqual({});
    });
  });
});
