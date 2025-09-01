export interface Project {
  id: string;
  name: string;
  description?: string;
  defaultCostPerKm: number;
  isActive: boolean;
  createdAt: string;
  subprojects?: Subproject[];
}

export interface Subproject {
  id: string;
  projectId: string;
  name: string;
  locationStreet?: string;
  locationCity?: string;
  locationPostalCode?: string;
  locationCoordinates?: {
    latitude: number;
    longitude: number;
  };
  costPerKm?: number;
  isActive: boolean;
  createdAt: string;
  project?: Project;
}

export interface ProjectCreateRequest {
  name: string;
  description?: string;
  defaultCostPerKm: number;
  isActive?: boolean;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  defaultCostPerKm?: number;
  isActive?: boolean;
}

export interface SubprojectCreateRequest {
  projectId: string;
  name: string;
  locationStreet?: string;
  locationCity?: string;
  locationPostalCode?: string;
  costPerKm?: number;
  isActive?: boolean;
}

export interface SubprojectUpdateRequest {
  name?: string;
  locationStreet?: string;
  locationCity?: string;
  locationPostalCode?: string;
  costPerKm?: number;
  isActive?: boolean;
}

export interface ProjectSearchFilters {
  search?: string;
  isActive?: boolean;
  minCostPerKm?: number;
  maxCostPerKm?: number;
  createdAfter?: string;
  createdBefore?: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}
