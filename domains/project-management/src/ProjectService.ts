export interface Project {
  id: string;
  name: string;
  description?: string;
  defaultCostPerKm: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subproject {
  id: string;
  projectId: string;
  name: string;
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  locationCoordinates?: { latitude: number; longitude: number };
  costPerKm?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectCommand {
  name: string;
  description?: string;
  defaultCostPerKm: number;
}

export interface CreateSubprojectCommand {
  projectId: string;
  name: string;
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  costPerKm?: number;
}

export interface UpdateProjectCommand {
  id: string;
  name?: string;
  description?: string;
  defaultCostPerKm?: number;
  isActive?: boolean;
}

export interface UpdateSubprojectCommand {
  id: string;
  projectId: string;
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

export interface ProjectService {
  /**
   * Create a new project
   */
  createProject(command: CreateProjectCommand): Promise<Project>;

  /**
   * Create a new subproject with geocoding
   */
  createSubproject(command: CreateSubprojectCommand): Promise<Subproject>;

  /**
   * Update an existing project
   */
  updateProject(command: UpdateProjectCommand): Promise<Project>;

  /**
   * Get project by ID
   */
  getProject(id: string): Promise<Project | null>;

  /**
   * Get subproject by ID
   */
  getSubproject(id: string): Promise<Subproject | null>;

  /**
   * Get all active projects
   */
  getActiveProjects(): Promise<Project[]>;

  /**
   * Get subprojects for a project
   */
  getSubprojectsForProject(projectId: string): Promise<Subproject[]>;

  /**
   * Search projects by name
   */
  searchProjects(searchTerm: string): Promise<Project[]>;

  /**
   * Get all projects (including inactive)
   */
  getAllProjects(): Promise<Project[]>;

  /**
   * Get projects with filters applied
   */
  getProjectsWithFilters(filters: ProjectSearchFilters): Promise<Project[]>;

  /**
   * Update an existing subproject
   */
  updateSubproject(command: UpdateSubprojectCommand): Promise<Subproject>;

  /**
   * Delete a subproject
   */
  deleteSubproject(projectId: string, subprojectId: string): Promise<void>;

  /**
   * Check if project can be deleted (no active references)
   */
  canDeleteProject(projectId: string): Promise<boolean>;
}
