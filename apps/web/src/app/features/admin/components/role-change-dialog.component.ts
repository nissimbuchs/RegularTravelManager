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
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { UserSummary, RoleChangeValidation } from '@rtm/shared';
import { AdminService } from '../../../core/services/admin.service';
import { TranslationService } from '../../../core/services/translation.service';

export interface RoleChangeDialogData {
  user: UserSummary;
}

export interface RoleChangeResult {
  newRole: string;
  reason: string;
}

@Component({
  selector: 'app-role-change-dialog',
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
  ],
  template: `
    <div class="role-change-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon color="accent">security</mat-icon>
          {{ translationService.translateSync('admin.users.dialogs.role_change.title') }}
        </h2>
      </div>

      <mat-dialog-content>
        <!-- User Information -->
        <div class="user-info">
          <h3>{{ translationService.translateSync('admin.users.dialogs.role_change.sections.user_information') }}</h3>
          <div class="user-details">
            <p><strong>{{ translationService.translateSync('admin.users.dialogs.role_change.fields.name') }}:</strong> {{ data.user.firstName }} {{ data.user.lastName }}</p>
            <p><strong>{{ translationService.translateSync('admin.users.dialogs.role_change.fields.email') }}:</strong> {{ data.user.email }}</p>
            <p><strong>{{ translationService.translateSync('admin.users.dialogs.role_change.fields.employee_id') }}:</strong> {{ data.user.employeeNumber }}</p>
            <p>
              <strong>{{ translationService.translateSync('admin.users.dialogs.role_change.fields.current_role') }}:</strong>
              <mat-chip [color]="getRoleColor(data.user.role)">
                {{ data.user.role | titlecase }}
              </mat-chip>
            </p>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Role Change Form -->
        <form [formGroup]="roleForm" class="role-form">
          <mat-form-field appearance="outline">
            <mat-label>{{ translationService.translateSync('admin.users.dialogs.role_change.fields.new_role') }}</mat-label>
            <mat-select formControlName="newRole" (selectionChange)="onRoleChange()">
              <mat-option value="employee">{{ translationService.translateSync('admin.users.dialogs.role_change.roles.employee') }}</mat-option>
              <mat-option value="manager">{{ translationService.translateSync('admin.users.dialogs.role_change.roles.manager') }}</mat-option>
              <mat-option value="administrator">{{ translationService.translateSync('admin.users.dialogs.role_change.roles.administrator') }}</mat-option>
            </mat-select>
            <mat-error *ngIf="roleForm.get('newRole')?.hasError('required')">
              {{ translationService.translateSync('admin.users.dialogs.role_change.errors.role_required') }}
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ translationService.translateSync('admin.users.dialogs.role_change.fields.reason') }}</mat-label>
            <textarea
              matInput
              formControlName="reason"
              rows="3"
              [placeholder]="translationService.translateSync('admin.users.dialogs.role_change.placeholders.reason')"
            ></textarea>
            <mat-error *ngIf="roleForm.get('reason')?.hasError('required')">
              {{ translationService.translateSync('admin.users.dialogs.role_change.errors.reason_required') }}
            </mat-error>
            <mat-error *ngIf="roleForm.get('reason')?.hasError('minlength')">
              {{ translationService.translateSync('admin.users.dialogs.role_change.errors.reason_min_length') }}
            </mat-error>
          </mat-form-field>
        </form>

        <!-- Validation Results -->
        <div *ngIf="validation && !validationLoading" class="validation-section">
          <mat-divider></mat-divider>
          <h3>{{ translationService.translateSync('admin.users.dialogs.role_change.sections.impact_analysis') }}</h3>

          <!-- No Change Warning -->
          <div *ngIf="!validation.canChangeRole" class="validation-result no-change">
            <mat-icon color="warn">warning</mat-icon>
            <div class="validation-content">
              <h4>{{ translationService.translateSync('admin.users.dialogs.role_change.validation.cannot_change_title') }}</h4>
              <ul>
                <li *ngFor="let warning of validation.warnings">{{ warning }}</li>
              </ul>
            </div>
          </div>

          <!-- Valid Change with Warnings -->
          <div
            *ngIf="validation.canChangeRole && validation.warnings.length > 0"
            class="validation-result warnings"
          >
            <mat-icon color="warn">warning</mat-icon>
            <div class="validation-content">
              <h4>{{ translationService.translateSync('admin.users.dialogs.role_change.validation.warnings_title') }}</h4>
              <ul>
                <li *ngFor="let warning of validation.warnings">{{ warning }}</li>
              </ul>
            </div>
          </div>

          <!-- Impact Information -->
          <div *ngIf="validation.impacts.length > 0" class="validation-result impacts">
            <mat-icon color="primary">info</mat-icon>
            <div class="validation-content">
              <h4>{{ translationService.translateSync('admin.users.dialogs.role_change.validation.changes_title') }}</h4>
              <ul>
                <li *ngFor="let impact of validation.impacts">{{ impact }}</li>
              </ul>
            </div>
          </div>

          <!-- Permission Changes -->
          <div class="permission-changes">
            <h4>{{ translationService.translateSync('admin.users.dialogs.role_change.sections.permission_changes') }}</h4>
            <div class="permission-comparison">
              <div class="current-permissions">
                <h5>{{ translationService.translateSync('admin.users.dialogs.role_change.labels.current_permissions') }}</h5>
                <mat-chip-listbox>
                  <mat-chip *ngFor="let permission of validation.existingPermissions">
                    {{ permission | titlecase }}
                  </mat-chip>
                </mat-chip-listbox>
              </div>
              <div class="arrow">
                <mat-icon>arrow_forward</mat-icon>
              </div>
              <div class="new-permissions">
                <h5>{{ translationService.translateSync('admin.users.dialogs.role_change.labels.new_permissions') }}</h5>
                <mat-chip-listbox>
                  <mat-chip
                    *ngFor="let permission of validation.newPermissions"
                    [color]="getPermissionColor(permission, validation.existingPermissions)"
                  >
                    {{ permission | titlecase }}
                  </mat-chip>
                </mat-chip-listbox>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="validationLoading" class="loading-section">
          <mat-spinner diameter="30"></mat-spinner>
          <p>{{ translationService.translateSync('admin.users.dialogs.role_change.messages.validating') }}</p>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">{{ translationService.translateSync('common.buttons.cancel') }}</button>
        <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="!canConfirm()">
          <mat-icon>security</mat-icon>
          {{ translationService.translateSync('admin.users.dialogs.role_change.actions.change_role') }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styleUrls: ['./role-change-dialog.component.scss'],
})
export class RoleChangeDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  roleForm: FormGroup;
  validation: RoleChangeValidation | null = null;
  validationLoading = false;

  constructor(
    private dialogRef: MatDialogRef<RoleChangeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RoleChangeDialogData,
    private formBuilder: FormBuilder,
    private adminService: AdminService,
    public translationService: TranslationService
  ) {
    this.roleForm = this.formBuilder.group({
      newRole: ['', [Validators.required]],
      reason: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  ngOnInit(): void {
    // Set initial role to current role to show no change
    this.roleForm.patchValue({
      newRole: this.data.user.role,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onRoleChange(): void {
    const newRole = this.roleForm.get('newRole')?.value;
    if (newRole && newRole !== this.data.user.role) {
      this.validateRoleChange(newRole);
    } else {
      this.validation = null;
    }
  }

  private validateRoleChange(newRole: string): void {
    this.validationLoading = true;
    this.validation = null;

    this.adminService
      .validateRoleChange(this.data.user.id, newRole)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: validation => {
          this.validation = validation;
          this.validationLoading = false;
        },
        error: error => {
          console.error('Failed to validate role change:', error);
          this.validationLoading = false;
        },
      });
  }

  canConfirm(): boolean {
    if (!this.roleForm.valid) {
      return false;
    }

    const newRole = this.roleForm.get('newRole')?.value;
    if (newRole === this.data.user.role) {
      return false; // No change
    }

    if (this.validation && !this.validation.canChangeRole) {
      return false;
    }

    return true;
  }

  onConfirm(): void {
    if (!this.canConfirm()) {
      return;
    }

    const result: RoleChangeResult = {
      newRole: this.roleForm.get('newRole')?.value,
      reason: this.roleForm.get('reason')?.value,
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

  getPermissionColor(
    permission: string,
    existingPermissions: string[]
  ): 'primary' | 'accent' | 'warn' {
    if (existingPermissions.includes(permission)) {
      return 'primary'; // Existing permission
    } else {
      return 'accent'; // New permission
    }
  }
}
