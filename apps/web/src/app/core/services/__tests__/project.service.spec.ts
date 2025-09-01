import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProjectService } from '../project.service';
import {
  Project,
  Subproject,
  ProjectCreateRequest,
  ProjectUpdateRequest,
  SubprojectCreateRequest,
  ProjectSearchFilters,
  GeocodingResult,
} from '../../models/project.model';
import { environment } from '../../../../environments/environment';

describe('ProjectService', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/projects`;

  const mockProject: Project = {
    id: '1',
    name: 'Test Project',
    description: 'Test Description',
    defaultCostPerKm: 0.5,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    subprojects: [],
  };

  const mockSubproject: Subproject = {
    id: 'sub1',
    projectId: '1',
    name: 'Test Location',
    locationStreet: 'Bahnhofstrasse 1',
    locationCity: 'Zurich',
    locationPostalCode: '8001',
    locationCoordinates: { latitude: 47.3769, longitude: 8.5417 },
    costPerKm: 0.6,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProjectService],
    });

    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Project CRUD Operations', () => {
    it('should get projects with no filters', () => {
      const mockProjects = [mockProject];

      service.getProjects().subscribe(projects => {
        expect(projects).toEqual(mockProjects);
      });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush(mockProjects);
    });

    it('should get projects with filters', () => {
      const filters: ProjectSearchFilters = {
        search: 'test',
        isActive: true,
        minCostPerKm: 0.4,
        maxCostPerKm: 0.6,
      };

      service.getProjects(filters).subscribe();

      const req = httpMock.expectOne(
        request =>
          request.url === baseUrl &&
          request.params.get('search') === 'test' &&
          request.params.get('isActive') === 'true' &&
          request.params.get('minCostPerKm') === '0.4' &&
          request.params.get('maxCostPerKm') === '0.6'
      );
      expect(req.request.method).toBe('GET');
      req.flush([mockProject]);
    });

    it('should get a single project', () => {
      service.getProject('1').subscribe(project => {
        expect(project).toEqual(mockProject);
      });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockProject);
    });

    it('should create a project', () => {
      const createRequest: ProjectCreateRequest = {
        name: 'New Project',
        description: 'New Description',
        defaultCostPerKm: 0.75,
        isActive: true,
      };

      service.createProject(createRequest).subscribe(project => {
        expect(project).toEqual(mockProject);
      });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createRequest);
      req.flush(mockProject);

      // Should trigger refresh call
      const refreshReq = httpMock.expectOne(baseUrl);
      expect(refreshReq.request.method).toBe('GET');
      refreshReq.flush([mockProject]);
    });

    it('should update a project', () => {
      const updateRequest: ProjectUpdateRequest = {
        name: 'Updated Project',
        defaultCostPerKm: 0.8,
      };

      service.updateProject('1', updateRequest).subscribe(project => {
        expect(project).toEqual(mockProject);
      });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateRequest);
      req.flush(mockProject);

      // Should trigger refresh call
      const refreshReq = httpMock.expectOne(baseUrl);
      refreshReq.flush([mockProject]);
    });

    it('should delete a project', () => {
      service.deleteProject('1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      // Should trigger refresh call
      const refreshReq = httpMock.expectOne(baseUrl);
      refreshReq.flush([]);
    });

    it('should toggle project status', () => {
      service.toggleProjectStatus('1').subscribe(project => {
        expect(project).toEqual(mockProject);
      });

      const req = httpMock.expectOne(`${baseUrl}/1/toggle-status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush(mockProject);

      // Should trigger refresh call
      const refreshReq = httpMock.expectOne(baseUrl);
      refreshReq.flush([mockProject]);
    });
  });

  describe('Subproject CRUD Operations', () => {
    it('should get subprojects for a project', () => {
      const mockSubprojects = [mockSubproject];

      service.getSubprojects('1').subscribe(subprojects => {
        expect(subprojects).toEqual(mockSubprojects);
      });

      const req = httpMock.expectOne(`${baseUrl}/1/subprojects`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSubprojects);
    });

    it('should create a subproject', () => {
      const createRequest: SubprojectCreateRequest = {
        projectId: '1',
        name: 'New Location',
        locationStreet: 'Teststrasse 1',
        locationCity: 'Basel',
        locationPostalCode: '4001',
        isActive: true,
      };

      service.createSubproject(createRequest).subscribe(subproject => {
        expect(subproject).toEqual(mockSubproject);
      });

      const req = httpMock.expectOne(`${baseUrl}/1/subprojects`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createRequest);
      req.flush(mockSubproject);

      // Should trigger refresh call
      const refreshReq = httpMock.expectOne(baseUrl);
      refreshReq.flush([mockProject]);
    });

    it('should delete a subproject', () => {
      service.deleteSubproject('1', 'sub1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/1/subprojects/sub1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      // Should trigger refresh call
      const refreshReq = httpMock.expectOne(baseUrl);
      refreshReq.flush([mockProject]);
    });
  });

  describe('Geocoding', () => {
    it('should geocode an address', () => {
      const mockResult: GeocodingResult = {
        latitude: 47.3769,
        longitude: 8.5417,
        formattedAddress: 'Bahnhofstrasse 1, 8001 Zurich, Switzerland',
      };

      service.geocodeAddress('Bahnhofstrasse 1, Zurich').subscribe(result => {
        expect(result).toEqual(mockResult);
      });

      const req = httpMock.expectOne(
        request =>
          request.url === `${baseUrl}/geocode` &&
          request.params.get('address') === 'Bahnhofstrasse 1, Zurich'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResult);
    });
  });

  describe('Utility Methods', () => {
    it('should get active projects only', () => {
      service.getActiveProjects().subscribe(projects => {
        expect(projects.length).toBeGreaterThan(0);
        expect(projects.every(p => p.isActive)).toBeTruthy();
      });
    });

    it('should filter active subprojects', () => {
      service.getActiveSubprojects('proj-1').subscribe(subprojects => {
        expect(subprojects.length).toBeGreaterThan(0);
        expect(subprojects.every(sp => sp.isActive)).toBeTruthy();
        expect(subprojects.every(sp => sp.projectId === 'proj-1')).toBeTruthy();
      });
    });

    it('should check project references', () => {
      const mockResponse = { canDelete: false, referencesCount: 3 };

      service.checkProjectReferences('1').subscribe(result => {
        expect(result).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${baseUrl}/1/references`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should validate cost rates correctly', () => {
      expect(service.validateCostRate(0.5)).toBeTruthy();
      expect(service.validateCostRate(1.0)).toBeTruthy();
      expect(service.validateCostRate(999.99)).toBeTruthy();

      expect(service.validateCostRate(0)).toBeFalsy();
      expect(service.validateCostRate(-0.5)).toBeFalsy();
      expect(service.validateCostRate(Infinity)).toBeFalsy();
      expect(service.validateCostRate(NaN)).toBeFalsy();
    });

    it('should format CHF currency correctly', () => {
      const formatted = service.formatCHF(1.23);
      expect(formatted).toMatch(/CHF.*1[.,]23/); // Allow for locale differences
    });

    it('should parse CHF strings correctly', () => {
      expect(service.parseCHF('CHF 1.23')).toBe(1.23);
      expect(service.parseCHF('1,50')).toBe(1.5);
      expect(service.parseCHF('1.75')).toBe(1.75);
      expect(service.parseCHF('invalid')).toBeNull();
      expect(service.parseCHF('')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle project creation errors', () => {
      const createRequest: ProjectCreateRequest = {
        name: 'Test',
        defaultCostPerKm: 0.5,
      };

      service.createProject(createRequest).subscribe({
        next: () => fail('should have failed'),
        error: error => {
          expect(error.status).toBe(400);
        },
      });

      const req = httpMock.expectOne(baseUrl);
      req.flush({ message: 'Validation failed' }, { status: 400, statusText: 'Bad Request' });
    });

    it('should handle geocoding errors', () => {
      service.geocodeAddress('invalid address').subscribe({
        next: () => fail('should have failed'),
        error: error => {
          expect(error.status).toBe(404);
        },
      });

      const req = httpMock.expectOne(`${baseUrl}/geocode?address=invalid%20address`);
      req.flush({ message: 'Address not found' }, { status: 404, statusText: 'Not Found' });
    });
  });
});
