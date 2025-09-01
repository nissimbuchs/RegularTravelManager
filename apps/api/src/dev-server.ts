#!/usr/bin/env node
// Development server to run Lambda functions locally with LocalStack integration
import express from 'express';
import cors from 'cors';
import { getEnvironmentConfig } from './config/environment.js';
import { getDynamoClient, getS3Client } from './services/aws-factory.js';

// Mock project data for development
const mockProjects = [
  {
    id: 'proj-1',
    name: 'Digital Transformation Initiative',
    description:
      'Company-wide digital transformation project including system modernization and process optimization',
    defaultCostPerKm: 0.7,
    isActive: true,
    createdAt: new Date('2025-01-01').toISOString(),
    subprojects: [
      {
        id: 'subproj-1',
        projectId: 'proj-1',
        name: 'Zurich Office Modernization',
        locationStreet: 'Bahnhofstrasse 45',
        locationCity: 'Zurich',
        locationPostalCode: '8001',
        locationCoordinates: {
          latitude: 47.3769,
          longitude: 8.5417,
        },
        costPerKm: 0.7,
        isActive: true,
        createdAt: new Date('2025-01-01').toISOString(),
      },
      {
        id: 'subproj-2',
        projectId: 'proj-1',
        name: 'Geneva Branch Integration',
        locationStreet: 'Rue du Rhône 112',
        locationCity: 'Geneva',
        locationPostalCode: '1204',
        locationCoordinates: {
          latitude: 46.2044,
          longitude: 6.1432,
        },
        costPerKm: 0.75,
        isActive: true,
        createdAt: new Date('2025-01-05').toISOString(),
      },
      {
        id: 'subproj-3',
        projectId: 'proj-1',
        name: 'Basel Research Center',
        locationStreet: 'Steinentorstrasse 30',
        locationCity: 'Basel',
        locationPostalCode: '4051',
        locationCoordinates: {
          latitude: 47.5596,
          longitude: 7.5886,
        },
        costPerKm: null, // Will inherit from project
        isActive: true,
        createdAt: new Date('2025-01-10').toISOString(),
      },
    ],
  },
  {
    id: 'proj-2',
    name: 'Infrastructure Modernization',
    description: 'Upgrading IT infrastructure and network systems across all Swiss offices',
    defaultCostPerKm: 0.75,
    isActive: true,
    createdAt: new Date('2025-01-15').toISOString(),
    subprojects: [
      {
        id: 'subproj-4',
        projectId: 'proj-2',
        name: 'Bern Data Center',
        locationStreet: 'Bundesplatz 3',
        locationCity: 'Bern',
        locationPostalCode: '3003',
        locationCoordinates: {
          latitude: 46.948,
          longitude: 7.4474,
        },
        costPerKm: 0.8,
        isActive: true,
        createdAt: new Date('2025-01-16').toISOString(),
      },
      {
        id: 'subproj-5',
        projectId: 'proj-2',
        name: 'Lausanne Office Network',
        locationStreet: 'Place de la Gare 10',
        locationCity: 'Lausanne',
        locationPostalCode: '1003',
        locationCoordinates: null, // Not geocoded yet
        costPerKm: null, // Will inherit from project
        isActive: false,
        createdAt: new Date('2025-01-20').toISOString(),
      },
    ],
  },
];

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint with service checks
app.get('/health', async (req, res) => {
  const config = getEnvironmentConfig();

  try {
    const services = {
      database: 'connected', // TODO: Add database health check
      localstack: 'unknown',
      redis: 'unknown',
    };

    // Check LocalStack DynamoDB connection
    try {
      const dynamoClient = getDynamoClient();
      await dynamoClient.send({ input: {} }); // Simple connection test
      services.localstack = 'ready';
    } catch (error) {
      services.localstack = 'error';
    }

    res.json({
      status: 'ok',
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
      service: 'RegularTravelManager API',
      services,
      config: {
        awsRegion: config.AWS_REGION,
        awsEndpoint: config.AWS_ENDPOINT_URL,
        databaseUrl: config.DATABASE_URL ? 'configured' : 'missing',
        localStackMode: !!config.AWS_ENDPOINT_URL,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Projects endpoints
app.get('/projects', (req, res) => {
  try {
    let filteredProjects = [...mockProjects];

    // Apply filters if provided
    const { search, isActive, minCostPerKm, maxCostPerKm } = req.query;

    if (search) {
      const searchTerm = String(search).toLowerCase();
      filteredProjects = filteredProjects.filter(
        p =>
          p.name.toLowerCase().includes(searchTerm) ||
          p.description.toLowerCase().includes(searchTerm)
      );
    }

    if (isActive !== undefined) {
      filteredProjects = filteredProjects.filter(p => p.isActive === (isActive === 'true'));
    }

    if (minCostPerKm) {
      filteredProjects = filteredProjects.filter(p => p.defaultCostPerKm >= Number(minCostPerKm));
    }

    if (maxCostPerKm) {
      filteredProjects = filteredProjects.filter(p => p.defaultCostPerKm <= Number(maxCostPerKm));
    }

    res.json(filteredProjects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

app.get('/projects/active', (req, res) => {
  try {
    const activeProjects = mockProjects.filter(p => p.isActive);
    res.json({ data: activeProjects });
  } catch (error) {
    console.error('Get active projects error:', error);
    res.status(500).json({ error: 'Failed to load active projects' });
  }
});

app.post('/projects', (req, res) => {
  try {
    const newProject = {
      id: `proj-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      subprojects: [],
    };
    mockProjects.push(newProject);
    res.status(201).json(newProject);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Subprojects endpoints
app.get('/projects/:projectId/subprojects', (req, res) => {
  try {
    const project = mockProjects.find(p => p.id === req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ data: project.subprojects });
  } catch (error) {
    console.error('Get subprojects error:', error);
    res.status(500).json({ error: 'Failed to load subprojects' });
  }
});

app.post('/projects/:projectId/subprojects', (req, res) => {
  try {
    const project = mockProjects.find(p => p.id === req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const newSubproject = {
      id: `subproj-${Date.now()}`,
      projectId: req.params.projectId,
      ...req.body,
      createdAt: new Date().toISOString(),
    };

    project.subprojects.push(newSubproject);
    res.status(201).json(newSubproject);
  } catch (error) {
    console.error('Create subproject error:', error);
    res.status(500).json({ error: 'Failed to create subproject' });
  }
});

// Geocoding endpoint (must be before :id route)
app.get('/projects/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address parameter is required' });
    }

    // Mock geocoding response for development
    // In production, this would use the GeocodingService
    const mockGeocodeResult = {
      latitude: 46.947974 + (Math.random() - 0.5) * 0.1, // Bern area with some randomness
      longitude: 7.447447 + (Math.random() - 0.5) * 0.1,
      formattedAddress: address
    };

    console.log(`🗺️ Mock geocoding: "${address}" -> ${mockGeocodeResult.latitude}, ${mockGeocodeResult.longitude}`);
    
    res.json(mockGeocodeResult);
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// Individual project endpoints
app.get('/projects/:id', (req, res) => {
  try {
    const project = mockProjects.find(p => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

app.put('/projects/:id', (req, res) => {
  try {
    const projectIndex = mockProjects.findIndex(p => p.id === req.params.id);
    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    mockProjects[projectIndex] = {
      ...mockProjects[projectIndex],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    res.json(mockProjects[projectIndex]);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/projects/:id', (req, res) => {
  try {
    const projectIndex = mockProjects.findIndex(p => p.id === req.params.id);
    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    mockProjects.splice(projectIndex, 1);
    res.status(204).send();
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.patch('/projects/:id/toggle-status', (req, res) => {
  try {
    const project = mockProjects.find(p => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.isActive = !project.isActive;
    res.json(project);
  } catch (error) {
    console.error('Toggle project status error:', error);
    res.status(500).json({ error: 'Failed to toggle project status' });
  }
});

app.get('/projects/:id/references', (req, res) => {
  try {
    // Mock reference check - always return that project can be deleted for demo
    res.json({
      canDelete: true,
      referencesCount: 0,
    });
  } catch (error) {
    console.error('Check project references error:', error);
    res.status(500).json({ error: 'Failed to check project references' });
  }
});

// Mock employee data for development - matching production test users
const mockEmployees = {
  // Employee 1 - John Employee
  'employee1-cognito-id': {
    id: 'employee1-cognito-id',
    cognito_user_id: 'employee1-cognito-id',
    email: 'employee1@company.com',
    first_name: 'John',
    last_name: 'Employee',
    employee_id: 'EMP001',
    home_street: 'Bahnhofstrasse 45',
    home_city: 'Zurich',
    home_postal_code: '8001',
    home_country: 'Switzerland',
    home_location: {
      latitude: 47.3769,
      longitude: 8.5417,
    },
    created_at: new Date('2025-01-01').toISOString(),
    updated_at: new Date('2025-01-15').toISOString(),
  },
  // Employee 2 - Jane Worker
  'employee2-cognito-id': {
    id: 'employee2-cognito-id',
    cognito_user_id: 'employee2-cognito-id',
    email: 'employee2@company.com',
    first_name: 'Jane',
    last_name: 'Worker',
    employee_id: 'EMP002',
    home_street: 'Rue du Rhône 112',
    home_city: 'Geneva',
    home_postal_code: '1204',
    home_country: 'Switzerland',
    home_location: {
      latitude: 46.2044,
      longitude: 6.1432,
    },
    created_at: new Date('2025-01-01').toISOString(),
    updated_at: new Date('2025-01-10').toISOString(),
  },
  // Manager 1 - Bob Manager
  'manager1-cognito-id': {
    id: 'manager1-cognito-id',
    cognito_user_id: 'manager1-cognito-id',
    email: 'manager1@company.com',
    first_name: 'Bob',
    last_name: 'Manager',
    employee_id: 'MGR001',
    home_street: 'Steinentorstrasse 30',
    home_city: 'Basel',
    home_postal_code: '4051',
    home_country: 'Switzerland',
    home_location: {
      latitude: 47.5596,
      longitude: 7.5886,
    },
    created_at: new Date('2025-01-01').toISOString(),
    updated_at: new Date('2025-01-05').toISOString(),
  },
  // Manager 2 - Alice Director
  'manager2-cognito-id': {
    id: 'manager2-cognito-id',
    cognito_user_id: 'manager2-cognito-id',
    email: 'manager2@company.com',
    first_name: 'Alice',
    last_name: 'Director',
    employee_id: 'MGR002',
    home_street: 'Bundesplatz 3',
    home_city: 'Bern',
    home_postal_code: '3003',
    home_country: 'Switzerland',
    home_location: {
      latitude: 46.948,
      longitude: 7.4474,
    },
    created_at: new Date('2025-01-01').toISOString(),
    updated_at: new Date('2025-01-08').toISOString(),
  },
};

// Employee endpoints
app.get('/employees/:id', (req, res) => {
  try {
    const employee = mockEmployees[req.params.id];
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Failed to load employee' });
  }
});

app.put('/employees/:id/address', (req, res) => {
  try {
    const employee = mockEmployees[req.params.id];
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { home_street, home_city, home_postal_code, home_country } = req.body;

    // Simple validation
    if (!home_street || !home_city || !home_postal_code || !home_country) {
      return res.status(422).json({ error: 'All address fields are required' });
    }

    // Mock geocoding for Swiss cities
    const mockCoordinates = {
      Zurich: { latitude: 47.3769, longitude: 8.5417 },
      Geneva: { latitude: 46.2044, longitude: 6.1432 },
      Basel: { latitude: 47.5596, longitude: 7.5886 },
      Bern: { latitude: 46.948, longitude: 7.4474 },
      Lausanne: { latitude: 46.5197, longitude: 6.6323 },
    };

    // Update employee
    mockEmployees[req.params.id] = {
      ...employee,
      home_street,
      home_city,
      home_postal_code,
      home_country,
      home_location: mockCoordinates[home_city] || { latitude: 46.948, longitude: 7.4474 },
      updated_at: new Date().toISOString(),
    };

    res.json(mockEmployees[req.params.id]);
  } catch (error) {
    console.error('Update employee address error:', error);
    res.status(500).json({ error: 'Failed to update employee address' });
  }
});

// Travel Request endpoints
app.post('/api/employees/travel-requests/preview', (req, res) => {
  try {
    const { subprojectId, daysPerWeek } = req.body;
    
    if (!subprojectId || !daysPerWeek) {
      return res.status(400).json({ error: 'subprojectId and daysPerWeek are required' });
    }

    // Find the subproject
    let foundSubproject = null;
    for (const project of mockProjects) {
      const subproject = project.subprojects.find(sp => sp.id === subprojectId);
      if (subproject) {
        foundSubproject = subproject;
        break;
      }
    }

    if (!foundSubproject) {
      return res.status(404).json({ error: 'Subproject not found' });
    }

    // Mock calculation based on Swiss travel allowances
    const costPerKm = foundSubproject.costPerKm || 0.7;
    const estimatedDistanceKm = 25; // Mock distance from home to subproject
    const weeksPerYear = 52;
    const workingDaysPerWeek = daysPerWeek;
    
    const dailyAllowance = estimatedDistanceKm * 2 * costPerKm; // Round trip
    const weeklyAllowance = dailyAllowance * workingDaysPerWeek;
    const monthlyAllowance = weeklyAllowance * (weeksPerYear / 12);
    const yearlyAllowance = weeklyAllowance * weeksPerYear;

    const calculationPreview = {
      subprojectId,
      subprojectName: foundSubproject.name,
      daysPerWeek: workingDaysPerWeek,
      estimatedDistanceKm,
      costPerKm,
      dailyAllowance: Math.round(dailyAllowance * 100) / 100,
      weeklyAllowance: Math.round(weeklyAllowance * 100) / 100,
      monthlyAllowance: Math.round(monthlyAllowance * 100) / 100,
      yearlyAllowance: Math.round(yearlyAllowance * 100) / 100,
      calculation: {
        method: 'Distance-based calculation',
        formula: `${estimatedDistanceKm}km × 2 (round trip) × CHF ${costPerKm}/km × ${workingDaysPerWeek} days/week`,
        assumptions: [
          `Estimated distance: ${estimatedDistanceKm}km from home to workplace`,
          `Cost per kilometer: CHF ${costPerKm}`,
          `Working ${workingDaysPerWeek} days per week`,
          'Based on Swiss Federal travel allowance guidelines'
        ]
      }
    };

    console.log(`💰 Travel allowance calculation preview for subproject ${foundSubproject.name}: CHF ${calculationPreview.monthlyAllowance}/month`);
    
    res.json({ data: calculationPreview });
  } catch (error) {
    console.error('Travel request preview calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate travel allowance preview' });
  }
});

app.post('/api/employees/travel-requests', (req, res) => {
  try {
    const { subproject_id, days_per_week, justification } = req.body;
    
    if (!subproject_id || !days_per_week) {
      return res.status(400).json({ error: 'subproject_id and days_per_week are required' });
    }

    // Mock travel request creation
    const mockTravelRequest = {
      id: `tr-${Date.now()}`,
      employee_id: 'employee1-cognito-id', // Mock current user
      subproject_id,
      days_per_week,
      justification: justification || '',
      status: 'pending',
      submitted_at: new Date().toISOString(),
      estimated_monthly_allowance: 850.50, // Mock calculated value
    };

    console.log(`📝 Travel request submitted: ${mockTravelRequest.id} for ${days_per_week} days/week`);
    
    res.status(201).json({ data: mockTravelRequest });
  } catch (error) {
    console.error('Travel request submission error:', error);
    res.status(500).json({ error: 'Failed to submit travel request' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development API server running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📦 Projects API: http://localhost:${PORT}/projects`);
  console.log(`👤 Employees API: http://localhost:${PORT}/employees`);
});
