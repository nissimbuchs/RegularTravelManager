import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import {
  createProject,
  createSubproject,
  getActiveProjects,
  getSubprojectsForProject,
  searchProjects,
  updateProject,
  deleteProject,
  toggleProjectStatus,
  checkProjectReferences,
} from '../../../handlers/projects/management';
import { GeocodingService } from '../../../services/geocoding-service';
import { extractUserContext, requireManager } from '../../../handlers/auth/auth-utils';

// Mock dependencies
const mockDbQuery = vi.fn();
vi.mock('../../../database/connection', () => ({
  db: {
    query: mockDbQuery,
    getPool: vi.fn(),
  },
}));
vi.mock('../../../services/geocoding-service');
vi.mock('../../../handlers/auth/auth-utils', () => ({
  extractUserContext: vi.fn(),
  requireManager: vi.fn(),
  getUserContextFromEvent: vi.fn(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGeocodingService = vi.mocked(GeocodingService);
const mockExtractUserContext = vi.mocked(extractUserContext);
const mockRequireManager = vi.mocked(requireManager);

describe('Project Management API', () => {
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'test-arn',
    memoryLimitInMB: '128',
    logGroupName: 'test-log-group',
    logStreamName: 'test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
    callbackWaitsForEmptyEventLoop: true,
  };

  const mockManagerEvent: Partial<APIGatewayProxyEvent> = {
    headers: {
      Authorization: 'Bearer valid-token',
    },
    requestContext: {
      authorizer: {
        claims: {
          sub: 'manager-123',
          'cognito:groups': 'managers',
          email: 'manager@test.com',
        },
      },
    } as any,
  };

  const mockProject = {
    id: 'project-123',
    name: 'Test Project',
    description: 'Test Description',
    default_cost_per_km: 0.5,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockSubproject = {
    id: 'subproject-123',
    project_id: 'project-123',
    name: 'Test Location',
    street_address: 'Bahnhofstrasse 1',
    city: 'Zurich',
    postal_code: '8001',
    country: 'Switzerland',
    location: 'POINT(8.5417 47.3769)',
    cost_per_km: 0.6,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.mockResolvedValue({ rows: [] });

    // Mock manager user context
    mockExtractUserContext.mockReturnValue({
      sub: 'manager-123',
      email: 'manager@test.com',
      isManager: true,
      groups: ['managers'],
    });

    // Mock requireManager to not throw for manager users
    mockRequireManager.mockImplementation(userContext => {
      if (!userContext.isManager) {
        throw new Error('Manager role required');
      }
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createProject', () => {
    it('should create project successfully with valid data', async () => {
      const event = {
        ...mockManagerEvent,
        body: JSON.stringify({
          name: 'New Project',
          description: 'Project Description',
          default_cost_per_km: 0.75,
        }),
      } as APIGatewayProxyEvent;

      mockDbQuery.mockResolvedValueOnce({
        rows: [mockProject],
      });

      const result = await createProject(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body).data).toEqual(mockProject);
      expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO projects'), [
        'New Project',
        'Project Description',
        0.75,
      ]);
    });

    it('should reject creation with negative cost per km', async () => {
      const event = {
        ...mockManagerEvent,
        body: JSON.stringify({
          name: 'New Project',
          default_cost_per_km: -0.25,
        }),
      } as APIGatewayProxyEvent;

      const result = await createProject(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Cost per kilometer must be positive');
    });

    it('should reject creation with missing required fields', async () => {
      const event = {
        ...mockManagerEvent,
        body: JSON.stringify({
          description: 'Missing name and cost',
        }),
      } as APIGatewayProxyEvent;

      const result = await createProject(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('name');
    });

    it('should reject non-manager access', async () => {
      const event = {
        ...mockManagerEvent,
        requestContext: {
          authorizer: {
            claims: {
              sub: 'employee-123',
              'cognito:groups': 'employees',
              email: 'employee@test.com',
            },
          },
        } as any,
        body: JSON.stringify({
          name: 'New Project',
          default_cost_per_km: 0.5,
        }),
      } as APIGatewayProxyEvent;

      const result = await createProject(event, mockContext);

      expect(result.statusCode).toBe(403);
    });
  });

  describe('createSubproject', () => {
    it('should create subproject with geocoding', async () => {
      const event = {
        ...mockManagerEvent,
        body: JSON.stringify({
          project_id: 'project-123',
          name: 'Test Location',
          street_address: 'Bahnhofstrasse 1',
          city: 'Zurich',
          postal_code: '8001',
          cost_per_km: 0.6,
        }),
      } as APIGatewayProxyEvent;

      // Mock project exists check
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'project-123', default_cost_per_km: 0.5 }],
      });

      // Mock geocoding service
      const mockGeocodingInstance = {
        geocodeAddress: vi.fn().mockResolvedValue({
          latitude: 47.3769,
          longitude: 8.5417,
        }),
      };
      mockGeocodingService.mockImplementation(() => mockGeocodingInstance);

      // Mock subproject creation
      mockDbQuery.mockResolvedValueOnce({
        rows: [mockSubproject],
      });

      const result = await createSubproject(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(mockGeocodingInstance.geocodeAddress).toHaveBeenCalledWith({
        street: 'Bahnhofstrasse 1',
        city: 'Zurich',
        postalCode: '8001',
        country: 'Switzerland',
      });
    });

    it('should handle geocoding failure gracefully', async () => {
      const event = {
        ...mockManagerEvent,
        body: JSON.stringify({
          project_id: 'project-123',
          name: 'Test Location',
          street_address: 'Invalid Address',
          city: 'Unknown',
          postal_code: '0000',
        }),
      } as APIGatewayProxyEvent;

      // Mock project exists
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'project-123', default_cost_per_km: 0.5 }],
      });

      // Mock geocoding failure
      const mockGeocodingInstance = {
        geocodeAddress: vi.fn().mockRejectedValue(new Error('Address not found')),
      };
      mockGeocodingService.mockImplementation(() => mockGeocodingInstance);

      // Mock subproject creation with default coordinates
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ ...mockSubproject, location: 'POINT(7.447447 46.947974)' }],
      });

      const result = await createSubproject(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subprojects'),
        expect.arrayContaining(['POINT(7.447447 46.947974)'])
      );
    });

    it('should reject creation for non-existent project', async () => {
      const event = {
        ...mockManagerEvent,
        body: JSON.stringify({
          project_id: 'non-existent',
          name: 'Test Location',
        }),
      } as APIGatewayProxyEvent;

      // Mock project not found
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createSubproject(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toContain('Parent project');
    });

    it('should validate Swiss postal code format', async () => {
      const event = {
        ...mockManagerEvent,
        body: JSON.stringify({
          project_id: 'project-123',
          name: 'Test Location',
          postal_code: '12345', // Invalid Swiss format
        }),
      } as APIGatewayProxyEvent;

      const result = await createSubproject(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('pattern');
    });
  });

  describe('getActiveProjects', () => {
    it('should return active projects with subproject counts', async () => {
      const mockProjects = [
        { ...mockProject, subproject_count: '2' },
        { ...mockProject, id: 'project-456', subproject_count: '0' },
      ];

      mockDbQuery.mockResolvedValueOnce({ rows: mockProjects });

      const event = { ...mockManagerEvent } as APIGatewayProxyEvent;
      const result = await getActiveProjects(event, mockContext);

      expect(result.statusCode).toBe(200);
      // Expect camelCase format as returned by handler
      const expectedProjects = [
        {
          id: 'project-123',
          name: 'Test Project',
          description: 'Test Description',
          defaultCostPerKm: 0.5,
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          subprojectCount: 2,
        },
        {
          id: 'project-456',
          name: 'Test Project',
          description: 'Test Description',
          defaultCostPerKm: 0.5,
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          subprojectCount: 0,
        },
      ];
      expect(JSON.parse(result.body).data.projects).toEqual(expectedProjects);
      expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE p.is_active = true'));
    });
  });

  describe('getSubprojectsForProject', () => {
    it('should return subprojects for valid project', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { projectId: 'project-123' },
      } as APIGatewayProxyEvent;

      // Mock project exists
      mockDbQuery.mockResolvedValueOnce({ rows: [mockProject] });

      // Mock subprojects query
      const mockSubprojects = [
        {
          ...mockSubproject,
          longitude: 8.5417,
          latitude: 47.3769,
        },
      ];
      mockDbQuery.mockResolvedValueOnce({ rows: mockSubprojects });

      const result = await getSubprojectsForProject(event, mockContext);

      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body).data;
      expect(response.project).toBe(mockProject.name);
      expect(response.subprojects).toHaveLength(1);
      expect(response.subprojects[0]).toHaveProperty('locationCoordinates', {
        latitude: 47.3769,
        longitude: 8.5417,
      });
    });

    it('should return 404 for non-existent project', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { projectId: 'non-existent' },
      } as APIGatewayProxyEvent;

      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getSubprojectsForProject(event, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('searchProjects', () => {
    it('should search projects by name and description', async () => {
      const event = {
        ...mockManagerEvent,
        queryStringParameters: { q: 'test' },
      } as APIGatewayProxyEvent;

      const mockResults = [mockProject];
      mockDbQuery.mockResolvedValueOnce({ rows: mockResults });

      const result = await searchProjects(event, mockContext);

      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body).data;
      expect(response.query).toBe('test');
      expect(response.projects).toEqual(mockResults);
      expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('ILIKE $1'), ['%test%']);
    });

    it('should require minimum search length', async () => {
      const event = {
        ...mockManagerEvent,
        queryStringParameters: { q: 'a' },
      } as APIGatewayProxyEvent;

      const result = await searchProjects(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('minLength');
    });

    it('should limit results to 50', async () => {
      const event = {
        ...mockManagerEvent,
        queryStringParameters: { q: 'test' },
      } as APIGatewayProxyEvent;

      mockDbQuery.mockResolvedValueOnce({ rows: [mockProject] });

      await searchProjects(event, mockContext);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 50'),
        expect.any(Array)
      );
    });
  });

  describe('updateProject', () => {
    it('should update project with valid data', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'project-123' },
        body: JSON.stringify({
          name: 'Updated Project',
          default_cost_per_km: 0.8,
        }),
      } as APIGatewayProxyEvent;

      mockDbQuery.mockResolvedValueOnce({
        rows: [{ ...mockProject, name: 'Updated Project', default_cost_per_km: 0.8 }],
      });

      const result = await updateProject(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects'),
        expect.arrayContaining(['Updated Project', 0.8, 'project-123'])
      );
    });

    it('should reject negative cost per km in updates', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'project-123' },
        body: JSON.stringify({
          default_cost_per_km: -0.25,
        }),
      } as APIGatewayProxyEvent;

      const result = await updateProject(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Cost per kilometer must be positive');
    });

    it('should return 404 for non-existent project update', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'non-existent' },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      } as APIGatewayProxyEvent;

      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await updateProject(event, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('toggleProjectStatus', () => {
    it('should toggle project status successfully', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'project-123' },
      } as APIGatewayProxyEvent;

      // Mock getting current project
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ ...mockProject, is_active: true }],
      });

      // Mock update result
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ ...mockProject, is_active: false }],
      });

      const result = await toggleProjectStatus(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseData = JSON.parse(result.body).data;
      expect(responseData.is_active).toBe(false);
    });

    it('should return 404 for non-existent project', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'non-existent' },
      } as APIGatewayProxyEvent;

      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await toggleProjectStatus(event, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('checkProjectReferences', () => {
    it('should return reference count and deletion status', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'project-123' },
      } as APIGatewayProxyEvent;

      // Mock canDeleteProject check
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      // Mock reference count query
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      const result = await checkProjectReferences(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseData = JSON.parse(result.body).data;
      expect(responseData).toEqual({
        canDelete: true,
        referencesCount: 0,
        projectId: 'project-123',
      });
    });

    it('should indicate project cannot be deleted when references exist', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'project-123' },
      } as APIGatewayProxyEvent;

      // Mock canDeleteProject check (returns false)
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });

      // Mock reference count query
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });

      const result = await checkProjectReferences(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseData = JSON.parse(result.body).data;
      expect(responseData.canDelete).toBe(false);
      expect(responseData.referencesCount).toBe(3);
    });
  });

  describe('deleteProject', () => {
    it('should delete project when no references exist', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'project-123' },
      } as APIGatewayProxyEvent;

      // Mock canDeleteProject check
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      // Mock getProject
      mockDbQuery.mockResolvedValueOnce({
        rows: [mockProject],
      });

      // Mock subprojects deletion
      mockDbQuery.mockResolvedValueOnce({
        rows: [],
      });

      // Mock project deletion
      mockDbQuery.mockResolvedValueOnce({
        rows: [mockProject],
      });

      const result = await deleteProject(event, mockContext);

      expect(result.statusCode).toBe(204);
      expect(mockDbQuery).toHaveBeenCalledWith('DELETE FROM subprojects WHERE project_id = $1', [
        'project-123',
      ]);
      expect(mockDbQuery).toHaveBeenCalledWith('DELETE FROM projects WHERE id = $1 RETURNING *', [
        'project-123',
      ]);
    });

    it('should prevent deletion when references exist', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'project-123' },
      } as APIGatewayProxyEvent;

      // Mock canDeleteProject check (returns false)
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });

      const result = await deleteProject(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain(
        'Cannot delete project with active travel request references'
      );
    });

    it('should return 404 for non-existent project', async () => {
      const event = {
        ...mockManagerEvent,
        pathParameters: { id: 'non-existent' },
      } as APIGatewayProxyEvent;

      // Mock canDeleteProject check
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      // Mock getProject (not found)
      mockDbQuery.mockResolvedValueOnce({
        rows: [],
      });

      const result = await deleteProject(event, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('CHF Validation', () => {
    it('should validate cost rates are positive decimals', async () => {
      const validCosts = [0.01, 0.5, 1.0, 999.99];
      const invalidCosts = [0, -0.5, -1, Infinity, NaN];

      for (const cost of validCosts) {
        const event = {
          ...mockManagerEvent,
          body: JSON.stringify({
            name: 'Test Project',
            default_cost_per_km: cost,
          }),
        } as APIGatewayProxyEvent;

        mockDbQuery.mockResolvedValueOnce({
          rows: [{ ...mockProject, default_cost_per_km: cost }],
        });

        const result = await createProject(event, mockContext);
        expect(result.statusCode).toBe(201);
      }

      for (const cost of invalidCosts) {
        const event = {
          ...mockManagerEvent,
          body: JSON.stringify({
            name: 'Test Project',
            default_cost_per_km: cost,
          }),
        } as APIGatewayProxyEvent;

        const result = await createProject(event, mockContext);
        expect(result.statusCode).toBe(400);
      }
    });

    it('should validate Swiss postal codes in subprojects', async () => {
      const validCodes = ['8001', '3000', '1200', '4000'];
      const invalidCodes = ['80011', '123', 'ABCD', '12345'];

      for (const code of validCodes) {
        const event = {
          ...mockManagerEvent,
          body: JSON.stringify({
            project_id: 'project-123',
            name: 'Test Location',
            postal_code: code,
          }),
        } as APIGatewayProxyEvent;

        // Mock project exists
        mockDbQuery.mockResolvedValueOnce({
          rows: [{ id: 'project-123', default_cost_per_km: 0.5 }],
        });

        mockDbQuery.mockResolvedValueOnce({
          rows: [mockSubproject],
        });

        const result = await createSubproject(event, mockContext);
        expect(result.statusCode).toBe(201);
      }

      for (const code of invalidCodes) {
        const event = {
          ...mockManagerEvent,
          body: JSON.stringify({
            project_id: 'project-123',
            name: 'Test Location',
            postal_code: code,
          }),
        } as APIGatewayProxyEvent;

        const result = await createSubproject(event, mockContext);
        expect(result.statusCode).toBe(400);
      }
    });
  });
});
