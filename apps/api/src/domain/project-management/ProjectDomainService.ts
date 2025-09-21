import {
  ProjectService,
  Project,
  CreateProjectCommand,
  UpdateProjectCommand,
  ProjectSearchFilters,
} from '@rtm/project-management';
import { ProjectRepository, ProjectWithCount } from '../../repositories/ProjectRepository';
import { ValidationError, NotFoundError } from '../../middleware/error-handler';
import { logger } from '../../middleware/logger';

export class ProjectDomainService
  implements
    Pick<
      ProjectService,
      | 'createProject'
      | 'updateProject'
      | 'getProject'
      | 'getActiveProjects'
      | 'getAllProjects'
      | 'getProjectsWithFilters'
      | 'searchProjects'
      | 'canDeleteProject'
    >
{
  private projectRepository: ProjectRepository;

  constructor() {
    this.projectRepository = new ProjectRepository();
  }

  /**
   * Create a new project with business validation
   */
  async createProject(command: CreateProjectCommand): Promise<Project> {
    logger.info('Creating project in domain service', { name: command.name });

    // Business validation
    this.validateProjectCommand(command);

    try {
      return await this.projectRepository.create(command);
    } catch (error) {
      logger.error('Failed to create project', {
        name: command.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update an existing project with business validation
   */
  async updateProject(command: UpdateProjectCommand): Promise<Project> {
    logger.info('Updating project in domain service', { id: command.id });

    // Business validation
    this.validateUpdateProjectCommand(command);

    try {
      return await this.projectRepository.update(command);
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        throw new NotFoundError('Project');
      }
      if (error instanceof Error && error.message === 'No fields to update') {
        throw new ValidationError('No fields to update');
      }

      logger.error('Failed to update project', {
        id: command.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<Project | null> {
    this.validateProjectId(id);
    return await this.projectRepository.findById(id);
  }

  /**
   * Get all active projects
   */
  async getActiveProjects(): Promise<Project[]> {
    const projects = await this.projectRepository.findActiveWithCounts();
    return projects.map(this.stripSubprojectCount);
  }

  /**
   * Get all projects (including inactive)
   */
  async getAllProjects(): Promise<Project[]> {
    const projects = await this.projectRepository.findAllWithCounts();
    return projects.map(this.stripSubprojectCount);
  }

  /**
   * Get projects with filters applied
   */
  async getProjectsWithFilters(filters: ProjectSearchFilters): Promise<Project[]> {
    this.validateProjectFilters(filters);

    const projects = await this.projectRepository.findWithFilters(filters);
    return projects.map(this.stripSubprojectCount);
  }

  /**
   * Search projects by name
   */
  async searchProjects(searchTerm: string): Promise<Project[]> {
    this.validateSearchTerm(searchTerm);

    const projects = await this.projectRepository.search(searchTerm);
    return projects.map(this.stripSubprojectCount);
  }

  /**
   * Check if project can be deleted (no active references)
   */
  async canDeleteProject(projectId: string): Promise<boolean> {
    this.validateProjectId(projectId);
    return await this.projectRepository.canDelete(projectId);
  }

  /**
   * Delete project with business validation
   */
  async deleteProject(projectId: string): Promise<void> {
    logger.info('Deleting project in domain service', { projectId });

    this.validateProjectId(projectId);

    // Check if project can be deleted
    const canDelete = await this.projectRepository.canDelete(projectId);
    if (!canDelete) {
      throw new ValidationError('Cannot delete project with active travel request references');
    }

    // Verify project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    try {
      await this.projectRepository.delete(projectId);
      logger.info('Project deleted successfully', {
        projectId,
        name: project.name,
      });
    } catch (error) {
      logger.error('Failed to delete project', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get projects with subproject counts (for admin use)
   */
  async getProjectsWithCounts(): Promise<ProjectWithCount[]> {
    return await this.projectRepository.findAllWithCounts();
  }

  /**
   * Get active projects with subproject counts
   */
  async getActiveProjectsWithCounts(): Promise<ProjectWithCount[]> {
    return await this.projectRepository.findActiveWithCounts();
  }

  /**
   * Search projects with subproject counts
   */
  async searchProjectsWithCounts(searchTerm: string): Promise<ProjectWithCount[]> {
    this.validateSearchTerm(searchTerm);
    return await this.projectRepository.search(searchTerm);
  }

  // Private validation methods

  private validateProjectCommand(command: CreateProjectCommand): void {
    if (!command.name || command.name.trim().length === 0) {
      throw new ValidationError('Project name is required');
    }

    if (command.name.length > 255) {
      throw new ValidationError('Project name must be 255 characters or less');
    }

    if (command.description && command.description.length > 1000) {
      throw new ValidationError('Project description must be 1000 characters or less');
    }

    if (!command.defaultCostPerKm || command.defaultCostPerKm <= 0) {
      throw new ValidationError('Cost per kilometer must be positive');
    }

    if (command.defaultCostPerKm > 100) {
      throw new ValidationError('Cost per kilometer seems unreasonably high (max 100 CHF/km)');
    }
  }

  private validateUpdateProjectCommand(command: UpdateProjectCommand): void {
    if (!command.id || command.id.trim().length === 0) {
      throw new ValidationError('Project ID is required');
    }

    if (command.name !== undefined) {
      if (!command.name || command.name.trim().length === 0) {
        throw new ValidationError('Project name cannot be empty');
      }
      if (command.name.length > 255) {
        throw new ValidationError('Project name must be 255 characters or less');
      }
    }

    if (
      command.description !== undefined &&
      command.description &&
      command.description.length > 1000
    ) {
      throw new ValidationError('Project description must be 1000 characters or less');
    }

    if (command.defaultCostPerKm !== undefined) {
      if (command.defaultCostPerKm <= 0) {
        throw new ValidationError('Cost per kilometer must be positive');
      }
      if (command.defaultCostPerKm > 100) {
        throw new ValidationError('Cost per kilometer seems unreasonably high (max 100 CHF/km)');
      }
    }
  }

  private validateProjectId(id: string): void {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Project ID is required');
    }
  }

  private validateSearchTerm(searchTerm: string): void {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new ValidationError('Search term must be at least 2 characters');
    }
    if (searchTerm.length > 100) {
      throw new ValidationError('Search term must be 100 characters or less');
    }
  }

  private validateProjectFilters(filters: ProjectSearchFilters): void {
    if (filters.search) {
      this.validateSearchTerm(filters.search);
    }

    if (filters.minCostPerKm !== undefined && filters.minCostPerKm < 0) {
      throw new ValidationError('Minimum cost per kilometer cannot be negative');
    }

    if (filters.maxCostPerKm !== undefined && filters.maxCostPerKm < 0) {
      throw new ValidationError('Maximum cost per kilometer cannot be negative');
    }

    if (
      filters.minCostPerKm !== undefined &&
      filters.maxCostPerKm !== undefined &&
      filters.minCostPerKm > filters.maxCostPerKm
    ) {
      throw new ValidationError('Minimum cost per kilometer cannot be greater than maximum');
    }
  }

  private stripSubprojectCount(project: ProjectWithCount): Project {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { subprojectCount, ...projectWithoutCount } = project;
    return projectWithoutCount;
  }
}
