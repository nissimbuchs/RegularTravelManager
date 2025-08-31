import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { Project, ProjectCreateRequest, ProjectUpdateRequest } from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';

export interface ProjectFormDialogData {
  title: string;
  project: Project | null;
}

@Component({
  selector: 'app-project-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressBarModule
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-progress-bar *ngIf="isLoading" mode="indeterminate"></mat-progress-bar>

    <mat-dialog-content>
      <form [formGroup]="projectForm" class="project-form">
        
        <mat-form-field appearance="outline">
          <mat-label>Project Name</mat-label>
          <input matInput formControlName="name" placeholder="Enter project name" maxlength="255">
          <mat-hint>Unique name for the project</mat-hint>
          <mat-error *ngIf="projectForm.get('name')?.hasError('required')">
            Project name is required
          </mat-error>
          <mat-error *ngIf="projectForm.get('name')?.hasError('maxlength')">
            Project name cannot exceed 255 characters
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" 
                    placeholder="Enter project description (optional)"
                    rows="3" maxlength="1000">
          </textarea>
          <mat-hint>Optional description of the project</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Default Cost per Kilometer (CHF)</mat-label>
          <input matInput type="number" formControlName="defaultCostPerKm" 
                 placeholder="0.00" step="0.01" min="0.01" max="999.99">
          <span matPrefix>CHF&nbsp;</span>
          <mat-hint>Default rate applied to all subprojects</mat-hint>
          <mat-error *ngIf="projectForm.get('defaultCostPerKm')?.hasError('required')">
            Cost per kilometer is required
          </mat-error>
          <mat-error *ngIf="projectForm.get('defaultCostPerKm')?.hasError('min')">
            Cost must be greater than 0
          </mat-error>
          <mat-error *ngIf="projectForm.get('defaultCostPerKm')?.hasError('max')">
            Cost cannot exceed CHF 999.99
          </mat-error>
          <mat-error *ngIf="projectForm.get('defaultCostPerKm')?.hasError('pattern')">
            Please enter a valid decimal number (max 2 decimal places)
          </mat-error>
        </mat-form-field>

        <div class="status-toggle">
          <mat-slide-toggle formControlName="isActive">
            <span class="toggle-label">
              <mat-icon [color]="projectForm.get('isActive')?.value ? 'primary' : 'warn'">
                {{ projectForm.get('isActive')?.value ? 'toggle_on' : 'toggle_off' }}
              </mat-icon>
              {{ projectForm.get('isActive')?.value ? 'Active' : 'Inactive' }}
            </span>
          </mat-slide-toggle>
          <p class="status-hint">
            {{ projectForm.get('isActive')?.value 
               ? 'Project is available for new travel requests' 
               : 'Project is hidden from new travel requests' }}
          </p>
        </div>

        <div *ngIf="isEditMode" class="form-section">
          <h4>Preview</h4>
          <div class="cost-preview">
            <strong>Formatted Cost: </strong>
            <span class="cost-display">
              {{ formatCostPreview() }}
            </span>
          </div>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="isLoading">Cancel</button>
      <button mat-raised-button color="primary" 
              (click)="onSubmit()" 
              [disabled]="projectForm.invalid || isLoading">
        <mat-icon *ngIf="isLoading">hourglass_empty</mat-icon>
        <mat-icon *ngIf="!isLoading">{{ isEditMode ? 'save' : 'add' }}</mat-icon>
        {{ isLoading ? 'Saving...' : (isEditMode ? 'Update' : 'Create') }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .dialog-header h2 {
      margin: 0;
    }

    .project-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 500px;
    }

    .status-toggle {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .status-hint {
      margin: 0;
      font-size: 0.875rem;
      color: rgba(0, 0, 0, 0.6);
    }

    .form-section {
      margin-top: 16px;
      padding: 16px;
      background-color: #f9f9f9;
      border-radius: 8px;
    }

    .form-section h4 {
      margin: 0 0 12px 0;
      color: rgba(0, 0, 0, 0.87);
    }

    .cost-preview {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cost-display {
      font-family: 'Roboto Mono', monospace;
      font-size: 1.1rem;
      color: #2e7d32;
      font-weight: 500;
      padding: 4px 8px;
      background-color: #e8f5e8;
      border-radius: 4px;
    }

    mat-dialog-content {
      max-height: 70vh;
      overflow-y: auto;
    }

    mat-dialog-actions {
      padding: 16px 0;
      gap: 8px;
    }
  `]
})
export class ProjectFormDialogComponent implements OnInit {
  projectForm: FormGroup;
  isLoading = false;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private dialogRef: MatDialogRef<ProjectFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectFormDialogData
  ) {
    this.isEditMode = !!data.project;
    this.projectForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.project) {
      this.projectForm.patchValue({
        name: this.data.project.name,
        description: this.data.project.description || '',
        defaultCostPerKm: this.data.project.defaultCostPerKm,
        isActive: this.data.project.isActive
      });
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [
        Validators.required, 
        Validators.maxLength(255),
        Validators.pattern(/^[a-zA-Z0-9\s\-_().]+$/) // Alphanumeric plus common symbols
      ]],
      description: ['', [Validators.maxLength(1000)]],
      defaultCostPerKm: ['', [
        Validators.required,
        Validators.min(0.01),
        Validators.max(999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/) // Decimal with max 2 places
      ]],
      isActive: [true]
    });
  }

  onSubmit(): void {
    if (this.projectForm.valid) {
      this.isLoading = true;
      const formValue = this.projectForm.value;

      const projectData = {
        name: formValue.name.trim(),
        description: formValue.description?.trim() || undefined,
        defaultCostPerKm: parseFloat(formValue.defaultCostPerKm),
        isActive: formValue.isActive
      };

      const operation = this.isEditMode
        ? this.projectService.updateProject(this.data.project!.id, projectData as ProjectUpdateRequest)
        : this.projectService.createProject(projectData as ProjectCreateRequest);

      operation.subscribe({
        next: (result) => {
          this.isLoading = false;
          this.dialogRef.close(result);
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Project operation failed:', error);
          
          // Handle specific error cases
          if (error.status === 409) {
            this.projectForm.get('name')?.setErrors({ duplicate: true });
          } else if (error.status === 400) {
            // Handle validation errors from backend
            const validationErrors = error.error?.validation;
            if (validationErrors) {
              Object.keys(validationErrors).forEach(field => {
                const control = this.projectForm.get(field);
                if (control) {
                  control.setErrors({ serverValidation: validationErrors[field] });
                }
              });
            }
          }
        }
      });
    }
  }

  formatCostPreview(): string {
    const cost = this.projectForm.get('defaultCostPerKm')?.value;
    if (cost && this.projectService.validateCostRate(parseFloat(cost))) {
      return this.projectService.formatCHF(parseFloat(cost));
    }
    return 'CHF 0.00';
  }

  // Custom validation methods
  private validateCostRate(control: any): {[key: string]: any} | null {
    const value = control.value;
    if (value !== null && !this.projectService.validateCostRate(value)) {
      return { invalidCostRate: true };
    }
    return null;
  }
}