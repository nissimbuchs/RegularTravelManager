import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  ProjectDto, 
  SubprojectDto, 
  TravelRequestFormData, 
  CalculationPreview,
  CreateTravelRequestRequest,
  ApiResponse 
} from '@rtm/shared';
import { ProjectService } from '../../../core/services/project.service';

@Injectable({
  providedIn: 'root'
})
export class TravelRequestService {
  private apiUrl = 'https://api.your-domain.com'; // Update with actual API URL
  
  constructor(
    private http: HttpClient,
    private projectService: ProjectService
  ) {}

  getActiveProjects(): Observable<ProjectDto[]> {
    // Use the actual project service and convert to DTO format
    return this.projectService.getActiveProjects().pipe(
      map(projects => projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description || '',
        default_cost_per_km: project.defaultCostPerKm,
        is_active: project.isActive,
        created_at: project.createdAt,
        updated_at: project.createdAt
      }))),
      catchError(() => {
        // Fallback to mock data if project service fails
        const mockProjects: ProjectDto[] = [
          {
            id: 'proj-1',
            name: 'Swiss Infrastructure Development',
            description: 'Major infrastructure project across Switzerland',
            default_cost_per_km: 0.68,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'proj-2', 
            name: 'Digital Transformation Initiative',
            description: 'Company-wide digital transformation',
            default_cost_per_km: 0.75,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        return of(mockProjects);
      })
    );
  }

  getActiveSubprojects(projectId: string): Observable<SubprojectDto[]> {
    // Use the actual project service and convert to DTO format
    return this.projectService.getActiveSubprojects(projectId).pipe(
      map(subprojects => subprojects.map(subproject => ({
        id: subproject.id,
        project_id: subproject.projectId,
        name: subproject.name,
        location_street: subproject.locationStreet,
        location_city: subproject.locationCity,
        location_postal_code: subproject.locationPostalCode,
        location_coordinates: subproject.locationCoordinates,
        cost_per_km: subproject.costPerKm,
        is_active: subproject.isActive,
        created_at: subproject.createdAt,
        updated_at: subproject.createdAt
      }))),
      catchError(() => {
        // Fallback to mock data if project service fails
        const mockSubprojects: SubprojectDto[] = [
          {
            id: 'subproj-1',
            project_id: projectId,
            name: 'Zurich Office Complex',
            location_street: 'Bahnhofstrasse 100',
            location_city: 'Zurich',
            location_postal_code: '8001',
            location_coordinates: { latitude: 47.3769, longitude: 8.5417 },
            cost_per_km: projectId === 'proj-1' ? 0.70 : undefined,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'subproj-2',
            project_id: projectId,
            name: 'Basel Research Center',
            location_street: 'Universitätsspital',
            location_city: 'Basel',
            location_postal_code: '4031',
            location_coordinates: { latitude: 47.5596, longitude: 7.5886 },
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'subproj-3',
            project_id: projectId,
            name: 'Bern Government District',
            location_street: 'Bundesplatz 3',
            location_city: 'Bern',
            location_postal_code: '3003',
            location_coordinates: { latitude: 46.9481, longitude: 7.4474 },
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        
        return of(mockSubprojects.filter(sp => sp.project_id === projectId));
      })
    );
  }

  calculatePreview(subprojectId: string, daysPerWeek: number): Observable<CalculationPreview> {
    // Mock calculation for now - replace with actual API call
    const mockCalculation: CalculationPreview = {
      distance: 45.250,
      dailyAllowance: 30.75,
      weeklyAllowance: 30.75 * daysPerWeek
    };
    
    return of(mockCalculation);
    
    // Actual API call (uncomment when backend is ready):
    // return this.http.post<ApiResponse<CalculationPreview>>(
    //   `${this.apiUrl}/api/calculations/preview`,
    //   { subproject_id: subprojectId, days_per_week: daysPerWeek }
    // ).pipe(
    //   map(response => response.data!),
    //   catchError(this.handleError<CalculationPreview>('calculatePreview'))
    // );
  }

  submitRequest(formData: TravelRequestFormData): Observable<any> {
    const requestData: CreateTravelRequestRequest = {
      employee_id: 'current-employee-id', // Get from auth service
      subproject_id: formData.subProjectId,
      manager_name: formData.managerId, // Note: API expects manager_name but form uses managerId
      days_per_week: formData.daysPerWeek,
      justification: formData.justification
    };
    
    // Mock submission for now
    console.log('Submitting request:', requestData);
    return of({ success: true, requestId: 'req-' + Date.now() });
    
    // Actual API call (uncomment when backend is ready):
    // return this.http.post<ApiResponse<any>>(`${this.apiUrl}/api/travel-requests`, requestData)
    //   .pipe(
    //     map(response => response.data),
    //     catchError(this.handleError('submitRequest'))
    //   );
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      return of(result as T);
    };
  }
}