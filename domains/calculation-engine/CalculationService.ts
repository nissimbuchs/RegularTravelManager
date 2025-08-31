// Domain Service Interface for Travel Distance and Allowance Calculations
// Story 2.3: Distance and Allowance Calculation Engine

export interface GeographicCoordinates {
  latitude: number;
  longitude: number;
}

export interface DistanceCalculationRequest {
  employeeLocation: GeographicCoordinates;
  subprojectLocation: GeographicCoordinates;
  useCache?: boolean;
}

export interface AllowanceCalculationRequest {
  distanceKm: number;
  costPerKm: number;
  days?: number; // For multi-day calculations
}

export interface TravelCostCalculationRequest {
  employeeId: string;
  subprojectId: string;
  employeeLocation: GeographicCoordinates;
  subprojectLocation: GeographicCoordinates;
  costPerKm: number;
  requestContext?: {
    requestId: string;
    userId: string;
    timestamp: Date;
  };
}

export interface CalculationResult {
  distanceKm: number;
  dailyAllowanceChf: number;
  weeklyAllowanceChf?: number;
  monthlyAllowanceChf?: number;
  calculationTimestamp: Date;
  cacheUsed: boolean;
}

export interface CalculationAuditRecord {
  id: string;
  calculationType: 'distance' | 'allowance' | 'travel_cost';
  employeeId: string;
  subprojectId?: string;
  employeeLocation: GeographicCoordinates;
  subprojectLocation?: GeographicCoordinates;
  costPerKm?: number;
  distanceKm: number;
  dailyAllowanceChf: number;
  calculationTimestamp: Date;
  calculationVersion: string;
  requestContext?: any;
}

export interface CacheInvalidationRequest {
  employeeId?: string;
  subprojectId?: string;
  location?: GeographicCoordinates;
}

/**
 * Domain service interface for travel distance and allowance calculations
 * Provides high-performance calculation engine with caching and audit trail
 */
export interface CalculationService {
  /**
   * Calculate straight-line distance between two geographic points
   * Uses PostGIS ST_Distance with geography type for accuracy
   */
  calculateDistance(request: DistanceCalculationRequest): Promise<number>;

  /**
   * Calculate daily travel allowance based on distance and rate
   * Applies Swiss financial rounding standards
   */
  calculateAllowance(request: AllowanceCalculationRequest): Promise<number>;

  /**
   * Complete travel cost calculation with caching and audit trail
   * Combines distance and allowance calculation with performance optimization
   */
  calculateTravelCost(request: TravelCostCalculationRequest): Promise<CalculationResult>;

  /**
   * Invalidate calculation cache when addresses or rates change
   * Ensures cache consistency after data updates
   */
  invalidateCache(request: CacheInvalidationRequest): Promise<number>;

  /**
   * Retrieve calculation audit records for compliance and debugging
   * Supports filtering by employee, subproject, and time range
   */
  getCalculationAudit(filters: {
    employeeId?: string;
    subprojectId?: string;
    startDate?: Date;
    endDate?: Date;
    calculationType?: string;
    limit?: number;
  }): Promise<CalculationAuditRecord[]>;

  /**
   * Clean up expired cache entries
   * Maintenance function for cache performance
   */
  cleanupExpiredCache(): Promise<number>;
}