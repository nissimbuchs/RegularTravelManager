#!/usr/bin/env node
// Development server to run Lambda functions locally
import express from 'express';
import cors from 'cors';

// Mock project data for development
const mockProjects = [
  {
    id: 'proj-1',
    name: 'Digital Transformation Initiative',
    description: 'Company-wide digital transformation project including system modernization and process optimization',
    defaultCostPerKm: 0.70,
    isActive: true,
    createdAt: new Date('2025-01-01').toISOString(),
    subprojects: []
  },
  {
    id: 'proj-2', 
    name: 'Infrastructure Modernization',
    description: 'Upgrading IT infrastructure and network systems across all Swiss offices',
    defaultCostPerKm: 0.75,
    isActive: true,
    createdAt: new Date('2025-01-15').toISOString(),
    subprojects: []
  }
];

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'RegularTravelManager API'
  });
});

// Projects endpoints
app.get('/projects', (req, res) => {
  try {
    let filteredProjects = [...mockProjects];
    
    // Apply filters if provided
    const { search, isActive, minCostPerKm, maxCostPerKm } = req.query;
    
    if (search) {
      const searchTerm = String(search).toLowerCase();
      filteredProjects = filteredProjects.filter(p => 
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
    res.json(activeProjects);
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
      subprojects: []
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
    res.json(project.subprojects);
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
      createdAt: new Date().toISOString()
    };
    
    project.subprojects.push(newSubproject);
    res.status(201).json(newSubproject);
  } catch (error) {
    console.error('Create subproject error:', error);
    res.status(500).json({ error: 'Failed to create subproject' });
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
      updatedAt: new Date().toISOString()
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
      referencesCount: 0
    });
  } catch (error) {
    console.error('Check project references error:', error);
    res.status(500).json({ error: 'Failed to check project references' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development API server running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📦 Projects API: http://localhost:${PORT}/projects`);
});