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
import { TranslationService } from '../../../core/services/translation.service';

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
          {{ translationService.translateSync('admin.users.dialogs.deletion.title') }}
        </h2>
      </div>

      <mat-dialog-content>
        <!-- Warning Banner -->
        <div class="warning-banner">
          <mat-icon color="warn">warning</mat-icon>
          <div class="warning-content">
            <h3>{{ translationService.translateSync('admin.users.dialogs.deletion.warning.title') }}</h3>
            <p>
              {{ translationService.translateSync('admin.users.dialogs.deletion.warning.message') }}
            </p>
          </div>
        </div>

        <!-- User Information -->
        <div class="user-info">
          <h3>{{ translationService.translateSync('admin.users.dialogs.deletion.sections.user_to_delete') }}</h3>
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
                  {{ translationService.translateSync('admin.users.dialogs.deletion.labels.reports_to') }}: {{ data.user.managerName }}
                </p>
                <p>
                  <mat-icon>assignment</mat-icon>
                  {{ translationService.translateSync('admin.users.dialogs.deletion.labels.travel_requests', {count: data.user.requestCount}) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Impact Information -->
        <div class="impact-section">
          <h3>{{ translationService.translateSync('admin.users.dialogs.deletion.sections.impact_title') }}</h3>
          <div class="impact-list">
            <div class="impact-item">
              <mat-icon color="primary">archive</mat-icon>
              <div class="impact-content">
                <strong>{{ translationService.translateSync('admin.users.dialogs.deletion.impacts.account_deactivated.title') }}</strong>
                <p>{{ translationService.translateSync('admin.users.dialogs.deletion.impacts.account_deactivated.description') }}</p>
              </div>
            </div>

            <div class="impact-item">
              <mat-icon color="primary">assignment</mat-icon>
              <div class="impact-content">
                <strong>{{ translationService.translateSync('admin.users.dialogs.deletion.impacts.requests_archived.title') }}</strong>
                <p>
                  {{ translationService.translateSync('admin.users.dialogs.deletion.impacts.requests_archived.description', {count: data.user.requestCount}) }}
                </p>
              </div>
            </div>

            <div class="impact-item" *ngIf="data.user.role === 'manager'">
              <mat-icon color="warn">supervisor_account</mat-icon>
              <div class="impact-content">
                <strong>{{ translationService.translateSync('admin.users.dialogs.deletion.impacts.reports_unassigned.title') }}</strong>
                <p>{{ translationService.translateSync('admin.users.dialogs.deletion.impacts.reports_unassigned.description') }}</p>
              </div>
            </div>

            <div class="impact-item">
              <mat-icon color="primary">history</mat-icon>
              <div class="impact-content">
                <strong>{{ translationService.translateSync('admin.users.dialogs.deletion.impacts.audit_preserved.title') }}</strong>
                <p>{{ translationService.translateSync('admin.users.dialogs.deletion.impacts.audit_preserved.description') }}</p>
              </div>
            </div>

            <div class="impact-item">
              <mat-icon color="primary">lock</mat-icon>
              <div class="impact-content">
                <strong>{{ translationService.translateSync('admin.users.dialogs.deletion.impacts.data_retention.title') }}</strong>
                <p>{{ translationService.translateSync('admin.users.dialogs.deletion.impacts.data_retention.description') }}</p>
              </div>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Deletion Form -->
        <form [formGroup]="deletionForm" class="deletion-form">
          <mat-form-field appearance="outline">
            <mat-label>{{ translationService.translateSync('admin.users.dialogs.deletion.fields.reason') }}</mat-label>
            <textarea
              matInput
              formControlName="reason"
              rows="4"
              [placeholder]="translationService.translateSync('admin.users.dialogs.deletion.placeholders.reason')"
            ></textarea>
            <mat-hint>{{ translationService.translateSync('admin.users.dialogs.deletion.hints.reason') }}</mat-hint>
            <mat-error *ngIf="deletionForm.get('reason')?.hasError('required')">
              {{ translationService.translateSync('admin.users.dialogs.deletion.errors.reason_required') }}
            </mat-error>
            <mat-error *ngIf="deletionForm.get('reason')?.hasError('minlength')">
              {{ translationService.translateSync('admin.users.dialogs.deletion.errors.reason_min_length') }}
            </mat-error>
          </mat-form-field>

          <mat-checkbox formControlName="confirmDeletion" class="confirmation-checkbox">
            <span class="confirmation-text">
              {{ translationService.translateSync('admin.users.dialogs.deletion.confirmation.text', {name: data.user.firstName + ' ' + data.user.lastName}) }}
            </span>
          </mat-checkbox>
        </form>

        <!-- Safety Check -->
        <div class="safety-check">
          <div class="safety-item">
            <mat-icon color="primary">verified_user</mat-icon>
            <span>{{ translationService.translateSync('admin.users.dialogs.deletion.safety.data_preserved') }}</span>
          </div>
          <div class="safety-item">
            <mat-icon color="primary">backup</mat-icon>
            <span>{{ translationService.translateSync('admin.users.dialogs.deletion.safety.history_backed_up') }}</span>
          </div>
          <div class="safety-item">
            <mat-icon color="primary">security</mat-icon>
            <span>{{ translationService.translateSync('admin.users.dialogs.deletion.safety.action_logged') }}</span>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">{{ translationService.translateSync('common.buttons.cancel') }}</button>
        <button mat-raised-button color="warn" (click)="onConfirm()" [disabled]="!canConfirm()">
          <mat-icon>delete_forever</mat-icon>
          {{ translationService.translateSync('admin.users.dialogs.deletion.actions.delete_user') }}
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
    private formBuilder: FormBuilder,
    public translationService: TranslationService
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
        this.translationService.translateSync('admin.users.dialogs.deletion.suggestions.inactive_cleanup')
      );
    }

    if (this.data.user.requestCount === 0) {
      suggestions.push(
        this.translationService.translateSync('admin.users.dialogs.deletion.suggestions.unused_account')
      );
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
