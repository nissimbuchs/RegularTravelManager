import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TravelRequestFormData, CalculationPreview } from '@rtm/shared';
import { Project, Subproject } from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';
import { ConfigService } from '../../../core/services/config.service';

@Injectable({
  providedIn: 'root',
})
export class TravelRequestService {
  private configService = inject(ConfigService);

  constructor(
    private http: HttpClient,
    private projectService: ProjectService
  ) {}

  private get apiUrl(): string {
    return this.configService.apiUrl;
  }

  getActiveProjects(): Observable<Project[]> {
    // Use the actual project service (already returns camelCase per API conventions)
    return this.projectService.getActiveProjects();
  }

  getActiveSubprojects(projectId: string): Observable<Subproject[]> {
    // Use the actual project service (already returns camelCase per API conventions)
    return this.projectService.getActiveSubprojects(projectId);
  }

  calculatePreview(subprojectId: string, daysPerWeek: number): Observable<CalculationPreview> {
    return this.http
      .post<{ data: CalculationPreview }>(`${this.apiUrl}/employees/travel-requests/preview`, {
        subprojectId,
        daysPerWeek,
      })
      .pipe(map(response => response.data));
  }

  submitRequest(formData: TravelRequestFormData): Observable<any> {
    const requestData = {
      subprojectId: formData.subProjectId, // ✅ Fixed: Use camelCase for API
      daysPerWeek: formData.daysPerWeek, // ✅ Fixed: Use camelCase for API
      justification: formData.justification,
      managerId: formData.managerId, // ✅ Fixed: Use camelCase for API
    };

    return this.http.post<any>(`${this.apiUrl}/employees/travel-requests`, requestData);
  }
}
