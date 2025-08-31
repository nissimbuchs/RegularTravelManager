export interface Project {
  id: string;
  name: string;
  description?: string;
  default_cost_per_km: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Subproject {
  id: string;
  project_id: string;
  name: string;
  location_street?: string;
  location_city?: string;
  location_postal_code?: string;
  location_coordinates?: { latitude: number; longitude: number };
  cost_per_km?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProjectCommand {
  name: string;
  description?: string;
  default_cost_per_km: number;
}

export interface CreateSubprojectCommand {
  project_id: string;
  name: string;
  location_street?: string;
  location_city?: string;
  location_postal_code?: string;
  cost_per_km?: number;
}

export interface UpdateProjectCommand {
  id: string;
  name?: string;
  description?: string;
  default_cost_per_km?: number;
  is_active?: boolean;
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
   * Check if project can be deleted (no active references)
   */
  canDeleteProject(projectId: string): Promise<boolean>;
}