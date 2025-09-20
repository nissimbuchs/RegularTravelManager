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
          <h4>Location Details</h4>

          <mat-form-field appearance="outline">
            <mat-label>Location Name</mat-label>
            <input
              matInput
              formControlName="name"
              placeholder="Enter location/subproject name"
              maxlength="255"
            />
            <mat-hint>Descriptive name for this work location</mat-hint>
            <mat-error *ngIf="subprojectForm.get('name')?.hasError('required')">
              Location name is required
            </mat-error>
          </mat-form-field>

          <div class="status-toggle">
            <mat-slide-toggle formControlName="isActive">
              <span class="toggle-label">
                <mat-icon [color]="subprojectForm.get('isActive')?.value ? 'primary' : 'warn'">
                  {{ subprojectForm.get('isActive')?.value ? 'toggle_on' : 'toggle_off' }}
                </mat-icon>
                {{ subprojectForm.get('isActive')?.value ? 'Active' : 'Inactive' }}
              </span>
            </mat-slide-toggle>
          </div>
        </div>

        <!-- Address Information -->
        <div class="form-section">
          <h4>
            <mat-icon>place</mat-icon>
            Address Information
            <mat-chip *ngIf="geocodingStatus === 'success'" color="accent">
              <mat-icon>check_circle</mat-icon>
              Geocoded
            </mat-chip>
            <mat-chip *ngIf="geocodingStatus === 'error'" color="warn">
              <mat-icon>error</mat-icon>
              Geocoding Failed
            </mat-chip>
          </h4>

          <mat-form-field appearance="outline">
            <mat-label>Street Address</mat-label>
            <input
              matInput
              formControlName="locationStreet"
              placeholder="Bahnhofstrasse 1"
              maxlength="255"
            />
            <mat-hint>Full street address including number</mat-hint>
          </mat-form-field>

          <div class="address-row">
            <mat-form-field appearance="outline">
              <mat-label>City</mat-label>
              <input matInput formControlName="locationCity" placeholder="Zurich" maxlength="100" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Postal Code</mat-label>
              <input
                matInput
                formControlName="locationPostalCode"
                placeholder="8001"
                maxlength="20"
                pattern="[0-9]{4,5}"
              />
              <mat-error *ngIf="subprojectForm.get('locationPostalCode')?.hasError('pattern')">
                Please enter a valid Swiss postal code (4-5 digits)
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
              {{ isGeocoding ? 'Geocoding...' : 'Get Coordinates' }}
            </button>

            <button
              type="button"
              mat-button
              (click)="clearCoordinates()"
              [disabled]="!hasCoordinates()"
              matTooltip="Clear coordinates"
            >
              <mat-icon>location_off</mat-icon>
              Clear
            </button>
          </div>
        </div>

        <!-- Coordinates Display/Manual Entry -->
        <div class="form-section" *ngIf="hasCoordinates() || showManualCoords">
          <h4>
            <mat-icon>my_location</mat-icon>
            Coordinates
            <button
              type="button"
              mat-icon-button
              (click)="toggleManualCoords()"
              matTooltip="Toggle manual coordinate entry"
            >
              <mat-icon>{{ showManualCoords ? 'visibility_off' : 'edit' }}</mat-icon>
            </button>
          </h4>

          <div *ngIf="!showManualCoords && hasCoordinates()" class="coordinates-display">
            <mat-card class="coords-card">
              <div class="coords-info">
                <div class="coord-item">
                  <strong>Latitude:</strong>
                  <span class="coord-value">{{ coordinates?.latitude | number: '1.6-6' }}</span>
                </div>
                <div class="coord-item">
                  <strong>Longitude:</strong>
                  <span class="coord-value">{{ coordinates?.longitude | number: '1.6-6' }}</span>
                </div>
              </div>
            </mat-card>
          </div>

          <div *ngIf="showManualCoords" class="manual-coords">
            <div class="coords-row">
              <mat-form-field appearance="outline">
                <mat-label>Latitude</mat-label>
                <input
                  matInput
                  type="number"
                  formControlName="manualLatitude"
                  placeholder="47.3769"
                  step="0.000001"
                  min="45.818"
                  max="47.808"
                />
                <mat-hint>Swiss latitude range: 45.818 - 47.808</mat-hint>
                <mat-error
                  *ngIf="
                    subprojectForm.get('manualLatitude')?.hasError('min') ||
                    subprojectForm.get('manualLatitude')?.hasError('max')
                  "
                >
                  Latitude must be within Swiss boundaries
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Longitude</mat-label>
                <input
                  matInput
                  type="number"
                  formControlName="manualLongitude"
                  placeholder="8.5417"
                  step="0.000001"
                  min="5.956"
                  max="10.492"
                />
                <mat-hint>Swiss longitude range: 5.956 - 10.492</mat-hint>
                <mat-error
                  *ngIf="
                    subprojectForm.get('manualLongitude')?.hasError('min') ||
                    subprojectForm.get('manualLongitude')?.hasError('max')
                  "
                >
                  Longitude must be within Swiss boundaries
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
                Apply Coordinates
              </button>
            </div>
          </div>
        </div>

        <!-- Cost Rate -->
        <div class="form-section">
          <h4>
            <mat-icon>attach_money</mat-icon>
            Cost Rate (Optional)
          </h4>

          <mat-form-field appearance="outline">
            <mat-label>Custom Cost per Kilometer</mat-label>
            <input
              matInput
              type="number"
              formControlName="costPerKm"
              placeholder="Leave empty to inherit from project"
              step="0.01"
              min="0.01"
              max="999.99"
            />
            <span matPrefix>CHF&nbsp;</span>
            <mat-hint>
              Leave empty to use project default ({{
                formatCurrency(data.project.defaultCostPerKm)
              }})
            </mat-hint>
            <mat-error *ngIf="subprojectForm.get('costPerKm')?.hasError('min')">
              Cost must be greater than 0
            </mat-error>
            <mat-error *ngIf="subprojectForm.get('costPerKm')?.hasError('max')">
              Cost cannot exceed CHF 999.99
            </mat-error>
          </mat-form-field>

          <div class="cost-preview">
            <strong>Effective Rate: </strong>
            <span class="cost-display">{{ getEffectiveCost() }}</span>
          </div>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="isLoading">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSubmit()"
        [disabled]="subprojectForm.invalid || isLoading"
      >
        <mat-icon *ngIf="isLoading">hourglass_empty</mat-icon>
        <mat-icon *ngIf="!isLoading">{{ isEditMode ? 'save' : 'add_location' }}</mat-icon>
        {{ isLoading ? 'Saving...' : isEditMode ? 'Update' : 'Create' }}
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
        locationStreet: subproject.locationStreet || '',
        locationCity: subproject.locationCity || '',
        locationPostalCode: subproject.locationPostalCode || '',
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
            prev.locationStreet === curr.locationStreet &&
            prev.locationCity === curr.locationCity &&
            prev.locationPostalCode === curr.locationPostalCode
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
      locationStreet: ['', [Validators.maxLength(255)]],
      locationCity: ['', [Validators.maxLength(100)]],
      locationPostalCode: ['', [Validators.maxLength(20), Validators.pattern(/^\d{4,5}$/)]],
      costPerKm: ['', [Validators.min(0.01), Validators.max(999.99)]],
      isActive: [true],
      manualLatitude: ['', [Validators.min(45.818), Validators.max(47.808)]],
      manualLongitude: ['', [Validators.min(5.956), Validators.max(10.492)]],
    });
  }

  canGeocode(): boolean {
    const form = this.subprojectForm.value;
    return !!(
      form.locationStreet?.trim() ||
      (form.locationCity?.trim() && form.locationPostalCode?.trim())
    );
  }

  geocodeAddress(): void {
    if (!this.canGeocode() || this.isGeocoding) return;

    const form = this.subprojectForm.value;
    // Format address for AWS Location Service: "Street, PostalCode City, Country"
    // AWS Location Service expects postal code before city without comma separation
    const addressParts = [
      form.locationStreet?.trim(),
      form.locationPostalCode?.trim() && form.locationCity?.trim()
        ? `${form.locationPostalCode.trim()} ${form.locationCity.trim()}`
        : form.locationCity?.trim() || form.locationPostalCode?.trim(),
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
        locationStreet: formValue.locationStreet?.trim() || undefined,
        locationCity: formValue.locationCity?.trim() || undefined,
        locationPostalCode: formValue.locationPostalCode?.trim() || undefined,
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
