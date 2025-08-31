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
  cognito_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  home_street: string;
  home_city: string;
  home_postal_code: string;
  home_country: string;
  home_location: { latitude: number; longitude: number };
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeRequest {
  cognito_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string;
}

export interface UpdateEmployeeAddressRequest {
  home_street: string;
  home_city: string;
  home_postal_code: string;
  home_country: string;
}

// Project Types
export interface ProjectDto {
  id: string;
  name: string;
  description?: string;
  default_cost_per_km: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubprojectDto {
  id: string;
  project_id: string;
  name: string;
  location_street?: string;
  location_city?: string;
  location_postal_code?: string;
  location_coordinates?: { latitude: number; longitude: number };
  cost_per_km?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  default_cost_per_km: number;
}

export interface CreateSubprojectRequest {
  project_id: string;
  name: string;
  location_street?: string;
  location_city?: string;
  location_postal_code?: string;
  cost_per_km?: number;
}

// Travel Request Types
export interface TravelRequestDto {
  id: string;
  employee_id: string;
  subproject_id: string;
  request_date: string;
  status: 'pending' | 'approved' | 'rejected';
  distance_km: number;
  allowance_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTravelRequestRequest {
  employee_id: string;
  subproject_id: string;
  manager_name: string;
  days_per_week: number;
  justification: string;
}

export interface UpdateTravelRequestRequest {
  status?: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

// Calculation Types
export interface TravelAllowanceCalculation {
  distance_km: number;
  allowance_amount: number;
  cost_per_km: number;
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