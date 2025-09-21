import { BaseRepository } from './base/BaseRepository';
import {
  Project,
  CreateProjectCommand,
  UpdateProjectCommand,
  ProjectSearchFilters,
} from '@rtm/project-management';
import { logger } from '../middleware/logger';

export interface ProjectWithCount extends Project {
  subprojectCount: number;
}

export class ProjectRepository extends BaseRepository {
  /**
   * Create a new project
   */
  async create(command: CreateProjectCommand): Promise<Project> {
    logger.info('Creating project in repository', { name: command.name });

    const result = await this.query(
      `
      INSERT INTO projects (name, description, default_cost_per_km, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `,
      [command.name, command.description || null, command.defaultCostPerKm]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get project by ID
   */
  async findById(id: string): Promise<Project | null> {
    const result = await this.query('SELECT * FROM projects WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Update an existing project
   */
  async update(command: UpdateProjectCommand): Promise<Project> {
    logger.info('Updating project in repository', { id: command.id });

    const updateFields: Record<string, any> = {};
    if (command.name !== undefined) {
      updateFields.name = command.name;
    }
    if (command.description !== undefined) {
      updateFields.description = command.description;
    }
    if (command.defaultCostPerKm !== undefined) {
      updateFields.defaultCostPerKm = command.defaultCostPerKm;
    }
    if (command.isActive !== undefined) {
      updateFields.isActive = command.isActive;
    }

    if (Object.keys(updateFields).length === 0) {
      throw new Error('No fields to update');
    }

    const { setClauses, values, nextIndex } = this.buildUpdateClause(updateFields);
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(command.id);

    const result = await this.query(
      `
      UPDATE projects
      SET ${setClauses.join(', ')}
      WHERE id = $${nextIndex}
      RETURNING *
    `,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all active projects with subproject counts
   */
  async findActiveWithCounts(): Promise<ProjectWithCount[]> {
    const result = await this.query(`
      SELECT
        p.*,
        COUNT(s.id) as subproject_count
      FROM projects p
      LEFT JOIN subprojects s ON p.id = s.project_id AND s.is_active = true
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.name
    `);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subprojectCount: parseInt(row.subproject_count) || 0,
    }));
  }

  /**
   * Get all projects (including inactive) with subproject counts
   */
  async findAllWithCounts(): Promise<ProjectWithCount[]> {
    const result = await this.query(`
      SELECT
        p.*,
        COUNT(s.id) as subproject_count
      FROM projects p
      LEFT JOIN subprojects s ON p.id = s.project_id AND s.is_active = true
      GROUP BY p.id
      ORDER BY p.name
    `);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subprojectCount: parseInt(row.subproject_count) || 0,
    }));
  }

  /**
   * Search projects with filters
   */
  async findWithFilters(filters: ProjectSearchFilters): Promise<ProjectWithCount[]> {
    let query = `
      SELECT
        p.*,
        COUNT(s.id) as subproject_count
      FROM projects p
      LEFT JOIN subprojects s ON p.id = s.project_id AND s.is_active = true
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.search) {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.isActive !== undefined) {
      conditions.push(`p.is_active = $${paramIndex}`);
      params.push(filters.isActive);
      paramIndex++;
    }

    if (filters.minCostPerKm !== undefined) {
      conditions.push(`p.default_cost_per_km >= $${paramIndex}`);
      params.push(filters.minCostPerKm);
      paramIndex++;
    }

    if (filters.maxCostPerKm !== undefined) {
      conditions.push(`p.default_cost_per_km <= $${paramIndex}`);
      params.push(filters.maxCostPerKm);
      paramIndex++;
    }

    if (filters.createdAfter) {
      conditions.push(`p.created_at >= $${paramIndex}`);
      params.push(filters.createdAfter);
      paramIndex++;
    }

    if (filters.createdBefore) {
      conditions.push(`p.created_at <= $${paramIndex}`);
      params.push(filters.createdBefore);
      paramIndex++;
    }

    // Add WHERE clause if we have conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      GROUP BY p.id
      ORDER BY p.name
    `;

    const result = await this.query(query, params);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subprojectCount: parseInt(row.subproject_count) || 0,
    }));
  }

  /**
   * Search projects by name or description
   */
  async search(searchTerm: string): Promise<ProjectWithCount[]> {
    const result = await this.query(
      `
      SELECT
        p.*,
        COUNT(s.id) as subproject_count
      FROM projects p
      LEFT JOIN subprojects s ON p.id = s.project_id AND s.is_active = true
      WHERE (
        p.name ILIKE $1
        OR p.description ILIKE $1
      ) AND p.is_active = true
      GROUP BY p.id
      ORDER BY p.name
      LIMIT 50
    `,
      [`%${searchTerm}%`]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subprojectCount: parseInt(row.subproject_count) || 0,
    }));
  }

  /**
   * Check if project can be deleted (no active travel request references)
   */
  async canDelete(projectId: string): Promise<boolean> {
    const result = await this.query(
      `
      SELECT COUNT(*) as count
      FROM travel_requests tr
      JOIN subprojects s ON tr.subproject_id = s.id
      WHERE s.project_id = $1 AND tr.status != 'completed'
    `,
      [projectId]
    );

    return parseInt(result.rows[0].count) === 0;
  }

  /**
   * Delete project and its subprojects
   */
  async delete(projectId: string): Promise<void> {
    logger.info('Deleting project in repository', { projectId });

    // Delete associated subprojects first (cascade)
    await this.query('DELETE FROM subprojects WHERE project_id = $1', [projectId]);

    // Delete the project
    const result = await this.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);

    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }
  }
}
