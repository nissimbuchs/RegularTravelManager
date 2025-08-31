export interface ManagerDashboard {
  pendingRequests: TravelRequestSummary[];
  totalPending: number;
  urgentCount: number;
  filters: DashboardFilters;
  employeeContext?: EmployeeContext;
}

export interface TravelRequestSummary {
  id: string;
  employeeName: string;
  employeeEmail: string;
  projectName: string;
  subProjectName: string;
  daysPerWeek: number;
  calculatedAllowance: number;
  submittedDate: Date;
  urgencyLevel: 'low' | 'medium' | 'high';
  daysSinceSubmission: number;
}

export interface EmployeeContext {
  employee: Employee;
  currentWeeklyAllowance: number;
  activeRequestsCount: number;
  recentHistory: TravelRequest[];
  totalRequestsThisYear: number;
  averageWeeklyAllowance: number;
  departmentBudgetUtilization: number;
  recentApprovals: number;
  recentRejections: number;
  performanceScore?: number;
}

export interface DashboardFilters {
  employeeName?: string;
  projectName?: string;
  subProjectName?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  allowanceRange?: {
    min: number;
    max: number;
  };
  urgencyLevels?: ('low' | 'medium' | 'high')[];
}

export interface PaginationConfig {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions: number[];
}

export interface SortConfig {
  active: string;
  direction: 'asc' | 'desc';
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  managerId: string;
}

export interface TravelRequest {
  id: string;
  employeeId: string;
  projectId: string;
  subProjectId: string;
  managerId: string;
  daysPerWeek: number;
  justification: string;
  calculatedAllowance: number;
  status: 'pending' | 'approved' | 'rejected';
  submittedDate: Date;
  reviewedDate?: Date;
  reviewNotes?: string;
}