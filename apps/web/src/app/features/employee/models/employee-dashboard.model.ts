// Employee Dashboard Data Models
// Following manager dashboard patterns adapted for employee use

export interface EmployeeDashboard {
  requests: EmployeeRequestSummary[];
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  withdrawnCount: number;
  totalApprovedAllowance: number; // CHF monthly estimate
}

export interface EmployeeRequestSummary {
  id: string;
  projectName: string;
  projectCode?: string;
  subProjectName: string;
  status: RequestStatus;
  submittedDate: Date;
  processedDate?: Date;
  dailyAllowance: number;
  weeklyAllowance: number;
  daysPerWeek: number;
  justification?: string;
  managerName?: string;
  managerEmail?: string;
  calculatedDistance?: number;
  costPerKm?: number;
  statusHistory?: RequestStatusHistory[];
}

export interface RequestStatusHistory {
  status: RequestStatus;
  timestamp: Date;
  processedBy?: string;
  note?: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface RequestFilters {
  status?: RequestStatus;
  projectName?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface PaginationConfig {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}

export interface SortConfig {
  active: string;
  direction: 'asc' | 'desc';
}

export interface RequestDetails {
  id: string;
  projectName: string;
  subProjectName: string;
  justification: string;
  managerName: string;
  managerEmail?: string;
  calculatedDistance: number;
  costPerKm: number;
  dailyAllowance: number;
  weeklyAllowance: number;
  monthlyEstimate: number;
  daysPerWeek: number;
  status: RequestStatus;
  submittedDate: Date;
  processedDate?: Date;
  statusHistory: RequestStatusHistory[];
  employeeAddress?: string;
  subprojectAddress?: string;
}

// API Response interfaces
export interface GetEmployeeRequestsResponse {
  data: EmployeeDashboard;
}

export interface GetRequestDetailsResponse {
  data: RequestDetails;
}

export interface WithdrawRequestResponse {
  success: boolean;
  message: string;
}
