export interface TravelRequest {
  id: string;
  employeeId: string;
  subprojectId: string;
  requestDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  distanceKm: number;
  allowanceAmount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTravelRequestCommand {
  employeeId: string;
  subprojectId: string;
  requestDate: Date;
  notes?: string;
}

export interface UpdateTravelRequestCommand {
  id: string;
  status?: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface TravelRequestService {
  /**
   * Create a new travel request with automatic distance and allowance calculation
   */
  createTravelRequest(command: CreateTravelRequestCommand): Promise<TravelRequest>;

  /**
   * Update an existing travel request
   */
  updateTravelRequest(command: UpdateTravelRequestCommand): Promise<TravelRequest>;

  /**
   * Get travel request by ID
   */
  getTravelRequest(id: string): Promise<TravelRequest | null>;

  /**
   * Get travel requests for an employee
   */
  getTravelRequestsForEmployee(employeeId: string): Promise<TravelRequest[]>;

  /**
   * Get pending travel requests for manager approval
   */
  getPendingTravelRequests(): Promise<TravelRequest[]>;

  /**
   * Calculate distance and allowance for a potential travel request
   */
  calculateTravelAllowance(employeeId: string, subprojectId: string): Promise<{
    distanceKm: number;
    allowanceAmount: number;
  }>;
}