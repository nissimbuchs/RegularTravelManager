export interface Project {
  id: string;
  name: string;
  description?: string;
  defaultCostPerKm: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  subprojectCount?: number;
  subprojects?: Subproject[];
}

export interface Subproject {
  id: string;
  projectId: string;
  name: string;
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  locationCoordinates?: {
    latitude: number;
    longitude: number;
  };
  costPerKm?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
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
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  costPerKm?: number;
  isActive?: boolean;
}

export interface SubprojectUpdateRequest {
  name?: string;
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  country?: string;
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
