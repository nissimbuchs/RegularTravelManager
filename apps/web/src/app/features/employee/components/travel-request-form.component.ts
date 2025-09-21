import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TravelRequestFormData, CalculationPreview } from '@rtm/shared';
import { Project, Subproject } from '../../../core/models/project.model';
import { TravelRequestService } from '../services/travel-request.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationDialogComponent, ConfirmationData } from './confirmation-dialog.component';
import { debounceTime, distinctUntilChanged, switchMap, tap, takeUntil } from 'rxjs/operators';
import { EMPTY, Observable, Subject } from 'rxjs';

interface Manager {
  id: string;
  name: string;
  employeeId: string;
}

@Component({
  selector: 'app-travel-request-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './travel-request-form.component.html',
  styleUrls: ['./travel-request-form.component.scss'],
})
export class TravelRequestFormComponent implements OnInit, OnDestroy {
  requestForm: FormGroup;
  projects: Project[] = []; // ✅ Fixed: Use Project model instead of DTO
  subprojects: Subproject[] = []; // ✅ Fixed: Use Subproject model instead of DTO
  managers: Manager[] = [];
  calculationPreview: CalculationPreview | null = null;
  isCalculating = false;
  isSubmitting = false;
  private draftKey = 'travel-request-draft';
  private autoSaveTimer: any;
  // Reference to confirmation dialog for cleanup
  private confirmationDialogRef: MatDialogRef<ConfirmationDialogComponent> | null = null;
  // Subject to cancel subscriptions on component destroy
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private travelRequestService: TravelRequestService,
    private employeeService: EmployeeService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private authService: AuthService
  ) {
    this.requestForm = this.fb.group({
      projectId: ['', [Validators.required]],
      subProjectId: ['', [Validators.required]],
      managerId: ['', [Validators.required]],
      daysPerWeek: [1, [Validators.required, Validators.min(1), Validators.max(7)]],
      justification: [
        '',
        [Validators.required, Validators.minLength(10), Validators.maxLength(500)],
      ],
    });
  }

  ngOnInit(): void {
    // Clear any problematic draft data first
    this.clearProblemDraft();

    this.setupFormSubscriptions();
    Promise.all([this.loadProjects(), this.loadManagers()])
      .then(() => {
        // Load draft after projects and managers are loaded to ensure proper validation
        this.loadDraft();
      })
      .catch(error => {
        console.error('Failed to load initial data:', error);
        // Still load draft even if projects fail
        this.loadDraft();
        this.snackBar.open(
          'Some initial data could not be loaded. The form may have limited functionality.',
          'Close',
          { duration: 6000, horizontalPosition: 'center', verticalPosition: 'top' }
        );
      });
    this.setupAutoSave();
  }

  ngOnDestroy(): void {
    // Signal all subscriptions to complete
    this.destroy$.next();
    this.destroy$.complete();

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    // Close any open confirmation dialog to prevent it from reappearing
    if (this.confirmationDialogRef) {
      this.confirmationDialogRef.close();
      this.confirmationDialogRef = null;
    }
  }

  private loadProjects(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.travelRequestService
        .getActiveProjects()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: projects => {
            this.projects = projects;
            resolve();
          },
          error: error => {
            console.error('Failed to load projects:', error);
            this.snackBar
              .open(
                'Unable to load project list. Please refresh the page or contact support.',
                'Retry',
                { duration: 8000, horizontalPosition: 'center', verticalPosition: 'top' }
              )
              .onAction()
              .pipe(takeUntil(this.destroy$))
              .subscribe(() => {
                this.loadProjects();
              });
            reject(error);
          },
        });
    });
  }

  private loadManagers(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.employeeService
        .getManagers()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: managers => {
            this.managers = managers;
            resolve();
          },
          error: error => {
            console.error('Failed to load managers:', error);
            this.snackBar.open(
              'Unable to load managers list. Please refresh the page or contact support.',
              'Close',
              { duration: 8000, horizontalPosition: 'center', verticalPosition: 'top' }
            );
            reject(error);
          },
        });
    });
  }

  private setupFormSubscriptions(): void {
    // Load subprojects when project changes
    this.requestForm
      .get('projectId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(projectId => {
        // Clear subprojects and reset subproject selection
        this.subprojects = [];
        this.calculationPreview = null;
        this.requestForm.get('subProjectId')?.setValue('', { emitEvent: false });

        if (projectId) {
          this.loadSubprojects(projectId);
        }
      });

    // Trigger calculation when form changes
    this.requestForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => (this.isCalculating = true)),
        switchMap(() => this.calculatePreview()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: preview => {
          this.calculationPreview = preview;
          this.isCalculating = false;
        },
        error: error => {
          console.error('Calculation failed:', error);
          this.calculationPreview = null;
          this.isCalculating = false;
          this.snackBar.open(
            'Could not calculate travel allowance. Please verify your selections and try again.',
            'Close',
            { duration: 5000, horizontalPosition: 'center', verticalPosition: 'top' }
          );
        },
      });
  }

  private loadSubprojects(projectId: string): void {
    this.travelRequestService
      .getActiveSubprojects(projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: subprojects => {
          this.subprojects = subprojects;
        },
        error: error => {
          console.error('Failed to load subprojects:', error);
          this.snackBar.open(
            'Could not load locations for the selected project. Please try selecting another project.',
            'Close',
            { duration: 6000, horizontalPosition: 'center', verticalPosition: 'top' }
          );
        },
      });
  }

  private calculatePreview(): Observable<CalculationPreview | null> {
    const formValue = this.requestForm.value;

    if (!formValue.subProjectId || !formValue.daysPerWeek) {
      return EMPTY;
    }

    return this.travelRequestService.calculatePreview(
      formValue.subProjectId,
      formValue.daysPerWeek
    );
  }

  onSubmit(): void {
    if (this.requestForm.valid && this.calculationPreview) {
      this.isSubmitting = true;
      const formData: TravelRequestFormData = this.requestForm.value;

      this.travelRequestService
        .submitRequest(formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: response => {
            this.isSubmitting = false;
            this.clearDraft(); // Clear draft on successful submission

            // Check if user is still authenticated before showing dialog
            this.authService
              .getCurrentUser()
              .pipe(takeUntil(this.destroy$))
              .subscribe(user => {
                if (user) {
                  this.showConfirmationDialog(response.requestId, formData);
                }
              });
          },
          error: error => {
            console.error('Failed to submit request:', error);
            this.isSubmitting = false;

            // Provide specific error messages based on error type
            let errorMessage = 'Unable to submit your travel request. ';
            let actionText = 'Close';
            const duration = 8000;

            if (error?.status === 400) {
              errorMessage += 'Please check your form data and try again.';
            } else if (error?.status === 401 || error?.status === 403) {
              errorMessage +=
                'You may not have permission to submit requests. Please contact your manager.';
            } else if (error?.status === 409) {
              errorMessage +=
                'A similar request may already exist. Please check your pending requests.';
            } else if (error?.status >= 500) {
              errorMessage +=
                'Our system is temporarily unavailable. Please try again in a few minutes.';
              actionText = 'Retry';
            } else if (!navigator.onLine) {
              errorMessage += 'Please check your internet connection and try again.';
              actionText = 'Retry';
            } else {
              errorMessage += 'Please try again or contact support if the problem persists.';
            }

            const snackBarRef = this.snackBar.open(errorMessage, actionText, {
              duration,
              horizontalPosition: 'center',
              verticalPosition: 'top',
            });

            if (actionText === 'Retry') {
              snackBarRef
                .onAction()
                .pipe(takeUntil(this.destroy$))
                .subscribe(() => {
                  this.onSubmit();
                });
            }
          },
        });
    }
  }

  onCancel(): void {
    this.clearDraft();
    this.router.navigate(['/employee']);
  }

  private showConfirmationDialog(requestId: string, formData: TravelRequestFormData): void {
    const selectedProject = this.projects.find(p => p.id === formData.projectId);
    const selectedSubproject = this.subprojects.find(s => s.id === formData.subProjectId);
    const selectedManager = this.managers.find(m => m.id === formData.managerId);

    const confirmationData: ConfirmationData = {
      requestId,
      calculationPreview: this.calculationPreview!,
      projectName: selectedProject?.name || 'Unknown Project',
      subprojectName: selectedSubproject?.name || 'Unknown Subproject',
      managerId: formData.managerId,
      managerName: selectedManager?.name || 'Unknown Manager',
      daysPerWeek: formData.daysPerWeek,
      justification: formData.justification,
    };

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      data: confirmationData,
      disableClose: false,
    });

    // Store dialog reference for cleanup
    this.confirmationDialogRef = dialogRef;

    dialogRef.afterClosed().subscribe(result => {
      // Clear the dialog reference when closed
      this.confirmationDialogRef = null;

      if (result === 'create-new') {
        this.resetForm();
      } else if (result === 'view-requests') {
        // Navigate to requests dashboard
        this.router.navigate(['/employee/dashboard']);
      } else {
        // Default: navigate back to dashboard when dialog is closed without action
        this.router.navigate(['/employee/dashboard']);
      }
    });
  }

  private resetForm(): void {
    this.requestForm.reset({
      daysPerWeek: 1,
    });
    this.subprojects = [];
    this.calculationPreview = null;
    this.clearDraft();
    this.snackBar.open('Form reset for new request', 'Close', { duration: 2000 });
  }

  private setupAutoSave(): void {
    // Auto-save every 30 seconds
    this.autoSaveTimer = setInterval(() => {
      this.saveDraft();
    }, 30000);
  }

  private saveDraft(): void {
    const formValue = this.requestForm.value;
    if (this.hasFormData(formValue)) {
      const draft = {
        ...formValue,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(this.draftKey, JSON.stringify(draft));
    }
  }

  private loadDraft(): void {
    const draftData = localStorage.getItem(this.draftKey);
    if (draftData) {
      try {
        const draft = JSON.parse(draftData);
        if (this.isDraftValid(draft)) {
          this.requestForm.patchValue(draft);

          // If draft has a project selected, load its subprojects
          if (draft.projectId) {
            this.loadSubprojects(draft.projectId);
          }

          this.snackBar
            .open('Draft restored', 'Clear Draft', {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
            })
            .onAction()
            .subscribe(() => {
              this.clearDraft();
            });
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
        this.clearDraft();
        this.snackBar.open(
          'Your saved draft could not be restored due to data corruption. Starting with a fresh form.',
          'Close',
          { duration: 4000, horizontalPosition: 'center', verticalPosition: 'top' }
        );
      }
    }
  }

  private clearDraft(): void {
    localStorage.removeItem(this.draftKey);
  }

  // Debug method to clear any problematic drafts - can be removed in production
  private clearProblemDraft(): void {
    const draftData = localStorage.getItem(this.draftKey);
    if (draftData) {
      try {
        const draft = JSON.parse(draftData);
        // Clear any draft that has subProjectId but no projectId
        if (draft.subProjectId && !draft.projectId) {
          this.clearDraft();
        }
      } catch (error) {
        this.clearDraft();
      }
    }
  }

  private hasFormData(formValue: any): boolean {
    return (
      formValue.projectId ||
      formValue.subProjectId ||
      formValue.managerId ||
      formValue.justification ||
      formValue.daysPerWeek !== 1
    );
  }

  private isDraftValid(draft: any): boolean {
    return draft && typeof draft === 'object' && draft.timestamp;
  }

  get justificationCharCount(): number {
    return this.requestForm.get('justification')?.value?.length || 0;
  }

  get isFormValid(): boolean {
    return this.requestForm.valid;
  }
}
