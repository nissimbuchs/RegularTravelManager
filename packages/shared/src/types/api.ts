// API Response Types
export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiErrorResponse;
  timestamp: string;
  requestId: string;
}

// Health Check Types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: { status: string; responseTime: number };
    cognito: { status: string; responseTime: number };
    ses: { status: string; responseTime: number };
  };
}

// Employee Types
export interface EmployeeDto {
  id: string;
  cognitoUserId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  email: string;
  firstName: string; // ✅ Fixed: Use camelCase per API field naming conventions
  lastName: string; // ✅ Fixed: Use camelCase per API field naming conventions
  employeeId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  homeStreet: string; // ✅ Fixed: Use camelCase per API field naming conventions
  homeCity: string; // ✅ Fixed: Use camelCase per API field naming conventions
  homePostalCode: string; // ✅ Fixed: Use camelCase per API field naming conventions
  homeCountry: string; // ✅ Fixed: Use camelCase per API field naming conventions
  homeLocation: { latitude: number; longitude: number }; // ✅ Fixed: Use camelCase per API field naming conventions
  createdAt: string; // ✅ Fixed: Use camelCase per API field naming conventions
  updatedAt: string; // ✅ Fixed: Use camelCase per API field naming conventions
}

export interface CreateEmployeeRequest {
  cognitoUserId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  email: string;
  firstName: string; // ✅ Fixed: Use camelCase per API field naming conventions
  lastName: string; // ✅ Fixed: Use camelCase per API field naming conventions
  employeeId: string; // ✅ Fixed: Use camelCase per API field naming conventions
}

export interface UpdateEmployeeAddressRequest {
  homeStreet: string; // ✅ Fixed: Use camelCase per API field naming conventions
  homeCity: string; // ✅ Fixed: Use camelCase per API field naming conventions
  homePostalCode: string; // ✅ Fixed: Use camelCase per API field naming conventions
  homeCountry: string; // ✅ Fixed: Use camelCase per API field naming conventions
}

// Project Types
export interface ProjectDto {
  id: string;
  name: string;
  description?: string;
  defaultCostPerKm: number; // ✅ Fixed: Use camelCase per API field naming conventions
  isActive: boolean; // ✅ Fixed: Use camelCase per API field naming conventions
  createdAt: string; // ✅ Fixed: Use camelCase per API field naming conventions
  updatedAt: string; // ✅ Fixed: Use camelCase per API field naming conventions
}

export interface SubprojectDto {
  id: string;
  projectId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  name: string;
  locationStreet?: string; // ✅ Fixed: Use camelCase per API field naming conventions
  locationCity?: string; // ✅ Fixed: Use camelCase per API field naming conventions
  locationPostalCode?: string; // ✅ Fixed: Use camelCase per API field naming conventions
  locationCoordinates?: { latitude: number; longitude: number }; // ✅ Fixed: Use camelCase per API field naming conventions
  costPerKm?: number; // ✅ Fixed: Use camelCase per API field naming conventions
  isActive: boolean; // ✅ Fixed: Use camelCase per API field naming conventions
  createdAt: string; // ✅ Fixed: Use camelCase per API field naming conventions
  updatedAt: string; // ✅ Fixed: Use camelCase per API field naming conventions
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  defaultCostPerKm: number; // ✅ Fixed: Use camelCase per API field naming conventions
}

export interface CreateSubprojectRequest {
  projectId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  name: string;
  locationStreet?: string; // ✅ Fixed: Use camelCase per API field naming conventions
  locationCity?: string; // ✅ Fixed: Use camelCase per API field naming conventions
  locationPostalCode?: string; // ✅ Fixed: Use camelCase per API field naming conventions
  costPerKm?: number; // ✅ Fixed: Use camelCase per API field naming conventions
}

// Travel Request Types
export interface TravelRequestDto {
  id: string;
  employeeId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  subprojectId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  requestDate: string; // ✅ Fixed: Use camelCase per API field naming conventions
  status: 'pending' | 'approved' | 'rejected';
  distanceKm: number; // ✅ Fixed: Use camelCase per API field naming conventions
  allowanceAmount: number; // ✅ Fixed: Use camelCase per API field naming conventions
  notes?: string;
  createdAt: string; // ✅ Fixed: Use camelCase per API field naming conventions
  updatedAt: string; // ✅ Fixed: Use camelCase per API field naming conventions
}

export interface CreateTravelRequestRequest {
  employeeId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  subprojectId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  managerName: string; // ✅ Fixed: Use camelCase per API field naming conventions
  daysPerWeek: number; // ✅ Fixed: Use camelCase per API field naming conventions
  justification: string;
}

export interface UpdateTravelRequestRequest {
  status?: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

// Calculation Types
export interface TravelAllowanceCalculation {
  distanceKm: number; // ✅ Fixed: Use camelCase per API field naming conventions
  allowanceAmount: number; // ✅ Fixed: Use camelCase per API field naming conventions
  costPerKm: number; // ✅ Fixed: Use camelCase per API field naming conventions
}

export interface CalculationPreview {
  distance: number; // km, 3 decimal places
  dailyAllowance: number; // CHF, 2 decimal places
  weeklyAllowance: number; // CHF, 2 decimal places
}

export interface TravelRequestFormData {
  projectId: string;
  subProjectId: string;
  managerId: string;
  daysPerWeek: number; // 1-7
  justification: string; // 10-500 chars
}

// Admin User Management Types
export interface UserSummary {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'employee' | 'manager' | 'administrator';
  status: 'active' | 'inactive' | 'pending';
  managerId?: string;
  managerName?: string;
  department?: string;
  lastLoginAt?: string;
  registrationDate: string;
  requestCount: number;
  isVerified: boolean;
}

export interface UserDetails extends UserSummary {
  phoneNumber?: string;
  homeAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  notificationPreferences: {
    email: boolean;
    sms?: boolean;
  };
  activitySummary: UserActivitySummary;
  directReports: UserSummary[];
  recentRequests: TravelRequestSummary[];
}

export interface UserActivitySummary {
  totalRequests: number;
  requestsThisMonth: number;
  averageRequestValue: number;
  lastRequestDate?: string;
  loginHistory: LoginEvent[];
  securityEvents: SecurityEvent[];
}

export interface LoginEvent {
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  success: boolean;
  failureReason?: string;
}

export interface SecurityEvent {
  type: 'suspicious_login' | 'multiple_failures' | 'unusual_activity' | 'role_escalation';
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  resolved: boolean;
}

export interface TravelRequestSummary {
  id: string;
  projectName: string;
  subprojectName: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  allowanceAmount: number;
  requestDate: string;
}

export interface AdminUserListing {
  users: UserSummary[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    pageSize: number;
  };
  filters: {
    search?: string;
    role?: 'employee' | 'manager' | 'administrator';
    status?: 'active' | 'inactive' | 'pending';
    department?: string;
    managerId?: string;
  };
  sortBy: 'name' | 'email' | 'role' | 'lastLogin' | 'registrationDate';
  sortOrder: 'asc' | 'desc';
}

export interface RoleChangeRequest {
  userId: string;
  newRole: 'employee' | 'manager' | 'administrator';
  reason: string;
  effectiveDate?: string;
}

export interface RoleChangeValidation {
  canChangeRole: boolean;
  warnings: string[];
  impacts: string[];
  confirmationRequired: boolean;
  existingPermissions: string[];
  newPermissions: string[];
}

export interface ManagerAssignmentRequest {
  userId: string;
  managerId: string;
  reason: string;
  effectiveDate?: string;
}

export interface ManagerAssignmentValidation {
  canAssignManager: boolean;
  warnings: string[];
  hierarchyImpacts: string[];
  loopDetected: boolean;
  managerCapacityOk: boolean;
}

export interface UserStatusUpdateRequest {
  isActive: boolean;
  reason?: string;
}

export interface UserDeletionRequest {
  reason: string;
  reassignRequestsTo?: string;
}

export interface UserDeletionSummary {
  userId: string;
  travelRequestsArchived: number;
  auditRecordsPreserved: number;
  directReportsUpdated: number;
  deletedAt: string;
}
