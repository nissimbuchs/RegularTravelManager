import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, EMPTY, Subject } from 'rxjs';
import { map, tap, takeUntil, catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';
import {
  Project,
  Subproject,
  ProjectCreateRequest,
  ProjectUpdateRequest,
  SubprojectCreateRequest,
  SubprojectUpdateRequest,
  ProjectSearchFilters,
  GeocodingResult,
} from '../models/project.model';

@Injectable({
  providedIn: 'root',
})
export class ProjectService implements OnDestroy {
  private configService = inject(ConfigService);
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  public projects$ = this.projectsSubject.asObservable();

  // Global cleanup subject for service-level subscription management
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  private get baseUrl(): string {
    return `${this.configService.apiUrl}/projects`;
  }

  // Project CRUD Operations
  getProjects(filters?: ProjectSearchFilters): Observable<Project[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.isActive !== undefined)
        params = params.set('isActive', filters.isActive.toString());
      if (filters.minCostPerKm)
        params = params.set('minCostPerKm', filters.minCostPerKm.toString());
      if (filters.maxCostPerKm)
        params = params.set('maxCostPerKm', filters.maxCostPerKm.toString());
      if (filters.createdAfter) params = params.set('createdAfter', filters.createdAfter);
      if (filters.createdBefore) params = params.set('createdBefore', filters.createdBefore);
    }

    return this.http.get<{ data: { projects: Project[] } }>(this.baseUrl, { params }).pipe(
      map(response => response.data.projects),
      tap(projects => this.projectsSubject.next(projects))
    );
  }

  getProject(projectId: string): Observable<Project> {
    return this.http
      .get<{ data: { project: Project } }>(`${this.baseUrl}/${projectId}`)
      .pipe(map(response => response.data.project));
  }

  createProject(project: ProjectCreateRequest): Observable<Project> {
    return this.http.post<{ data: Project }>(this.baseUrl, project).pipe(
      map(response => response.data),
      tap(() => this.refreshProjects())
    );
  }

  updateProject(projectId: string, project: ProjectUpdateRequest): Observable<Project> {
    return this.http.put<{ data: Project }>(`${this.baseUrl}/${projectId}`, project).pipe(
      map(response => response.data),
      tap(() => this.refreshProjects())
    );
  }

  deleteProject(projectId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${projectId}`)
      .pipe(tap(() => this.refreshProjects()));
  }

  toggleProjectStatus(projectId: string): Observable<Project> {
    return this.http
      .patch<{ data: Project }>(`${this.baseUrl}/${projectId}/toggle-status`, {})
      .pipe(
        map(response => response.data),
        tap(() => this.refreshProjects())
      );
  }

  // Subproject CRUD Operations
  getSubprojects(projectId: string): Observable<Subproject[]> {
    return this.http
      .get<{ data: { subprojects: Subproject[] } }>(`${this.baseUrl}/${projectId}/subprojects`)
      .pipe(map(response => response.data.subprojects));
  }

  getSubproject(projectId: string, subprojectId: string): Observable<Subproject> {
    return this.http
      .get<{ data: Subproject }>(`${this.baseUrl}/${projectId}/subprojects/${subprojectId}`)
      .pipe(map(response => response.data));
  }

  createSubproject(subproject: SubprojectCreateRequest): Observable<Subproject> {
    return this.http
      .post<{ data: Subproject }>(`${this.baseUrl}/${subproject.projectId}/subprojects`, subproject)
      .pipe(
        map(response => response.data),
        tap(() => this.refreshProjects())
      );
  }

  updateSubproject(
    projectId: string,
    subprojectId: string,
    subproject: SubprojectUpdateRequest
  ): Observable<Subproject> {
    return this.http
      .put<{
        data: Subproject;
      }>(`${this.baseUrl}/${projectId}/subprojects/${subprojectId}`, subproject)
      .pipe(
        map(response => response.data),
        tap(() => this.refreshProjects())
      );
  }

  deleteSubproject(projectId: string, subprojectId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${projectId}/subprojects/${subprojectId}`)
      .pipe(tap(() => this.refreshProjects()));
  }

  toggleSubprojectStatus(projectId: string, subprojectId: string): Observable<Subproject> {
    return this.http
      .patch<{
        data: Subproject;
      }>(`${this.baseUrl}/${projectId}/subprojects/${subprojectId}/toggle-status`, {})
      .pipe(
        map(response => response.data),
        tap(() => this.refreshProjects())
      );
  }

  // Geocoding
  geocodeAddress(address: string): Observable<GeocodingResult> {
    const params = new HttpParams().set('address', address);
    return this.http
      .get<{ data: GeocodingResult }>(`${this.baseUrl}/geocode`, { params })
      .pipe(map(response => response.data));
  }

  // Utility methods
  getActiveProjects(): Observable<Project[]> {
    return this.http.get<{ data: { projects: Project[] } }>(`${this.baseUrl}/active`).pipe(
      map(response => response.data.projects),
      tap(projects => this.projectsSubject.next(projects))
    );
  }

  getActiveSubprojects(projectId: string): Observable<Subproject[]> {
    return this.http
      .get<{
        data: {
          project: string;
          subprojects: Subproject[];
        };
      }>(`${this.baseUrl}/${projectId}/subprojects`)
      .pipe(map(response => response.data.subprojects.filter(sp => sp.isActive)));
  }

  checkProjectReferences(
    projectId: string
  ): Observable<{ canDelete: boolean; referencesCount: number }> {
    return this.http
      .get<{
        data: { canDelete: boolean; referencesCount: number };
      }>(`${this.baseUrl}/${projectId}/references`)
      .pipe(map(response => response.data));
  }

  private refreshProjects(): void {
    this.getProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: error => {
          // Ignore auth errors silently during logout
          if (error.status !== 401 && error.status !== 403) {
            console.error('Failed to refresh projects:', error);
          }
        },
      });
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
      maximumFractionDigits: 2,
    }).format(amount);
  }

  parseCHF(value: string): number | null {
    const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Cleanup method to be called during logout to cancel all pending subscriptions
   */
  public cleanup(): void {
    this.destroy$.next();
    console.log('ProjectService: All background subscriptions cancelled');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
