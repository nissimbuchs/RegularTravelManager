import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  Project, 
  Subproject, 
  ProjectCreateRequest, 
  ProjectUpdateRequest,
  SubprojectCreateRequest,
  SubprojectUpdateRequest,
  ProjectSearchFilters,
  GeocodingResult
} from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private readonly baseUrl = `${environment.apiUrl}/projects`;
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  public projects$ = this.projectsSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Project CRUD Operations
  getProjects(filters?: ProjectSearchFilters): Observable<Project[]> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.isActive !== undefined) params = params.set('isActive', filters.isActive.toString());
      if (filters.minCostPerKm) params = params.set('minCostPerKm', filters.minCostPerKm.toString());
      if (filters.maxCostPerKm) params = params.set('maxCostPerKm', filters.maxCostPerKm.toString());
      if (filters.createdAfter) params = params.set('createdAfter', filters.createdAfter);
      if (filters.createdBefore) params = params.set('createdBefore', filters.createdBefore);
    }

    return this.http.get<Project[]>(this.baseUrl, { params }).pipe(
      tap(projects => this.projectsSubject.next(projects))
    );
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/${id}`);
  }

  createProject(project: ProjectCreateRequest): Observable<Project> {
    return this.http.post<Project>(this.baseUrl, project).pipe(
      tap(() => this.refreshProjects())
    );
  }

  updateProject(id: string, project: ProjectUpdateRequest): Observable<Project> {
    return this.http.put<Project>(`${this.baseUrl}/${id}`, project).pipe(
      tap(() => this.refreshProjects())
    );
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.refreshProjects())
    );
  }

  toggleProjectStatus(id: string): Observable<Project> {
    return this.http.patch<Project>(`${this.baseUrl}/${id}/toggle-status`, {}).pipe(
      tap(() => this.refreshProjects())
    );
  }

  // Subproject CRUD Operations
  getSubprojects(projectId: string): Observable<Subproject[]> {
    return this.http.get<Subproject[]>(`${this.baseUrl}/${projectId}/subprojects`);
  }

  getSubproject(projectId: string, subprojectId: string): Observable<Subproject> {
    return this.http.get<Subproject>(`${this.baseUrl}/${projectId}/subprojects/${subprojectId}`);
  }

  createSubproject(subproject: SubprojectCreateRequest): Observable<Subproject> {
    return this.http.post<Subproject>(`${this.baseUrl}/${subproject.projectId}/subprojects`, subproject).pipe(
      tap(() => this.refreshProjects())
    );
  }

  updateSubproject(projectId: string, subprojectId: string, subproject: SubprojectUpdateRequest): Observable<Subproject> {
    return this.http.put<Subproject>(`${this.baseUrl}/${projectId}/subprojects/${subprojectId}`, subproject).pipe(
      tap(() => this.refreshProjects())
    );
  }

  deleteSubproject(projectId: string, subprojectId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${projectId}/subprojects/${subprojectId}`).pipe(
      tap(() => this.refreshProjects())
    );
  }

  toggleSubprojectStatus(projectId: string, subprojectId: string): Observable<Subproject> {
    return this.http.patch<Subproject>(`${this.baseUrl}/${projectId}/subprojects/${subprojectId}/toggle-status`, {}).pipe(
      tap(() => this.refreshProjects())
    );
  }

  // Geocoding
  geocodeAddress(address: string): Observable<GeocodingResult> {
    const params = new HttpParams().set('address', address);
    return this.http.get<GeocodingResult>(`${this.baseUrl}/geocode`, { params });
  }

  // Utility methods
  getActiveProjects(): Observable<Project[]> {
    // Mock data for development - replace with API call when backend is ready
    const mockProjects: Project[] = [
      {
        id: 'proj-1',
        name: 'Swiss Infrastructure Development',
        description: 'Major infrastructure project across Switzerland',
        defaultCostPerKm: 0.68,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'proj-2', 
        name: 'Digital Transformation Initiative',
        description: 'Company-wide digital transformation',
        defaultCostPerKm: 0.75,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'proj-3',
        name: 'Green Energy Project',
        description: 'Renewable energy initiative',
        defaultCostPerKm: 0.72,
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];
    
    return of(mockProjects);
    // return this.getProjects({ isActive: true });
  }

  getActiveSubprojects(projectId: string): Observable<Subproject[]> {
    // Mock data for development - replace with API call when backend is ready  
    const mockSubprojects: Subproject[] = [
      {
        id: 'subproj-1-1',
        projectId: 'proj-1',
        name: 'Zurich Office Complex',
        locationStreet: 'Bahnhofstrasse 100',
        locationCity: 'Zurich',
        locationPostalCode: '8001',
        locationCoordinates: { latitude: 47.3769, longitude: 8.5417 },
        costPerKm: 0.70,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'subproj-1-2',
        projectId: 'proj-1',
        name: 'Basel Research Center',
        locationStreet: 'Universitätsspital',
        locationCity: 'Basel',
        locationPostalCode: '4031',
        locationCoordinates: { latitude: 47.5596, longitude: 7.5886 },
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'subproj-1-3',
        projectId: 'proj-1',
        name: 'Geneva International Center',
        locationStreet: 'Route de Ferney 150',
        locationCity: 'Geneva',
        locationPostalCode: '1211',
        locationCoordinates: { latitude: 46.2276, longitude: 6.1478 },
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'subproj-2-1',
        projectId: 'proj-2',
        name: 'Lausanne Tech Hub',
        locationStreet: 'Avenue de la Gare 44',
        locationCity: 'Lausanne',
        locationPostalCode: '1003',
        locationCoordinates: { latitude: 46.5197, longitude: 6.6323 },
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'subproj-2-2',
        projectId: 'proj-2',
        name: 'St. Gallen Innovation Park',
        locationStreet: 'Lerchenfeldstrasse 5',
        locationCity: 'St. Gallen',
        locationPostalCode: '9014',
        locationCoordinates: { latitude: 47.4245, longitude: 9.3767 },
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'subproj-3-1',
        projectId: 'proj-3',
        name: 'Bern Wind Farm',
        locationStreet: 'Bundesplatz 3',
        locationCity: 'Bern',
        locationPostalCode: '3003',
        locationCoordinates: { latitude: 46.9481, longitude: 7.4474 },
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    return of(mockSubprojects.filter(sp => sp.projectId === projectId && sp.isActive));
    // return this.getSubprojects(projectId).pipe(
    //   map(subprojects => subprojects.filter(sp => sp.isActive))
    // );
  }

  checkProjectReferences(projectId: string): Observable<{ canDelete: boolean; referencesCount: number }> {
    return this.http.get<{ canDelete: boolean; referencesCount: number }>(`${this.baseUrl}/${projectId}/references`);
  }

  private refreshProjects(): void {
    this.getProjects().subscribe();
  }

  // Validation helpers
  validateCostRate(rate: number): boolean {
    return rate > 0 && Number.isFinite(rate);
  }

  formatCHF(amount: number): string {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  parseCHF(value: string): number | null {
    const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
}