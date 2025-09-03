import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProjectDto, SubprojectDto, TravelRequestFormData, CalculationPreview } from '@rtm/shared';
import { ProjectService } from '../../../core/services/project.service';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TravelRequestService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private projectService: ProjectService
  ) {}

  getActiveProjects(): Observable<ProjectDto[]> {
    // Use the actual project service and convert to DTO format
    return this.projectService.getActiveProjects().pipe(
      map(projects =>
        projects.map(project => ({
          id: project.id,
          name: project.name,
          description: project.description || '',
          default_cost_per_km: project.defaultCostPerKm,
          is_active: project.isActive,
          created_at: project.createdAt,
          updated_at: project.createdAt,
        }))
      )
    );
  }

  getActiveSubprojects(projectId: string): Observable<SubprojectDto[]> {
    // Use the actual project service and convert to DTO format
    return this.projectService.getActiveSubprojects(projectId).pipe(
      map(subprojects =>
        subprojects.map(subproject => ({
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
          updated_at: subproject.createdAt,
        }))
      )
    );
  }

  calculatePreview(subprojectId: string, daysPerWeek: number): Observable<CalculationPreview> {
    return this.http
      .post<{ data: CalculationPreview }>(`${this.apiUrl}/api/employees/travel-requests/preview`, {
        subprojectId,
        daysPerWeek,
      })
      .pipe(map(response => response.data));
  }

  submitRequest(formData: TravelRequestFormData): Observable<any> {
    const requestData = {
      subproject_id: formData.subProjectId,
      days_per_week: formData.daysPerWeek,
      justification: formData.justification,
      manager_id: formData.managerId,
    };

    return this.http.post<any>(`${this.apiUrl}/api/employees/travel-requests`, requestData);
  }
}
