import { BaseRepository } from './base/BaseRepository';
import {
  Subproject,
  CreateSubprojectCommand,
  UpdateSubprojectCommand,
} from '@rtm/project-management';
import { GeocodingService, GeocodeResult } from '../services/geocoding-service';
import { logger } from '../middleware/logger';

export class SubprojectRepository extends BaseRepository {
  private geocodingService: GeocodingService;

  constructor() {
    super();
    this.geocodingService = new GeocodingService();
  }

  /**
   * Create a new subproject with geocoding
   */
  async create(
    command: CreateSubprojectCommand,
    parentProjectDefaultCostPerKm?: number
  ): Promise<Subproject> {
    logger.info('Creating subproject in repository', {
      name: command.name,
      projectId: command.projectId,
    });

    let coordinates: GeocodeResult | null = null;

    // Geocode location if address is provided
    if (command.streetAddress && command.city && command.postalCode) {
      try {
        coordinates = await this.geocodingService.geocodeAddress({
          street: command.streetAddress,
          city: command.city,
          postalCode: command.postalCode,
          country: command.country || 'Switzerland',
        });

        logger.info('Subproject geocoding successful', {
          name: command.name,
          coordinates,
        });
      } catch (error) {
        logger.warn('Subproject geocoding failed, using default coordinates', {
          error: error instanceof Error ? error.message : String(error),
          name: command.name,
        });
        coordinates = { latitude: 46.947974, longitude: 7.447447 }; // Default to Bern
      }
    }

    // Use subproject cost rate or inherit from parent project
    const costPerKm = command.costPerKm || parentProjectDefaultCostPerKm;

    const result = await this.query(
      `
      INSERT INTO subprojects (
        project_id,
        name,
        street_address,
        city,
        postal_code,
        country,
        location,
        cost_per_km,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *
    `,
      [
        command.projectId,
        command.name,
        command.streetAddress || null,
        command.city || null,
        command.postalCode || null,
        command.country || 'Switzerland',
        coordinates ? `POINT(${coordinates.longitude} ${coordinates.latitude})` : null,
        costPerKm,
      ]
    );

    const row = result.rows[0];

    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      streetAddress: row.street_address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      locationCoordinates: coordinates
        ? {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          }
        : undefined,
      costPerKm: parseFloat(row.cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get subproject by ID with coordinates
   */
  async findById(id: string): Promise<Subproject | null> {
    const result = await this.query(
      `
      SELECT
        s.*,
        ST_X(s.location) as longitude,
        ST_Y(s.location) as latitude,
        p.name as project_name
      FROM subprojects s
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE s.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      streetAddress: row.street_address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      locationCoordinates:
        row.longitude && row.latitude
          ? {
              latitude: row.latitude,
              longitude: row.longitude,
            }
          : undefined,
      costPerKm: parseFloat(row.cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get subprojects for a project
   */
  async findByProjectId(projectId: string): Promise<Subproject[]> {
    const result = await this.query(
      `
      SELECT
        s.*,
        ST_X(s.location) as longitude,
        ST_Y(s.location) as latitude
      FROM subprojects s
      WHERE s.project_id = $1 AND s.is_active = true
      ORDER BY s.name
    `,
      [projectId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      streetAddress: row.street_address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      locationCoordinates:
        row.longitude && row.latitude
          ? {
              latitude: row.latitude,
              longitude: row.longitude,
            }
          : undefined,
      costPerKm: parseFloat(row.cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Update an existing subproject with geocoding
   */
  async update(command: UpdateSubprojectCommand): Promise<Subproject> {
    logger.info('Updating subproject in repository', {
      id: command.id,
      projectId: command.projectId,
      name: command.name,
    });

    // Verify subproject exists and belongs to the project
    const existingResult = await this.query(
      'SELECT * FROM subprojects WHERE id = $1 AND project_id = $2',
      [command.id, command.projectId]
    );

    if (existingResult.rows.length === 0) {
      throw new Error('Subproject not found');
    }

    const existing = existingResult.rows[0];
    let coordinates: GeocodeResult | null = null;

    // Check if location has changed and geocode if needed
    const hasLocationChanged =
      command.streetAddress !== existing.street_address ||
      command.city !== existing.city ||
      command.postalCode !== existing.postal_code;

    if (hasLocationChanged && command.streetAddress && command.city && command.postalCode) {
      try {
        coordinates = await this.geocodingService.geocodeAddress({
          street: command.streetAddress,
          city: command.city,
          postalCode: command.postalCode,
          country: command.country || 'Switzerland',
        });

        logger.info('Subproject geocoding successful', {
          id: command.id,
          coordinates,
        });
      } catch (error) {
        logger.warn('Subproject geocoding failed, keeping existing coordinates', {
          error: error instanceof Error ? error.message : String(error),
          id: command.id,
        });
      }
    }

    // Build update query dynamically based on provided fields
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (command.name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(command.name);
    }

    if (command.streetAddress !== undefined) {
      updateFields.push(`street_address = $${paramCount++}`);
      values.push(command.streetAddress);
    }

    if (command.city !== undefined) {
      updateFields.push(`city = $${paramCount++}`);
      values.push(command.city);
    }

    if (command.postalCode !== undefined) {
      updateFields.push(`postal_code = $${paramCount++}`);
      values.push(command.postalCode);
    }

    if (command.country !== undefined) {
      updateFields.push(`country = $${paramCount++}`);
      values.push(command.country);
    }

    if (command.costPerKm !== undefined) {
      updateFields.push(`cost_per_km = $${paramCount++}`);
      values.push(command.costPerKm);
    }

    if (command.isActive !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(command.isActive);
    }

    if (coordinates) {
      updateFields.push(
        `location = ST_SetSRID(ST_MakePoint($${paramCount++}, $${paramCount++}), 4326)`
      );
      values.push(coordinates.longitude, coordinates.latitude);
    }

    if (updateFields.length === 0) {
      // No updates needed, return existing subproject in proper format
      return this.findById(command.id) as Promise<Subproject>;
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(command.id, command.projectId); // Add WHERE clause parameters

    const query = `
      UPDATE subprojects
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND project_id = $${paramCount}
      RETURNING *
    `;

    const result = await this.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('Subproject not found');
    }

    // Get coordinates for response
    const updatedSubproject = await this.findById(command.id);
    if (!updatedSubproject) {
      throw new Error('Failed to retrieve updated subproject');
    }

    return updatedSubproject;
  }

  /**
   * Soft delete subproject (mark as inactive)
   */
  async delete(projectId: string, subprojectId: string): Promise<void> {
    logger.info('Deleting subproject in repository', {
      projectId,
      subprojectId,
    });

    // Check if subproject exists and belongs to the project
    const existingResult = await this.query(
      'SELECT * FROM subprojects WHERE id = $1 AND project_id = $2',
      [subprojectId, projectId]
    );

    if (existingResult.rows.length === 0) {
      throw new Error('Subproject not found');
    }

    // Check for active travel requests referencing this subproject
    const requestsResult = await this.query(
      'SELECT COUNT(*) as count FROM travel_requests WHERE subproject_id = $1 AND status IN ($2, $3)',
      [subprojectId, 'pending', 'approved']
    );

    const activeRequestCount = parseInt(requestsResult.rows[0].count);
    if (activeRequestCount > 0) {
      throw new Error(
        `Cannot delete subproject: ${activeRequestCount} active travel requests are referencing this location`
      );
    }

    // Soft delete by marking as inactive instead of hard delete
    await this.query(
      'UPDATE subprojects SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND project_id = $2',
      [subprojectId, projectId]
    );

    logger.info('Subproject deleted successfully', {
      projectId,
      subprojectId,
    });
  }

  /**
   * Check if subproject exists and belongs to project
   */
  async existsInProject(subprojectId: string, projectId: string): Promise<boolean> {
    const result = await this.query('SELECT 1 FROM subprojects WHERE id = $1 AND project_id = $2', [
      subprojectId,
      projectId,
    ]);

    return result.rows.length > 0;
  }
}
