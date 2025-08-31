import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { 
  TravelRequestFormData, 
  CalculationPreview, 
  ProjectDto, 
  SubprojectDto 
} from '@rtm/shared';
import { TravelRequestService } from '../services/travel-request.service';
import { ConfirmationDialogComponent, ConfirmationData } from './confirmation-dialog.component';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { EMPTY, Observable } from 'rxjs';

@Component({
  selector: 'app-travel-request-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './travel-request-form.component.html',
  styleUrls: ['./travel-request-form.component.css']
})
export class TravelRequestFormComponent implements OnInit, OnDestroy {
  requestForm: FormGroup;
  projects: ProjectDto[] = [];
  subprojects: SubprojectDto[] = [];
  calculationPreview: CalculationPreview | null = null;
  isCalculating = false;
  isSubmitting = false;
  private draftKey = 'travel-request-draft';
  private autoSaveTimer: any;

  constructor(
    private fb: FormBuilder,
    private travelRequestService: TravelRequestService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.requestForm = this.fb.group({
      projectId: ['', [Validators.required]],
      subProjectId: ['', [Validators.required]],
      managerName: ['', [Validators.required, Validators.minLength(2)]],
      daysPerWeek: [1, [Validators.required, Validators.min(1), Validators.max(7)]],
      justification: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]]
    });
  }

  ngOnInit(): void {
    this.loadProjects();
    this.loadDraft();
    this.setupFormSubscriptions();
    this.setupAutoSave();
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
  }

  private loadProjects(): void {
    this.travelRequestService.getActiveProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
      },
      error: (error) => {
        console.error('Failed to load projects:', error);
      }
    });
  }

  private setupFormSubscriptions(): void {
    // Load subprojects when project changes
    this.requestForm.get('projectId')?.valueChanges.subscribe(projectId => {
      this.subprojects = [];
      this.calculationPreview = null;
      this.requestForm.get('subProjectId')?.setValue('');
      
      if (projectId) {
        this.loadSubprojects(projectId);
      }
    });

    // Trigger calculation when form changes
    this.requestForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.isCalculating = true),
        switchMap(() => this.calculatePreview())
      )
      .subscribe({
        next: (preview) => {
          this.calculationPreview = preview;
          this.isCalculating = false;
        },
        error: (error) => {
          console.error('Calculation failed:', error);
          this.calculationPreview = null;
          this.isCalculating = false;
        }
      });
  }

  private loadSubprojects(projectId: string): void {
    this.travelRequestService.getActiveSubprojects(projectId).subscribe({
      next: (subprojects) => {
        this.subprojects = subprojects;
      },
      error: (error) => {
        console.error('Failed to load subprojects:', error);
      }
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

      this.travelRequestService.submitRequest(formData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.clearDraft(); // Clear draft on successful submission
          this.showConfirmationDialog(response.requestId, formData);
        },
        error: (error) => {
          console.error('Failed to submit request:', error);
          this.isSubmitting = false;
          this.snackBar.open(
            'Failed to submit request. Please try again.',
            'Close',
            { duration: 5000, horizontalPosition: 'center', verticalPosition: 'top' }
          );
        }
      });
    }
  }

  private showConfirmationDialog(requestId: string, formData: TravelRequestFormData): void {
    const selectedProject = this.projects.find(p => p.id === formData.projectId);
    const selectedSubproject = this.subprojects.find(s => s.id === formData.subProjectId);

    const confirmationData: ConfirmationData = {
      requestId,
      calculationPreview: this.calculationPreview!,
      projectName: selectedProject?.name || 'Unknown Project',
      subprojectName: selectedSubproject?.name || 'Unknown Subproject',
      managerName: formData.managerName,
      daysPerWeek: formData.daysPerWeek,
      justification: formData.justification
    };

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      data: confirmationData,
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'create-new') {
        this.resetForm();
      } else if (result === 'view-requests') {
        // Navigate to requests dashboard (to be implemented in future story)
        this.snackBar.open('Requests dashboard coming soon!', 'Close', { duration: 3000 });
      }
    });
  }

  private resetForm(): void {
    this.requestForm.reset({
      daysPerWeek: 1
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
        timestamp: new Date().toISOString()
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
          this.snackBar.open('Draft restored', 'Clear Draft', { 
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }).onAction().subscribe(() => {
            this.clearDraft();
          });
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
        this.clearDraft();
      }
    }
  }

  private clearDraft(): void {
    localStorage.removeItem(this.draftKey);
  }

  private hasFormData(formValue: any): boolean {
    return formValue.projectId || 
           formValue.subProjectId || 
           formValue.managerName || 
           formValue.justification ||
           formValue.daysPerWeek !== 1;
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