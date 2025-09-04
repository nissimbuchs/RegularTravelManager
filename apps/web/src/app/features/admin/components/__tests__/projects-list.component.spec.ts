import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';

import { ProjectsListComponent } from '../projects-list.component';
import { ProjectService } from '../../../../core/services/project.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { Project, ProjectSearchFilters } from '../../../../core/models/project.model';

describe('ProjectsListComponent', () => {
  let component: ProjectsListComponent;
  let fixture: ComponentFixture<ProjectsListComponent>;
  let mockProjectService: jasmine.SpyObj<ProjectService>;
  let mockLoadingService: jasmine.SpyObj<LoadingService>;
  let mockDialog: jasmine.SpyObj<MatDialog>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockProjects: Project[] = [
    {
      id: '1',
      name: 'Project Alpha',
      description: 'Test project Alpha',
      defaultCostPerKm: 0.5,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      subprojects: [],
    },
    {
      id: '2',
      name: 'Project Beta',
      description: 'Test project Beta',
      defaultCostPerKm: 0.75,
      isActive: false,
      createdAt: '2024-01-02T00:00:00Z',
      subprojects: [],
    },
  ];

  beforeEach(async () => {
    const projectServiceSpy = jasmine.createSpyObj('ProjectService', [
      'getProjects',
      'toggleProjectStatus',
      'deleteProject',
      'checkProjectReferences',
      'formatCHF',
    ]);

    const loadingServiceSpy = jasmine.createSpyObj('LoadingService', ['setLoading'], {
      loading$: of(false),
    });

    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open'], {
      // Add mock openDialogs array to prevent "push" error
      openDialogs: [],
    }) as any; // Use 'any' to bypass readonly restriction
    const snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const activatedRouteSpy = jasmine.createSpyObj('ActivatedRoute', [], {
      snapshot: { params: {}, queryParams: {} },
      params: of({}),
      queryParams: of({}),
    });

    await TestBed.configureTestingModule({
      imports: [ProjectsListComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        { provide: ProjectService, useValue: projectServiceSpy },
        { provide: LoadingService, useValue: loadingServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteSpy },
      ],
    }).compileComponents();

    mockProjectService = TestBed.inject(ProjectService) as jasmine.SpyObj<ProjectService>;
    mockLoadingService = TestBed.inject(LoadingService) as jasmine.SpyObj<LoadingService>;
    mockDialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    mockSnackBar = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Setup default service responses
    mockProjectService.getProjects.and.returnValue(of(mockProjects));
    mockProjectService.formatCHF.and.returnValue('CHF 0.50');

    // Setup default dialog mock - return a proper dialog reference
    const defaultDialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    defaultDialogRef.afterClosed.and.returnValue(of(false)); // Default to cancelled/closed
    mockDialog.open.and.returnValue(defaultDialogRef);

    fixture = TestBed.createComponent(ProjectsListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load projects on init', () => {
    fixture.detectChanges();

    expect(mockProjectService.getProjects).toHaveBeenCalled();
    expect(mockLoadingService.setLoading).toHaveBeenCalledWith(true);
    expect(component.dataSource.data).toEqual(mockProjects);
  });

  it('should apply search filters', () => {
    fixture.detectChanges();

    const searchForm = component.searchForm;
    searchForm.patchValue({
      search: 'Alpha',
      isActive: true,
      minCostPerKm: 0.4,
      maxCostPerKm: 0.6,
    });

    // Trigger filter application manually since debounce won't work in sync tests
    component['applyFilters']();

    const expectedFilters: ProjectSearchFilters = {
      search: 'Alpha',
      isActive: true,
      minCostPerKm: 0.4,
      maxCostPerKm: 0.6,
    };

    expect(mockProjectService.getProjects).toHaveBeenCalledWith(expectedFilters);
  });

  it('should clear all filters', () => {
    fixture.detectChanges();

    // Set some filter values
    component.searchForm.patchValue({
      search: 'test',
      isActive: true,
      minCostPerKm: 1.0,
      maxCostPerKm: 2.0,
    });

    component.clearFilters();

    expect(component.searchForm.get('search')?.value).toBe('');
    expect(component.searchForm.get('isActive')?.value).toBeNull();
    expect(component.searchForm.get('minCostPerKm')?.value).toBeNull();
    expect(component.searchForm.get('maxCostPerKm')?.value).toBeNull();
  });

  it('should open create project dialog', fakeAsync(() => {
    const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRefSpy.afterClosed.and.returnValue(of(true));
    mockDialog.open.and.returnValue(dialogRefSpy);
    // openDialogs array already set in spy creation

    fixture.detectChanges();
    component.createProject();
    tick(); // Wait for async operations to complete
    flush(); // Clear any remaining timers

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockSnackBar.open).toHaveBeenCalledWith('Project created successfully', 'Close', {
      duration: 3000,
    });
  }));

  it('should open edit project dialog', fakeAsync(() => {
    const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRefSpy.afterClosed.and.returnValue(of(true));
    mockDialog.open.and.returnValue(dialogRefSpy);
    // openDialogs array already set in spy creation

    fixture.detectChanges();
    component.editProject(mockProjects[0]);
    tick(); // Wait for async operations to complete
    flush(); // Clear any remaining timers

    expect(mockDialog.open).toHaveBeenCalledWith(
      jasmine.any(Function),
      jasmine.objectContaining({
        width: '600px',
        data: { title: 'Edit Project', project: mockProjects[0] },
      })
    );
    expect(mockSnackBar.open).toHaveBeenCalledWith('Project updated successfully', 'Close', {
      duration: 3000,
    });
  }));

  it('should toggle project status with confirmation', fakeAsync(() => {
    const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRefSpy.afterClosed.and.returnValue(of(true));
    mockDialog.open.and.returnValue(dialogRefSpy);
    // openDialogs array already set in spy creation
    mockProjectService.toggleProjectStatus.and.returnValue(of(mockProjects[0]));

    fixture.detectChanges();
    component.toggleProjectStatus(mockProjects[1]); // inactive project
    tick(); // Wait for async operations to complete
    flush(); // Clear any remaining timers

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockProjectService.toggleProjectStatus).toHaveBeenCalledWith('2');
    expect(mockSnackBar.open).toHaveBeenCalledWith('Project activated successfully', 'Close', {
      duration: 3000,
    });
  }));

  it('should check project references before deletion', fakeAsync(() => {
    mockProjectService.checkProjectReferences.and.returnValue(
      of({ canDelete: true, referencesCount: 0 })
    );
    const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRefSpy.afterClosed.and.returnValue(of(true));
    mockDialog.open.and.returnValue(dialogRefSpy);
    // openDialogs array already set in spy creation
    mockProjectService.deleteProject.and.returnValue(of(void 0));

    fixture.detectChanges();
    component.deleteProject(mockProjects[0]);
    tick(); // Wait for async operations to complete
    flush(); // Clear any remaining timers

    expect(mockProjectService.checkProjectReferences).toHaveBeenCalledWith('1');
    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockProjectService.deleteProject).toHaveBeenCalledWith('1');
    expect(mockSnackBar.open).toHaveBeenCalledWith('Project deleted successfully', 'Close', {
      duration: 3000,
    });
  }));

  it('should prevent deletion of referenced projects', fakeAsync(() => {
    mockProjectService.checkProjectReferences.and.returnValue(
      of({ canDelete: false, referencesCount: 3 })
    );

    fixture.detectChanges();
    component.deleteProject(mockProjects[0]);
    tick(); // Wait for async operations to complete
    flush(); // Clear any remaining timers

    expect(mockProjectService.checkProjectReferences).toHaveBeenCalledWith('1');
    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Cannot delete project. It is referenced by 3 travel request(s).',
      'Close',
      { duration: 5000 }
    );
  }));

  it('should handle load projects error', fakeAsync(() => {
    // Reset the mock to return error BEFORE component initialization
    mockProjectService.getProjects.and.returnValue(throwError(() => new Error('Load failed')));

    // Create a new component instance for this specific error test
    fixture = TestBed.createComponent(ProjectsListComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    tick(); // Wait for async operations to complete
    flush(); // Clear any remaining timers

    expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to load projects', 'Close', {
      duration: 3000,
    });
    expect(mockLoadingService.setLoading).toHaveBeenCalledWith(false);
  }));

  it('should format currency correctly', () => {
    mockProjectService.formatCHF.and.returnValue('CHF 1.25');

    const result = component.formatCurrency(1.25);

    expect(result).toBe('CHF 1.25');
    expect(mockProjectService.formatCHF).toHaveBeenCalledWith(1.25);
  });

  it('should ignore empty search values in filters', () => {
    fixture.detectChanges();

    component.searchForm.patchValue({
      search: '   ', // whitespace only
      isActive: null,
      minCostPerKm: null,
      maxCostPerKm: -1, // negative value
    });

    component['applyFilters']();

    // Should call with empty filters object since all values are invalid/empty
    expect(mockProjectService.getProjects).toHaveBeenCalledWith({});
  });
});
