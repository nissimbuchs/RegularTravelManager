import {
  ProjectService,
  Subproject,
  CreateSubprojectCommand,
  UpdateSubprojectCommand,
} from '@rtm/project-management';
import { SubprojectRepository } from '../../repositories/SubprojectRepository';
import { ProjectRepository } from '../../repositories/ProjectRepository';
import { ValidationError, NotFoundError } from '../../middleware/error-handler';
import { logger } from '../../middleware/logger';

export class SubprojectDomainService
  implements
    Pick<
      ProjectService,
      | 'createSubproject'
      | 'getSubproject'
      | 'getSubprojectsForProject'
      | 'updateSubproject'
      | 'deleteSubproject'
    >
{
  private subprojectRepository: SubprojectRepository;
  private projectRepository: ProjectRepository;

  constructor() {
    this.subprojectRepository = new SubprojectRepository();
    this.projectRepository = new ProjectRepository();
  }

  /**
   * Create a new subproject with business validation and geocoding
   */
  async createSubproject(command: CreateSubprojectCommand): Promise<Subproject> {
    logger.info('Creating subproject in domain service', {
      name: command.name,
      projectId: command.projectId,
    });

    // Business validation
    await this.validateCreateSubprojectCommand(command);

    try {
      // Get parent project for default cost rate
      const parentProject = await this.projectRepository.findById(command.projectId);
      if (!parentProject) {
        throw new NotFoundError('Parent project');
      }

      return await this.subprojectRepository.create(command, parentProject.defaultCostPerKm);
    } catch (error) {
      logger.error('Failed to create subproject', {
        name: command.name,
        projectId: command.projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get subproject by ID
   */
  async getSubproject(id: string): Promise<Subproject | null> {
    this.validateSubprojectId(id);
    return await this.subprojectRepository.findById(id);
  }

  /**
   * Get subprojects for a project
   */
  async getSubprojectsForProject(projectId: string): Promise<Subproject[]> {
    this.validateProjectId(projectId);

    // Verify project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    return await this.subprojectRepository.findByProjectId(projectId);
  }

  /**
   * Update an existing subproject with business validation and geocoding
   */
  async updateSubproject(command: UpdateSubprojectCommand): Promise<Subproject> {
    logger.info('Updating subproject in domain service', {
      id: command.id,
      projectId: command.projectId,
      name: command.name,
    });

    // Business validation
    await this.validateUpdateSubprojectCommand(command);

    try {
      return await this.subprojectRepository.update(command);
    } catch (error) {
      if (error instanceof Error && error.message === 'Subproject not found') {
        throw new NotFoundError('Subproject');
      }

      logger.error('Failed to update subproject', {
        id: command.id,
        projectId: command.projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete a subproject with business validation
   */
  async deleteSubproject(projectId: string, subprojectId: string): Promise<void> {
    logger.info('Deleting subproject in domain service', {
      projectId,
      subprojectId,
    });

    this.validateProjectId(projectId);
    this.validateSubprojectId(subprojectId);

    try {
      await this.subprojectRepository.delete(projectId, subprojectId);
      logger.info('Subproject deleted successfully', {
        projectId,
        subprojectId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Subproject not found') {
        throw new NotFoundError('Subproject');
      }
      if (error instanceof Error && error.message.includes('active travel requests')) {
        throw new ValidationError(error.message);
      }

      logger.error('Failed to delete subproject', {
        projectId,
        subprojectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if subproject exists in project
   */
  async validateSubprojectInProject(subprojectId: string, projectId: string): Promise<void> {
    const exists = await this.subprojectRepository.existsInProject(subprojectId, projectId);
    if (!exists) {
      throw new NotFoundError('Subproject not found in specified project');
    }
  }

  // Private validation methods

  private async validateCreateSubprojectCommand(command: CreateSubprojectCommand): Promise<void> {
    // Validate required fields
    if (!command.projectId || command.projectId.trim().length === 0) {
      throw new ValidationError('Project ID is required');
    }

    if (!command.name || command.name.trim().length === 0) {
      throw new ValidationError('Subproject name is required');
    }

    if (command.name.length > 255) {
      throw new ValidationError('Subproject name must be 255 characters or less');
    }

    // Validate address fields if provided
    if (command.streetAddress && command.streetAddress.length > 255) {
      throw new ValidationError('Street address must be 255 characters or less');
    }

    if (command.city && command.city.length > 100) {
      throw new ValidationError('City must be 100 characters or less');
    }

    if (command.postalCode && !this.isValidSwissPostalCode(command.postalCode)) {
      throw new ValidationError('Invalid Swiss postal code format (expected 4-5 digits)');
    }

    if (command.costPerKm !== undefined) {
      if (command.costPerKm <= 0) {
        throw new ValidationError('Cost per kilometer must be positive');
      }
      if (command.costPerKm > 100) {
        throw new ValidationError('Cost per kilometer seems unreasonably high (max 100 CHF/km)');
      }
    }

    // Verify parent project exists and is active
    const parentProject = await this.projectRepository.findById(command.projectId);
    if (!parentProject) {
      throw new NotFoundError('Parent project');
    }

    if (!parentProject.isActive) {
      throw new ValidationError('Cannot create subproject for inactive project');
    }
  }

  private async validateUpdateSubprojectCommand(command: UpdateSubprojectCommand): Promise<void> {
    this.validateSubprojectId(command.id);
    this.validateProjectId(command.projectId);

    // Validate optional fields
    if (command.name !== undefined) {
      if (!command.name || command.name.trim().length === 0) {
        throw new ValidationError('Subproject name cannot be empty');
      }
      if (command.name.length > 255) {
        throw new ValidationError('Subproject name must be 255 characters or less');
      }
    }

    if (
      command.streetAddress !== undefined &&
      command.streetAddress &&
      command.streetAddress.length > 255
    ) {
      throw new ValidationError('Street address must be 255 characters or less');
    }

    if (command.city !== undefined && command.city && command.city.length > 100) {
      throw new ValidationError('City must be 100 characters or less');
    }

    if (
      command.postalCode !== undefined &&
      command.postalCode &&
      !this.isValidSwissPostalCode(command.postalCode)
    ) {
      throw new ValidationError('Invalid Swiss postal code format (expected 4-5 digits)');
    }

    if (command.costPerKm !== undefined) {
      if (command.costPerKm <= 0) {
        throw new ValidationError('Cost per kilometer must be positive');
      }
      if (command.costPerKm > 100) {
        throw new ValidationError('Cost per kilometer seems unreasonably high (max 100 CHF/km)');
      }
    }

    // Verify project exists
    const project = await this.projectRepository.findById(command.projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }
  }

  private validateProjectId(id: string): void {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Project ID is required');
    }
  }

  private validateSubprojectId(id: string): void {
    if (!id || id.trim().length === 0) {
      throw new ValidationError('Subproject ID is required');
    }
  }

  private isValidSwissPostalCode(postalCode: string): boolean {
    // Swiss postal codes are 4-5 digits
    const swissPostalCodeRegex = /^[0-9]{4,5}$/;
    return swissPostalCodeRegex.test(postalCode);
  }
}
