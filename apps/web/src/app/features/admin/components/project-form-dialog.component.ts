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

import {
  Project,
  ProjectCreateRequest,
  ProjectUpdateRequest,
} from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';
import { TranslationService } from '../../../core/services/translation.service';

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
    MatProgressBarModule,
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
          <mat-label>{{ translationService.translateSync('admin.projects.dialogs.form.fields.project_name') }}</mat-label>
          <input matInput formControlName="name" [placeholder]="translationService.translateSync('admin.projects.dialogs.form.placeholders.project_name')" maxlength="255" />
          <mat-hint>{{ translationService.translateSync('admin.projects.dialogs.form.hints.project_name') }}</mat-hint>
          <mat-error *ngIf="projectForm.get('name')?.hasError('required')">
            {{ translationService.translateSync('admin.projects.dialogs.form.errors.name_required') }}
          </mat-error>
          <mat-error *ngIf="projectForm.get('name')?.hasError('maxlength')">
            {{ translationService.translateSync('admin.projects.dialogs.form.errors.name_max_length') }}
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ translationService.translateSync('admin.projects.dialogs.form.fields.description') }}</mat-label>
          <textarea
            matInput
            formControlName="description"
            [placeholder]="translationService.translateSync('admin.projects.dialogs.form.placeholders.description')"
            rows="3"
            maxlength="1000"
          >
          </textarea>
          <mat-hint>{{ translationService.translateSync('admin.projects.dialogs.form.hints.description') }}</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ translationService.translateSync('admin.projects.dialogs.form.fields.default_cost') }}</mat-label>
          <input
            matInput
            type="number"
            formControlName="defaultCostPerKm"
            [placeholder]="translationService.translateSync('admin.projects.dialogs.form.placeholders.default_cost')"
            step="0.01"
            min="0.01"
            max="999.99"
          />
          <span matPrefix>CHF&nbsp;</span>
          <mat-hint>{{ translationService.translateSync('admin.projects.dialogs.form.hints.default_cost') }}</mat-hint>
          <mat-error *ngIf="projectForm.get('defaultCostPerKm')?.hasError('required')">
            {{ translationService.translateSync('admin.projects.dialogs.form.errors.cost_required') }}
          </mat-error>
          <mat-error *ngIf="projectForm.get('defaultCostPerKm')?.hasError('min')">
            {{ translationService.translateSync('admin.projects.dialogs.form.errors.cost_min') }}
          </mat-error>
          <mat-error *ngIf="projectForm.get('defaultCostPerKm')?.hasError('max')">
            {{ translationService.translateSync('admin.projects.dialogs.form.errors.cost_max') }}
          </mat-error>
          <mat-error *ngIf="projectForm.get('defaultCostPerKm')?.hasError('pattern')">
            {{ translationService.translateSync('admin.projects.dialogs.form.errors.cost_pattern') }}
          </mat-error>
        </mat-form-field>

        <div class="status-toggle">
          <mat-slide-toggle formControlName="isActive">
            <span class="toggle-label">
              <mat-icon [color]="projectForm.get('isActive')?.value ? 'primary' : 'warn'">
                {{ projectForm.get('isActive')?.value ? 'toggle_on' : 'toggle_off' }}
              </mat-icon>
              {{ projectForm.get('isActive')?.value ? translationService.translateSync('common.status.active') : translationService.translateSync('common.status.inactive') }}
            </span>
          </mat-slide-toggle>
          <p class="status-hint">
            {{
              projectForm.get('isActive')?.value
                ? translationService.translateSync('admin.projects.dialogs.form.status.active_hint')
                : translationService.translateSync('admin.projects.dialogs.form.status.inactive_hint')
            }}
          </p>
        </div>

        <div *ngIf="isEditMode" class="form-section">
          <h4>{{ translationService.translateSync('admin.projects.dialogs.form.sections.preview') }}</h4>
          <div class="cost-preview">
            <strong>{{ translationService.translateSync('admin.projects.dialogs.form.labels.formatted_cost') }}: </strong>
            <span class="cost-display">
              {{ formatCostPreview() }}
            </span>
          </div>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="isLoading">{{ translationService.translateSync('common.buttons.cancel') }}</button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSubmit()"
        [disabled]="projectForm.invalid || isLoading"
      >
        <mat-icon *ngIf="isLoading">hourglass_empty</mat-icon>
        <mat-icon *ngIf="!isLoading">{{ isEditMode ? 'save' : 'add' }}</mat-icon>
        {{ isLoading ? translationService.translateSync('common.actions.saving') : (isEditMode ? translationService.translateSync('common.buttons.update') : translationService.translateSync('common.buttons.create')) }}
      </button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./project-form-dialog.component.scss'],
})
export class ProjectFormDialogComponent implements OnInit {
  projectForm: FormGroup;
  isLoading = false;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    public translationService: TranslationService,
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
        isActive: this.data.project.isActive,
      });
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: [
        '',
        [
          Validators.required,
          Validators.maxLength(255),
          Validators.pattern(/^[a-zA-Z0-9\s\-_().]+$/), // Alphanumeric plus common symbols
        ],
      ],
      description: ['', [Validators.maxLength(1000)]],
      defaultCostPerKm: [
        '',
        [
          Validators.required,
          Validators.min(0.01),
          Validators.max(999.99),
          Validators.pattern(/^\d+(\.\d{1,2})?$/), // Decimal with max 2 places
        ],
      ],
      isActive: [true],
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
        isActive: formValue.isActive,
      };

      const operation = this.isEditMode
        ? this.projectService.updateProject(
            this.data.project!.id,
            projectData as ProjectUpdateRequest
          )
        : this.projectService.createProject(projectData as ProjectCreateRequest);

      operation.subscribe({
        next: result => {
          this.isLoading = false;
          this.dialogRef.close(result);
        },
        error: error => {
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
        },
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
  private validateCostRate(control: any): { [key: string]: any } | null {
    const value = control.value;
    if (value !== null && !this.projectService.validateCostRate(value)) {
      return { invalidCostRate: true };
    }
    return null;
  }
}
