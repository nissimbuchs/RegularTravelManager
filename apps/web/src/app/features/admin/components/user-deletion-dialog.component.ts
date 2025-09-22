import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { UserSummary } from '@rtm/shared';

export interface UserDeletionDialogData {
  user: UserSummary;
}

export interface UserDeletionResult {
  reason: string;
  confirmed: boolean;
}

@Component({
  selector: 'app-user-deletion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatCheckboxModule,
  ],
  template: `
    <div class="user-deletion-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon color="warn">delete_forever</mat-icon>
          Delete User Account
        </h2>
      </div>

      <mat-dialog-content>
        <!-- Warning Banner -->
        <div class="warning-banner">
          <mat-icon color="warn">warning</mat-icon>
          <div class="warning-content">
            <h3>This is a permanent action</h3>
            <p>
              This will permanently delete the user account and cannot be undone. All associated
              data will be archived.
            </p>
          </div>
        </div>

        <!-- User Information -->
        <div class="user-info">
          <h3>User to be Deleted</h3>
          <div class="user-details">
            <div class="user-card">
              <div class="user-primary">
                <strong>{{ data.user.firstName }} {{ data.user.lastName }}</strong>
                <mat-chip [color]="getRoleColor(data.user.role)">
                  {{ data.user.role | titlecase }}
                </mat-chip>
              </div>
              <div class="user-secondary">
                <p><mat-icon>email</mat-icon> {{ data.user.email }}</p>
                <p><mat-icon>badge</mat-icon> {{ data.user.employeeNumber }}</p>
                <p *ngIf="data.user.managerName">
                  <mat-icon>supervisor_account</mat-icon>
                  Reports to: {{ data.user.managerName }}
                </p>
                <p>
                  <mat-icon>assignment</mat-icon>
                  {{ data.user.requestCount }} travel requests
                </p>
              </div>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Impact Information -->
        <div class="impact-section">
          <h3>What will happen when this user is deleted:</h3>
          <div class="impact-list">
            <div class="impact-item">
              <mat-icon color="primary">archive</mat-icon>
              <div class="impact-content">
                <strong>User account will be deactivated</strong>
                <p>The user will no longer be able to access the system</p>
              </div>
            </div>

            <div class="impact-item">
              <mat-icon color="primary">assignment</mat-icon>
              <div class="impact-content">
                <strong>Travel requests will be archived</strong>
                <p>
                  {{ data.user.requestCount }} travel requests will be preserved for audit purposes
                </p>
              </div>
            </div>

            <div class="impact-item" *ngIf="data.user.role === 'manager'">
              <mat-icon color="warn">supervisor_account</mat-icon>
              <div class="impact-content">
                <strong>Direct reports will be unassigned</strong>
                <p>Employees reporting to this manager will need new manager assignments</p>
              </div>
            </div>

            <div class="impact-item">
              <mat-icon color="primary">history</mat-icon>
              <div class="impact-content">
                <strong>Audit trail preserved</strong>
                <p>All profile changes and administrative actions will be archived</p>
              </div>
            </div>

            <div class="impact-item">
              <mat-icon color="primary">lock</mat-icon>
              <div class="impact-content">
                <strong>Data retention compliance</strong>
                <p>User data will be soft-deleted to maintain regulatory compliance</p>
              </div>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Deletion Form -->
        <form [formGroup]="deletionForm" class="deletion-form">
          <mat-form-field appearance="outline">
            <mat-label>Reason for Deletion *</mat-label>
            <textarea
              matInput
              formControlName="reason"
              rows="4"
              placeholder="Please provide a detailed reason for deleting this user account..."
            ></textarea>
            <mat-hint>Required for audit purposes and compliance</mat-hint>
            <mat-error *ngIf="deletionForm.get('reason')?.hasError('required')">
              Deletion reason is required
            </mat-error>
            <mat-error *ngIf="deletionForm.get('reason')?.hasError('minlength')">
              Reason must be at least 20 characters for proper documentation
            </mat-error>
          </mat-form-field>

          <mat-checkbox formControlName="confirmDeletion" class="confirmation-checkbox">
            <span class="confirmation-text">
              I understand that this action is permanent and will delete
              <strong>{{ data.user.firstName }} {{ data.user.lastName }}</strong
              >'s account
            </span>
          </mat-checkbox>
        </form>

        <!-- Safety Check -->
        <div class="safety-check">
          <div class="safety-item">
            <mat-icon color="primary">verified_user</mat-icon>
            <span>Data will be preserved for compliance and audit purposes</span>
          </div>
          <div class="safety-item">
            <mat-icon color="primary">backup</mat-icon>
            <span>Profile history and administrative actions are backed up</span>
          </div>
          <div class="safety-item">
            <mat-icon color="primary">security</mat-icon>
            <span>This action will be logged and attributed to your admin account</span>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button color="warn" (click)="onConfirm()" [disabled]="!canConfirm()">
          <mat-icon>delete_forever</mat-icon>
          Delete User
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styleUrls: ['./user-deletion-dialog.component.scss'],
})
export class UserDeletionDialogComponent implements OnInit {
  deletionForm: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<UserDeletionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserDeletionDialogData,
    private formBuilder: FormBuilder
  ) {
    this.deletionForm = this.formBuilder.group({
      reason: ['', [Validators.required, Validators.minLength(20)]],
      confirmDeletion: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    // Pre-populate common deletion reasons for different scenarios
    const suggestions = this.getDeletionSuggestions();
    if (suggestions.length > 0) {
      // Could show suggestions, but for now keep it empty for manual input
    }
  }

  private getDeletionSuggestions(): string[] {
    const suggestions: string[] = [];

    if (this.data.user.status === 'inactive') {
      suggestions.push(
        'User has been inactive for extended period and account cleanup is required'
      );
    }

    if (this.data.user.requestCount === 0) {
      suggestions.push('User account was created but never used - removing unused account');
    }

    return suggestions;
  }

  canConfirm(): boolean {
    return this.deletionForm.valid;
  }

  onConfirm(): void {
    if (!this.canConfirm()) {
      return;
    }

    const result: UserDeletionResult = {
      reason: this.deletionForm.get('reason')?.value,
      confirmed: true,
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
