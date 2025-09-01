import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { TravelRequestFormComponent } from '../travel-request-form.component';
import { TravelRequestService } from '../../services/travel-request.service';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('TravelRequestFormComponent', () => {
  let component: TravelRequestFormComponent;
  let fixture: ComponentFixture<TravelRequestFormComponent>;
  let mockTravelRequestService: jasmine.SpyObj<TravelRequestService>;
  let mockDialog: jasmine.SpyObj<MatDialog>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    const travelRequestServiceSpy = jasmine.createSpyObj('TravelRequestService', [
      'getActiveProjects',
      'getActiveSubprojects',
      'calculatePreview',
      'submitRequest',
    ]);
    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    const snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [TravelRequestFormComponent, ReactiveFormsModule, BrowserAnimationsModule],
      providers: [
        FormBuilder,
        { provide: TravelRequestService, useValue: travelRequestServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TravelRequestFormComponent);
    component = fixture.componentInstance;
    mockTravelRequestService = TestBed.inject(
      TravelRequestService
    ) as jasmine.SpyObj<TravelRequestService>;
    mockDialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    mockSnackBar = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;

    // Setup default mocks
    mockTravelRequestService.getActiveProjects.and.returnValue(of([]));
    mockTravelRequestService.getActiveSubprojects.and.returnValue(of([]));
    mockTravelRequestService.calculatePreview.and.returnValue(
      of({
        distance: 45.25,
        dailyAllowance: 30.75,
        weeklyAllowance: 153.75,
      })
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with correct validators', () => {
    component.ngOnInit();

    const form = component.requestForm;
    expect(form.get('projectId')?.hasError('required')).toBe(true);
    expect(form.get('subProjectId')?.hasError('required')).toBe(true);
    expect(form.get('managerId')?.hasError('required')).toBe(true);
    expect(form.get('daysPerWeek')?.value).toBe(1);
    expect(form.get('justification')?.hasError('required')).toBe(true);
  });

  it('should validate days per week range', () => {
    component.ngOnInit();
    const daysPerWeekControl = component.requestForm.get('daysPerWeek');

    daysPerWeekControl?.setValue(0);
    expect(daysPerWeekControl?.hasError('min')).toBe(true);

    daysPerWeekControl?.setValue(8);
    expect(daysPerWeekControl?.hasError('max')).toBe(true);

    daysPerWeekControl?.setValue(5);
    expect(daysPerWeekControl?.valid).toBe(true);
  });

  it('should validate justification length', () => {
    component.ngOnInit();
    const justificationControl = component.requestForm.get('justification');

    justificationControl?.setValue('Short');
    expect(justificationControl?.hasError('minlength')).toBe(true);

    justificationControl?.setValue('A'.repeat(501));
    expect(justificationControl?.hasError('maxlength')).toBe(true);

    justificationControl?.setValue('This is a valid justification text');
    expect(justificationControl?.valid).toBe(true);
  });

  it('should load projects on initialization', () => {
    const mockProjects = [
      {
        id: 'proj-1',
        name: 'Test Project',
        description: 'Test Description',
        default_cost_per_km: 0.68,
        is_active: true,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
    ];

    mockTravelRequestService.getActiveProjects.and.returnValue(of(mockProjects));

    component.ngOnInit();

    expect(mockTravelRequestService.getActiveProjects).toHaveBeenCalled();
    expect(component.projects).toEqual(mockProjects);
  });

  it('should load subprojects when project is selected', () => {
    const mockSubprojects = [
      {
        id: 'subproj-1',
        project_id: 'proj-1',
        name: 'Test Subproject',
        location_city: 'Zurich',
        is_active: true,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
    ];

    mockTravelRequestService.getActiveSubprojects.and.returnValue(of(mockSubprojects));

    component.ngOnInit();
    component.requestForm.get('projectId')?.setValue('proj-1');

    expect(mockTravelRequestService.getActiveSubprojects).toHaveBeenCalledWith('proj-1');
    expect(component.subprojects).toEqual(mockSubprojects);
  });

  it('should calculate preview when form is valid', () => {
    component.ngOnInit();

    // Set up form with valid data
    component.requestForm.patchValue({
      projectId: 'proj-1',
      subProjectId: 'subproj-1',
      managerId: 'mgr-123',
      daysPerWeek: 5,
      justification: 'This is a test justification for the travel request',
    });

    // Trigger calculation
    component.requestForm.updateValueAndValidity();

    expect(mockTravelRequestService.calculatePreview).toHaveBeenCalledWith('subproj-1', 5);
  });

  it('should submit request when form is valid', () => {
    const mockResponse = { requestId: 'req-123' };
    mockTravelRequestService.submitRequest.and.returnValue(of(mockResponse));

    component.ngOnInit();
    component.calculationPreview = {
      distance: 45.25,
      dailyAllowance: 30.75,
      weeklyAllowance: 153.75,
    };

    // Set up valid form
    component.requestForm.patchValue({
      projectId: 'proj-1',
      subProjectId: 'subproj-1',
      managerId: 'mgr-123',
      daysPerWeek: 5,
      justification: 'This is a test justification for the travel request',
    });

    component.onSubmit();

    expect(mockTravelRequestService.submitRequest).toHaveBeenCalled();
    expect(component.isSubmitting).toBe(false);
  });

  it('should handle submission errors gracefully', () => {
    mockTravelRequestService.submitRequest.and.returnValue(throwError({ status: 500 }));
    mockSnackBar.open.and.returnValue({ onAction: () => of() } as any);

    component.ngOnInit();
    component.calculationPreview = {
      distance: 45.25,
      dailyAllowance: 30.75,
      weeklyAllowance: 153.75,
    };

    // Set up valid form
    component.requestForm.patchValue({
      projectId: 'proj-1',
      subProjectId: 'subproj-1',
      managerId: 'mgr-123',
      daysPerWeek: 5,
      justification: 'This is a test justification for the travel request',
    });

    component.onSubmit();

    expect(component.isSubmitting).toBe(false);
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Unable to submit your travel request. Our system is temporarily unavailable. Please try again in a few minutes.',
      'Retry',
      jasmine.any(Object)
    );
  });

  it('should handle different types of submission errors with specific messages', () => {
    mockSnackBar.open.and.returnValue({ onAction: () => of() } as any);

    component.ngOnInit();
    component.calculationPreview = {
      distance: 45.25,
      dailyAllowance: 30.75,
      weeklyAllowance: 153.75,
    };

    // Set up valid form
    component.requestForm.patchValue({
      projectId: 'proj-1',
      subProjectId: 'subproj-1',
      managerId: 'mgr-123',
      daysPerWeek: 5,
      justification: 'This is a test justification for the travel request',
    });

    // Test 400 error
    mockTravelRequestService.submitRequest.and.returnValue(throwError({ status: 400 }));
    component.onSubmit();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Unable to submit your travel request. Please check your form data and try again.',
      'Close',
      jasmine.any(Object)
    );

    // Test 401 error
    mockTravelRequestService.submitRequest.and.returnValue(throwError({ status: 401 }));
    component.onSubmit();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Unable to submit your travel request. You may not have permission to submit requests. Please contact your manager.',
      'Close',
      jasmine.any(Object)
    );

    // Test 409 error
    mockTravelRequestService.submitRequest.and.returnValue(throwError({ status: 409 }));
    component.onSubmit();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Unable to submit your travel request. A similar request may already exist. Please check your pending requests.',
      'Close',
      jasmine.any(Object)
    );
  });

  it('should count justification characters correctly', () => {
    component.ngOnInit();

    expect(component.justificationCharCount).toBe(0);

    component.requestForm.get('justification')?.setValue('Test text');
    expect(component.justificationCharCount).toBe(9);
  });

  it('should validate form correctly', () => {
    component.ngOnInit();

    expect(component.isFormValid).toBe(false);

    component.requestForm.patchValue({
      projectId: 'proj-1',
      subProjectId: 'subproj-1',
      managerId: 'mgr-123',
      daysPerWeek: 5,
      justification: 'This is a test justification for the travel request',
    });

    expect(component.isFormValid).toBe(true);
  });

  it('should save and load draft correctly', () => {
    const draftData = {
      projectId: 'proj-1',
      managerId: 'mgr-456',
      daysPerWeek: 3,
      justification: 'Draft justification',
      timestamp: new Date().toISOString(),
    };

    // Mock localStorage
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify(draftData));
    spyOn(localStorage, 'setItem');
    spyOn(localStorage, 'removeItem');
    mockSnackBar.open.and.returnValue({ onAction: () => of() } as any);

    component.ngOnInit();

    expect(localStorage.getItem).toHaveBeenCalledWith('travel-request-draft');
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Draft restored',
      'Clear Draft',
      jasmine.any(Object)
    );
  });

  describe('Integration Tests - Debounced Calculation Preview', () => {
    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should debounce calculation preview updates with 300ms delay', () => {
      component.ngOnInit();

      // Set up initial form state
      component.requestForm.patchValue({
        projectId: 'proj-1',
        subProjectId: 'subproj-1',
        daysPerWeek: 3,
      });

      // Rapid form changes should not trigger multiple calculations
      component.requestForm.get('daysPerWeek')?.setValue(4);
      component.requestForm.get('daysPerWeek')?.setValue(5);
      component.requestForm.get('justification')?.setValue('Test justification');

      expect(component.isCalculating).toBe(true);
      expect(mockTravelRequestService.calculatePreview).not.toHaveBeenCalled();

      // Advance time by 299ms - should not trigger calculation yet
      jasmine.clock().tick(299);
      expect(mockTravelRequestService.calculatePreview).not.toHaveBeenCalled();

      // Advance time by 1ms more (total 300ms) - should trigger calculation
      jasmine.clock().tick(1);
      expect(mockTravelRequestService.calculatePreview).toHaveBeenCalledWith('subproj-1', 5);
    });

    it('should restart debounce timer on subsequent form changes', () => {
      component.ngOnInit();

      component.requestForm.patchValue({
        projectId: 'proj-1',
        subProjectId: 'subproj-1',
        daysPerWeek: 3,
      });

      // First change
      component.requestForm.get('daysPerWeek')?.setValue(4);
      jasmine.clock().tick(200);

      // Second change resets the timer
      component.requestForm.get('daysPerWeek')?.setValue(5);
      jasmine.clock().tick(200); // Total 400ms from first change, but only 200ms from second

      expect(mockTravelRequestService.calculatePreview).not.toHaveBeenCalled();

      // Complete the debounce period from the second change
      jasmine.clock().tick(100); // Now 300ms from second change
      expect(mockTravelRequestService.calculatePreview).toHaveBeenCalledWith('subproj-1', 5);
    });

    it('should handle calculation errors gracefully during debounced updates', () => {
      mockTravelRequestService.calculatePreview.and.returnValue(
        throwError('Calculation service error')
      );

      component.ngOnInit();

      component.requestForm.patchValue({
        projectId: 'proj-1',
        subProjectId: 'subproj-1',
        daysPerWeek: 5,
        justification: 'Test justification',
      });

      jasmine.clock().tick(300);

      expect(component.isCalculating).toBe(false);
      expect(component.calculationPreview).toBeNull();
    });

    it('should not trigger calculation if required fields are missing', () => {
      component.ngOnInit();

      // Missing subProjectId
      component.requestForm.patchValue({
        projectId: 'proj-1',
        daysPerWeek: 5,
        justification: 'Test justification',
      });

      jasmine.clock().tick(300);
      expect(mockTravelRequestService.calculatePreview).not.toHaveBeenCalled();

      // Missing daysPerWeek
      component.requestForm.patchValue({
        projectId: 'proj-1',
        subProjectId: 'subproj-1',
        justification: 'Test justification',
      });
      component.requestForm.get('daysPerWeek')?.setValue(null);

      jasmine.clock().tick(300);
      expect(mockTravelRequestService.calculatePreview).not.toHaveBeenCalled();
    });

    it('should update calculation preview state correctly during debounced flow', () => {
      const mockCalculation = {
        distance: 42.5,
        dailyAllowance: 25.5,
        weeklyAllowance: 127.5,
      };

      mockTravelRequestService.calculatePreview.and.returnValue(of(mockCalculation));

      component.ngOnInit();

      expect(component.isCalculating).toBe(false);
      expect(component.calculationPreview).toBeNull();

      component.requestForm.patchValue({
        projectId: 'proj-1',
        subProjectId: 'subproj-1',
        daysPerWeek: 5,
        justification: 'Test justification',
      });

      // During debounce period
      expect(component.isCalculating).toBe(true);
      expect(component.calculationPreview).toBeNull();

      jasmine.clock().tick(300);

      // After calculation completes
      expect(component.isCalculating).toBe(false);
      expect(component.calculationPreview).toEqual(mockCalculation);
    });
  });

  describe('Integration Tests - Project and Subproject Loading Chain', () => {
    it('should load subprojects when project selection changes', () => {
      const mockSubprojects = [
        {
          id: 'sub-1',
          project_id: 'proj-1',
          name: 'Subproject 1',
          is_active: true,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ];

      mockTravelRequestService.getActiveSubprojects.and.returnValue(of(mockSubprojects));

      component.ngOnInit();

      // Initially no subprojects
      expect(component.subprojects).toEqual([]);
      expect(component.requestForm.get('subProjectId')?.value).toBe('');

      // Select a project
      component.requestForm.get('projectId')?.setValue('proj-1');

      expect(mockTravelRequestService.getActiveSubprojects).toHaveBeenCalledWith('proj-1');
      expect(component.subprojects).toEqual(mockSubprojects);
    });

    it('should clear subproject selection when project changes', () => {
      component.ngOnInit();

      // Set initial state
      component.requestForm.patchValue({
        projectId: 'proj-1',
        subProjectId: 'subproj-1',
      });

      expect(component.requestForm.get('subProjectId')?.value).toBe('subproj-1');

      // Change project - should clear subproject
      component.requestForm.get('projectId')?.setValue('proj-2');

      expect(component.requestForm.get('subProjectId')?.value).toBe('');
      expect(component.subprojects).toEqual([]);
      expect(component.calculationPreview).toBeNull();
    });
  });
});
