import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import {
  Project,
  Subproject,
  SubprojectCreateRequest,
  SubprojectUpdateRequest,
  GeocodingResult,
} from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';
import { TranslationService } from '../../../core/services/translation.service';

export interface SubprojectFormDialogData {
  title: string;
  project: Project;
  subproject: Subproject | null;
}

@Component({
  selector: 'app-subproject-form-dialog',
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
    MatChipsModule,
    MatTooltipModule,
    MatCardModule,
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
      <form [formGroup]="subprojectForm" class="subproject-form">
        <!-- Basic Information -->
        <div class="form-section">
          <h4>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.sections.location_details') }}</h4>

          <mat-form-field appearance="outline">
            <mat-label>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.fields.location_name') }}</mat-label>
            <input
              matInput
              formControlName="name"
              [placeholder]="translationService.translateSync('admin.projects.dialogs.subproject_form.placeholders.location_name')"
              maxlength="255"
            />
            <mat-hint>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.hints.location_name') }}</mat-hint>
            <mat-error *ngIf="subprojectForm.get('name')?.hasError('required')">
              {{ translationService.translateSync('admin.projects.dialogs.subproject_form.errors.location_name_required') }}
            </mat-error>
          </mat-form-field>

          <div class="status-toggle">
            <mat-slide-toggle formControlName="isActive">
              <span class="toggle-label">
                <mat-icon [color]="subprojectForm.get('isActive')?.value ? 'primary' : 'warn'">
                  {{ subprojectForm.get('isActive')?.value ? 'toggle_on' : 'toggle_off' }}
                </mat-icon>
                {{ subprojectForm.get('isActive')?.value ? translationService.translateSync('common.status.active') : translationService.translateSync('common.status.inactive') }}
              </span>
            </mat-slide-toggle>
          </div>
        </div>

        <!-- Address Information -->
        <div class="form-section">
          <h4>
            <mat-icon>place</mat-icon>
            {{ translationService.translateSync('admin.projects.dialogs.subproject_form.sections.address_information') }}
            <mat-chip *ngIf="geocodingStatus === 'success'" color="accent">
              <mat-icon>check_circle</mat-icon>
              {{ translationService.translateSync('admin.projects.dialogs.subproject_form.status.geocoded') }}
            </mat-chip>
            <mat-chip *ngIf="geocodingStatus === 'error'" color="warn">
              <mat-icon>error</mat-icon>
              {{ translationService.translateSync('admin.projects.dialogs.subproject_form.status.geocoding_failed') }}
            </mat-chip>
          </h4>

          <mat-form-field appearance="outline">
            <mat-label>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.fields.street_address') }}</mat-label>
            <input
              matInput
              formControlName="streetAddress"
              [placeholder]="translationService.translateSync('admin.projects.dialogs.subproject_form.placeholders.street_address')"
              maxlength="255"
            />
            <mat-hint>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.hints.street_address') }}</mat-hint>
          </mat-form-field>

          <div class="address-row">
            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.fields.city') }}</mat-label>
              <input matInput formControlName="city" [placeholder]="translationService.translateSync('admin.projects.dialogs.subproject_form.placeholders.city')" maxlength="100" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.fields.postal_code') }}</mat-label>
              <input
                matInput
                formControlName="postalCode"
                [placeholder]="translationService.translateSync('admin.projects.dialogs.subproject_form.placeholders.postal_code')"
                maxlength="20"
                pattern="[0-9]{4,5}"
              />
              <mat-error *ngIf="subprojectForm.get('postalCode')?.hasError('pattern')">
                {{ translationService.translateSync('admin.projects.dialogs.subproject_form.errors.postal_code_pattern') }}
              </mat-error>
            </mat-form-field>
          </div>

          <div class="geocoding-actions">
            <button
              type="button"
              mat-stroked-button
              (click)="geocodeAddress()"
              [disabled]="!canGeocode() || isGeocoding"
            >
              <mat-icon *ngIf="!isGeocoding">my_location</mat-icon>
              <mat-icon *ngIf="isGeocoding" class="spinning">refresh</mat-icon>
              {{ isGeocoding ? translationService.translateSync('admin.projects.dialogs.subproject_form.actions.geocoding') : translationService.translateSync('admin.projects.dialogs.subproject_form.actions.get_coordinates') }}
            </button>

            <button
              type="button"
              mat-button
              (click)="clearCoordinates()"
              [disabled]="!hasCoordinates()"
              [matTooltip]="translationService.translateSync('admin.projects.dialogs.subproject_form.tooltips.clear_coordinates')"
            >
              <mat-icon>location_off</mat-icon>
              {{ translationService.translateSync('admin.projects.dialogs.subproject_form.actions.clear') }}
            </button>
          </div>
        </div>

        <!-- Coordinates Display/Manual Entry -->
        <div class="form-section" *ngIf="hasCoordinates() || showManualCoords">
          <h4>
            <mat-icon>my_location</mat-icon>
            {{ translationService.translateSync('admin.projects.dialogs.subproject_form.sections.coordinates') }}
            <button
              type="button"
              mat-icon-button
              (click)="toggleManualCoords()"
              [matTooltip]="translationService.translateSync('admin.projects.dialogs.subproject_form.tooltips.toggle_manual_coords')"
            >
              <mat-icon>{{ showManualCoords ? 'visibility_off' : 'edit' }}</mat-icon>
            </button>
          </h4>

          <div *ngIf="!showManualCoords && hasCoordinates()" class="coordinates-display">
            <mat-card class="coords-card">
              <div class="coords-info">
                <div class="coord-item">
                  <strong>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.fields.latitude') }}:</strong>
                  <span class="coord-value">{{ coordinates?.latitude | number: '1.6-6' }}</span>
                </div>
                <div class="coord-item">
                  <strong>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.fields.longitude') }}:</strong>
                  <span class="coord-value">{{ coordinates?.longitude | number: '1.6-6' }}</span>
                </div>
              </div>
            </mat-card>
          </div>

          <div *ngIf="showManualCoords" class="manual-coords">
            <div class="coords-row">
              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.fields.latitude') }}</mat-label>
                <input
                  matInput
                  type="number"
                  formControlName="manualLatitude"
                  [placeholder]="translationService.translateSync('admin.projects.dialogs.subproject_form.placeholders.latitude')"
                  step="0.000001"
                  min="45.818"
                  max="47.808"
                />
                <mat-hint>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.hints.latitude_range') }}</mat-hint>
                <mat-error
                  *ngIf="
                    subprojectForm.get('manualLatitude')?.hasError('min') ||
                    subprojectForm.get('manualLatitude')?.hasError('max')
                  "
                >
                  {{ translationService.translateSync('admin.projects.dialogs.subproject_form.errors.latitude_bounds') }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.fields.longitude') }}</mat-label>
                <input
                  matInput
                  type="number"
                  formControlName="manualLongitude"
                  [placeholder]="translationService.translateSync('admin.projects.dialogs.subproject_form.placeholders.longitude')"
                  step="0.000001"
                  min="5.956"
                  max="10.492"
                />
                <mat-hint>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.hints.longitude_range') }}</mat-hint>
                <mat-error
                  *ngIf="
                    subprojectForm.get('manualLongitude')?.hasError('min') ||
                    subprojectForm.get('manualLongitude')?.hasError('max')
                  "
                >
                  {{ translationService.translateSync('admin.projects.dialogs.subproject_form.errors.longitude_bounds') }}
                </mat-error>
              </mat-form-field>
            </div>

            <div class="manual-coords-actions">
              <button
                type="button"
                mat-button
                (click)="applyManualCoords()"
                [disabled]="!isValidManualCoords()"
              >
                <mat-icon>save</mat-icon>
                {{ translationService.translateSync('admin.projects.dialogs.subproject_form.actions.apply_coordinates') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Cost Rate -->
        <div class="form-section">
          <h4>
            <mat-icon>attach_money</mat-icon>
            {{ translationService.translateSync('admin.projects.dialogs.subproject_form.sections.cost_rate') }}
          </h4>

          <mat-form-field appearance="outline">
            <mat-label>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.fields.cost_per_km') }}</mat-label>
            <input
              matInput
              type="number"
              formControlName="costPerKm"
              [placeholder]="translationService.translateSync('admin.projects.dialogs.subproject_form.placeholders.cost_per_km')"
              step="0.01"
              min="0.01"
              max="999.99"
            />
            <span matPrefix>CHF&nbsp;</span>
            <mat-hint>
              {{ translationService.translateSync('admin.projects.dialogs.subproject_form.hints.cost_per_km', {
                defaultCost: formatCurrency(data.project.defaultCostPerKm)
              })
              }}
            </mat-hint>
            <mat-error *ngIf="subprojectForm.get('costPerKm')?.hasError('min')">
              {{ translationService.translateSync('admin.projects.dialogs.subproject_form.errors.cost_min') }}
            </mat-error>
            <mat-error *ngIf="subprojectForm.get('costPerKm')?.hasError('max')">
              {{ translationService.translateSync('admin.projects.dialogs.subproject_form.errors.cost_max') }}
            </mat-error>
          </mat-form-field>

          <div class="cost-preview">
            <strong>{{ translationService.translateSync('admin.projects.dialogs.subproject_form.labels.effective_rate') }}: </strong>
            <span class="cost-display">{{ getEffectiveCost() }}</span>
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
        [disabled]="subprojectForm.invalid || isLoading"
      >
        <mat-icon *ngIf="isLoading">hourglass_empty</mat-icon>
        <mat-icon *ngIf="!isLoading">{{ isEditMode ? 'save' : 'add_location' }}</mat-icon>
        {{ isLoading ? translationService.translateSync('common.actions.saving') : (isEditMode ? translationService.translateSync('common.buttons.update') : translationService.translateSync('common.buttons.create')) }}
      </button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./subproject-form-dialog.component.scss'],
})
export class SubprojectFormDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  subprojectForm: FormGroup;
  isLoading = false;
  isGeocoding = false;
  isEditMode: boolean;
  showManualCoords = false;
  geocodingStatus: 'idle' | 'success' | 'error' = 'idle';
  coordinates: { latitude: number; longitude: number } | null = null;

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    public translationService: TranslationService,
    private dialogRef: MatDialogRef<SubprojectFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SubprojectFormDialogData
  ) {
    this.isEditMode = !!data.subproject;
    this.subprojectForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.subproject) {
      const subproject = this.data.subproject;
      this.subprojectForm.patchValue({
        name: subproject.name,
        streetAddress: subproject.streetAddress || '',
        city: subproject.city || '',
        postalCode: subproject.postalCode || '',
        costPerKm: subproject.costPerKm || '',
        isActive: subproject.isActive,
      });

      if (subproject.locationCoordinates) {
        this.coordinates = {
          latitude: subproject.locationCoordinates.latitude,
          longitude: subproject.locationCoordinates.longitude,
        };
        this.geocodingStatus = 'success';
      }
    }

    // Auto-geocode when address fields change (with debounce)
    this.subprojectForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(1000),
        distinctUntilChanged(
          (prev, curr) =>
            prev.streetAddress === curr.streetAddress &&
            prev.city === curr.city &&
            prev.postalCode === curr.postalCode
        )
      )
      .subscribe(() => {
        if (this.canGeocode() && this.geocodingStatus !== 'success') {
          this.geocodeAddress();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      streetAddress: ['', [Validators.maxLength(255)]],
      city: ['', [Validators.maxLength(100)]],
      postalCode: ['', [Validators.maxLength(20), Validators.pattern(/^\d{4,5}$/)]],
      costPerKm: ['', [Validators.min(0.01), Validators.max(999.99)]],
      isActive: [true],
      manualLatitude: ['', [Validators.min(45.818), Validators.max(47.808)]],
      manualLongitude: ['', [Validators.min(5.956), Validators.max(10.492)]],
    });
  }

  canGeocode(): boolean {
    const form = this.subprojectForm.value;
    return !!(form.streetAddress?.trim() || (form.city?.trim() && form.postalCode?.trim()));
  }

  geocodeAddress(): void {
    if (!this.canGeocode() || this.isGeocoding) return;

    const form = this.subprojectForm.value;
    // Format address for AWS Location Service: "Street, PostalCode City, Country"
    // AWS Location Service expects postal code before city without comma separation
    const addressParts = [
      form.streetAddress?.trim(),
      form.postalCode?.trim() && form.city?.trim()
        ? `${form.postalCode.trim()} ${form.city.trim()}`
        : form.city?.trim() || form.postalCode?.trim(),
      'Switzerland',
    ].filter(Boolean);

    const fullAddress = addressParts.join(', ');

    this.isGeocoding = true;
    this.geocodingStatus = 'idle';

    this.projectService
      .geocodeAddress(fullAddress)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: GeocodingResult) => {
          this.coordinates = {
            latitude: result.latitude,
            longitude: result.longitude,
          };
          this.geocodingStatus = 'success';
          this.isGeocoding = false;
        },
        error: error => {
          console.error('Geocoding failed:', error);
          this.geocodingStatus = 'error';
          this.isGeocoding = false;
        },
      });
  }

  clearCoordinates(): void {
    this.coordinates = null;
    this.geocodingStatus = 'idle';
    this.subprojectForm.patchValue({
      manualLatitude: '',
      manualLongitude: '',
    });
  }

  hasCoordinates(): boolean {
    return !!this.coordinates;
  }

  toggleManualCoords(): void {
    this.showManualCoords = !this.showManualCoords;
    if (this.showManualCoords && this.coordinates) {
      this.subprojectForm.patchValue({
        manualLatitude: this.coordinates.latitude,
        manualLongitude: this.coordinates.longitude,
      });
    }
  }

  isValidManualCoords(): boolean {
    const lat = this.subprojectForm.get('manualLatitude')?.value;
    const lng = this.subprojectForm.get('manualLongitude')?.value;
    return !!(
      lat &&
      lng &&
      !this.subprojectForm.get('manualLatitude')?.errors &&
      !this.subprojectForm.get('manualLongitude')?.errors
    );
  }

  applyManualCoords(): void {
    if (this.isValidManualCoords()) {
      this.coordinates = {
        latitude: parseFloat(this.subprojectForm.get('manualLatitude')?.value),
        longitude: parseFloat(this.subprojectForm.get('manualLongitude')?.value),
      };
      this.geocodingStatus = 'success';
      this.showManualCoords = false;
    }
  }

  getEffectiveCost(): string {
    const customCost = this.subprojectForm.get('costPerKm')?.value;
    const effectiveCost = customCost || this.data.project.defaultCostPerKm;
    return this.formatCurrency(effectiveCost);
  }

  formatCurrency(amount: number): string {
    return this.projectService.formatCHF(amount);
  }

  onSubmit(): void {
    if (this.subprojectForm.valid) {
      this.isLoading = true;
      const formValue = this.subprojectForm.value;

      const subprojectData: SubprojectCreateRequest | SubprojectUpdateRequest = {
        name: formValue.name.trim(),
        streetAddress: formValue.streetAddress?.trim() || undefined,
        city: formValue.city?.trim() || undefined,
        postalCode: formValue.postalCode?.trim() || undefined,
        costPerKm: formValue.costPerKm ? parseFloat(formValue.costPerKm) : undefined,
        isActive: formValue.isActive,
      };

      // Add project ID for creation
      if (!this.isEditMode) {
        (subprojectData as SubprojectCreateRequest).projectId = this.data.project.id;
      }

      const operation = this.isEditMode
        ? this.projectService.updateSubproject(
            this.data.project.id,
            this.data.subproject!.id,
            subprojectData as SubprojectUpdateRequest
          )
        : this.projectService.createSubproject(subprojectData as SubprojectCreateRequest);

      operation.subscribe({
        next: result => {
          this.isLoading = false;
          this.dialogRef.close(result);
        },
        error: error => {
          this.isLoading = false;
          console.error('Subproject operation failed:', error);

          // Handle specific validation errors
          if (error.status === 400 && error.error?.validation) {
            const validationErrors = error.error.validation;
            Object.keys(validationErrors).forEach(field => {
              const control = this.subprojectForm.get(field);
              if (control) {
                control.setErrors({ serverValidation: validationErrors[field] });
              }
            });
          }
        },
      });
    }
  }
}
