import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Subject, Observable, startWith, map, combineLatest } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { UserSummary, ManagerAssignmentValidation } from '@rtm/shared';
import { AdminService } from '../../../core/services/admin.service';

export interface ManagerAssignmentDialogData {
  user: UserSummary;
}

export interface ManagerAssignmentResult {
  managerId: string | null;
  reason: string;
}

@Component({
  selector: 'app-manager-assignment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    MatAutocompleteModule,
  ],
  template: `
    <div class="manager-assignment-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon color="accent">supervisor_account</mat-icon>
          Assign Manager
        </h2>
      </div>

      <mat-dialog-content>
        <!-- User Information -->
        <div class="user-info">
          <h3>Employee Information</h3>
          <div class="user-details">
            <p><strong>Name:</strong> {{ data.user.firstName }} {{ data.user.lastName }}</p>
            <p><strong>Email:</strong> {{ data.user.email }}</p>
            <p><strong>Employee ID:</strong> {{ data.user.employeeNumber }}</p>
            <p>
              <strong>Current Manager:</strong>
              <span *ngIf="data.user.managerName; else noManager">
                {{ data.user.managerName }}
              </span>
              <ng-template #noManager>
                <span class="no-manager">No manager assigned</span>
              </ng-template>
            </p>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Manager Assignment Form -->
        <form [formGroup]="managerForm" class="manager-form">
          <mat-form-field appearance="outline">
            <mat-label>Search and Select Manager</mat-label>
            <input
              matInput
              formControlName="managerSearch"
              [matAutocomplete]="managerAuto"
              placeholder="Type to search managers..."
            />
            <mat-autocomplete
              #managerAuto="matAutocomplete"
              [displayWith]="displayManager"
              (optionSelected)="onManagerSelected($event)"
            >
              <mat-option value="" class="clear-option">
                <mat-icon>clear</mat-icon>
                <span>Remove manager assignment</span>
              </mat-option>
              <mat-option *ngFor="let manager of filteredManagers$ | async" [value]="manager">
                <div class="manager-option">
                  <div class="manager-info">
                    <strong>{{ manager.firstName }} {{ manager.lastName }}</strong>
                    <span class="manager-details"
                      >{{ manager.email }} • {{ manager.employeeNumber }}</span
                    >
                  </div>
                  <mat-chip [color]="getRoleColor(manager.role)">
                    {{ manager.role | titlecase }}
                  </mat-chip>
                </div>
              </mat-option>
            </mat-autocomplete>
            <mat-error *ngIf="managerForm.get('managerSearch')?.hasError('required')">
              Please select a manager or choose to remove manager assignment
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Reason for Change</mat-label>
            <textarea
              matInput
              formControlName="reason"
              rows="3"
              placeholder="Please provide a reason for this manager assignment change..."
            ></textarea>
            <mat-error *ngIf="managerForm.get('reason')?.hasError('required')">
              Reason is required for manager assignments
            </mat-error>
            <mat-error *ngIf="managerForm.get('reason')?.hasError('minlength')">
              Reason must be at least 10 characters
            </mat-error>
          </mat-form-field>
        </form>

        <!-- Validation Results -->
        <div *ngIf="validation && !validationLoading" class="validation-section">
          <mat-divider></mat-divider>
          <h3>Assignment Validation</h3>

          <!-- Cannot Assign Warning -->
          <div *ngIf="!validation.canAssignManager" class="validation-result error">
            <mat-icon color="warn">error</mat-icon>
            <div class="validation-content">
              <h4>Cannot Assign Manager</h4>
              <ul>
                <li *ngFor="let warning of validation.warnings">{{ warning }}</li>
              </ul>
            </div>
          </div>

          <!-- Loop Detection -->
          <div *ngIf="validation.loopDetected" class="validation-result error">
            <mat-icon color="warn">loop</mat-icon>
            <div class="validation-content">
              <h4>Circular Hierarchy Detected</h4>
              <p>
                This assignment would create a circular management hierarchy, which is not allowed.
              </p>
            </div>
          </div>

          <!-- Valid Assignment with Warnings -->
          <div
            *ngIf="validation.canAssignManager && validation.warnings.length > 0"
            class="validation-result warnings"
          >
            <mat-icon color="warn">warning</mat-icon>
            <div class="validation-content">
              <h4>Warnings</h4>
              <ul>
                <li *ngFor="let warning of validation.warnings">{{ warning }}</li>
              </ul>
            </div>
          </div>

          <!-- Hierarchy Impact -->
          <div *ngIf="validation.hierarchyImpacts.length > 0" class="validation-result impacts">
            <mat-icon color="primary">info</mat-icon>
            <div class="validation-content">
              <h4>Hierarchy Changes</h4>
              <ul>
                <li *ngFor="let impact of validation.hierarchyImpacts">{{ impact }}</li>
              </ul>
            </div>
          </div>

          <!-- Manager Capacity Warning -->
          <div *ngIf="!validation.managerCapacityOk" class="validation-result warnings">
            <mat-icon color="warn">groups</mat-icon>
            <div class="validation-content">
              <h4>Manager Capacity Warning</h4>
              <p>
                The selected manager already has a high number of direct reports. Consider
                organizational efficiency.
              </p>
            </div>
          </div>

          <!-- Success State -->
          <div
            *ngIf="
              validation.canAssignManager &&
              validation.warnings.length === 0 &&
              validation.hierarchyImpacts.length === 0
            "
            class="validation-result success"
          >
            <mat-icon color="primary">check_circle</mat-icon>
            <div class="validation-content">
              <h4>Assignment Valid</h4>
              <p>This manager assignment can be completed without issues.</p>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="validationLoading" class="loading-section">
          <mat-spinner diameter="30"></mat-spinner>
          <p>Validating manager assignment...</p>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="!canConfirm()">
          <mat-icon>supervisor_account</mat-icon>
          {{ selectedManager ? 'Assign Manager' : 'Remove Manager' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styleUrls: ['./manager-assignment-dialog.component.scss'],
})
export class ManagerAssignmentDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  managerForm: FormGroup;
  validation: ManagerAssignmentValidation | null = null;
  validationLoading = false;

  availableManagers: UserSummary[] = [];
  filteredManagers$: Observable<UserSummary[]>;
  selectedManager: UserSummary | null = null;

  constructor(
    private dialogRef: MatDialogRef<ManagerAssignmentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ManagerAssignmentDialogData,
    private formBuilder: FormBuilder,
    private adminService: AdminService
  ) {
    this.managerForm = this.formBuilder.group({
      managerSearch: [''],
      reason: ['', [Validators.required, Validators.minLength(10)]],
    });

    // Set up filtered managers observable
    this.filteredManagers$ = this.managerForm.get('managerSearch')!.valueChanges.pipe(
      startWith(''),
      debounceTime(200),
      distinctUntilChanged(),
      map(value => {
        if (typeof value === 'string') {
          return this.filterManagers(value);
        }
        return this.availableManagers;
      })
    );
  }

  ngOnInit(): void {
    this.loadAvailableManagers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAvailableManagers(): void {
    // Load managers and administrators who can be assigned
    combineLatest([
      this.adminService.getUsersByRole('manager'),
      this.adminService.getUsersByRole('administrator'),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([managers, administrators]) => {
          this.availableManagers = [...managers, ...administrators].filter(
            user => user.id !== this.data.user.id && user.status === 'active'
          );
        },
        error: error => {
          console.error('Failed to load available managers:', error);
        },
      });
  }

  private filterManagers(value: string): UserSummary[] {
    if (!value) {
      return this.availableManagers;
    }

    const filterValue = value.toLowerCase();
    return this.availableManagers.filter(
      manager =>
        manager.firstName.toLowerCase().includes(filterValue) ||
        manager.lastName.toLowerCase().includes(filterValue) ||
        manager.email.toLowerCase().includes(filterValue) ||
        manager.employeeNumber.toLowerCase().includes(filterValue)
    );
  }

  displayManager(manager: UserSummary | null): string {
    if (!manager) {
      return '';
    }
    return `${manager.firstName} ${manager.lastName}`;
  }

  onManagerSelected(event: any): void {
    const selectedValue = event.option.value;

    if (selectedValue === '') {
      // Remove manager assignment
      this.selectedManager = null;
      this.validateManagerAssignment(null);
    } else {
      // Assign new manager
      this.selectedManager = selectedValue;
      this.validateManagerAssignment(selectedValue.id);
    }
  }

  private validateManagerAssignment(managerId: string | null): void {
    this.validationLoading = true;
    this.validation = null;

    const targetManagerId = managerId || '';

    this.adminService
      .validateManagerAssignment(this.data.user.id, targetManagerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: validation => {
          this.validation = validation;
          this.validationLoading = false;
        },
        error: error => {
          console.error('Failed to validate manager assignment:', error);
          this.validationLoading = false;
        },
      });
  }

  canConfirm(): boolean {
    if (!this.managerForm.valid) {
      return false;
    }

    // Must have either selected a manager or chosen to remove assignment
    if (this.selectedManager === null && this.managerForm.get('managerSearch')?.value !== '') {
      return false;
    }

    // Check if this would actually change anything
    const currentManagerId = this.data.user.managerId;
    const newManagerId = this.selectedManager?.id || null;
    if (currentManagerId === newManagerId) {
      return false; // No change
    }

    if (this.validation && !this.validation.canAssignManager) {
      return false;
    }

    return true;
  }

  onConfirm(): void {
    if (!this.canConfirm()) {
      return;
    }

    const result: ManagerAssignmentResult = {
      managerId: this.selectedManager?.id || null,
      reason: this.managerForm.get('reason')?.value,
    };

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getRoleColor(role: string): 'primary' | 'accent' | 'warn' {
    switch (role) {
      case 'administrator':
        return 'warn';
      case 'manager':
        return 'accent';
      case 'employee':
      default:
        return 'primary';
    }
  }
}
