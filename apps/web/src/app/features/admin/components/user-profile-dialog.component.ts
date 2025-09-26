import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';

import { UserDetails, AdminUserProfileUpdateRequest } from '@rtm/shared';
import { AdminService } from '../../../core/services/admin.service';
import { TranslationService } from '../../../core/services/translation.service';

export interface UserProfileDialogData {
  title: string;
  user: UserDetails;
  isAdminEdit?: boolean;
}

@Component({
  selector: 'app-user-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatDividerModule,
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ translationService.translateSync('admin.users.dialogs.profile.title') }}</h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-progress-bar *ngIf="isLoading" mode="indeterminate"></mat-progress-bar>

    <mat-dialog-content>
      <mat-tab-group>
        <!-- Basic Information Tab -->
        <mat-tab [label]="translationService.translateSync('admin.users.dialogs.profile.tabs.basic_information')">
          <form [formGroup]="profileForm" class="profile-form">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.first_name') }}</mat-label>
                <input
                  matInput
                  formControlName="firstName"
                  [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.first_name')"
                  maxlength="100"
                />
                <mat-icon matPrefix>person</mat-icon>
                <mat-error *ngIf="profileForm.get('firstName')?.hasError('required')">
                  {{ translationService.translateSync('admin.users.dialogs.profile.errors.first_name_required') }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.last_name') }}</mat-label>
                <input
                  matInput
                  formControlName="lastName"
                  [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.last_name')"
                  maxlength="100"
                />
                <mat-icon matPrefix>person</mat-icon>
                <mat-error *ngIf="profileForm.get('lastName')?.hasError('required')">
                  {{ translationService.translateSync('admin.users.dialogs.profile.errors.last_name_required') }}
                </mat-error>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" *ngIf="data.isAdminEdit">
              <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.email') }}</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.email')"
              />
              <mat-icon matPrefix>email</mat-icon>
              <mat-hint>{{ translationService.translateSync('admin.users.dialogs.profile.hints.email_admin_only') }}</mat-hint>
              <mat-error *ngIf="profileForm.get('email')?.hasError('required')">
                {{ translationService.translateSync('admin.users.dialogs.profile.errors.email_required') }}
              </mat-error>
              <mat-error *ngIf="profileForm.get('email')?.hasError('email')">
                {{ translationService.translateSync('admin.users.dialogs.profile.errors.email_invalid') }}
              </mat-error>
            </mat-form-field>

            <div class="form-row" *ngIf="data.isAdminEdit">
              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.employee_number') }}</mat-label>
                <input matInput formControlName="employeeNumber" [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.employee_number')" />
                <mat-icon matPrefix>badge</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.phone_number') }}</mat-label>
                <input
                  matInput
                  formControlName="phoneNumber"
                  [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.phone_number')"
                  type="tel"
                />
                <mat-icon matPrefix>phone</mat-icon>
                <mat-error *ngIf="profileForm.get('phoneNumber')?.hasError('pattern')">
                  {{ translationService.translateSync('admin.users.dialogs.profile.errors.phone_invalid') }}
                </mat-error>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" *ngIf="!data.isAdminEdit">
              <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.phone_number') }}</mat-label>
              <input
                matInput
                formControlName="phoneNumber"
                [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.phone_number')"
                type="tel"
              />
              <mat-icon matPrefix>phone</mat-icon>
              <mat-error *ngIf="profileForm.get('phoneNumber')?.hasError('pattern')">
                {{ translationService.translateSync('admin.users.dialogs.profile.errors.phone_invalid') }}
              </mat-error>
            </mat-form-field>

            <!-- Admin-only role and status -->
            <div class="form-row" *ngIf="data.isAdminEdit">
              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.role') }}</mat-label>
                <mat-select formControlName="role">
                  <mat-option value="employee">{{ translationService.translateSync('admin.users.dialogs.profile.roles.employee') }}</mat-option>
                  <mat-option value="manager">{{ translationService.translateSync('admin.users.dialogs.profile.roles.manager') }}</mat-option>
                  <mat-option value="administrator">{{ translationService.translateSync('admin.users.dialogs.profile.roles.administrator') }}</mat-option>
                </mat-select>
                <mat-icon matPrefix>security</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.status') }}</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="active">{{ translationService.translateSync('admin.users.dialogs.profile.statuses.active') }}</mat-option>
                  <mat-option value="inactive">{{ translationService.translateSync('admin.users.dialogs.profile.statuses.inactive') }}</mat-option>
                  <mat-option value="pending">{{ translationService.translateSync('admin.users.dialogs.profile.statuses.pending') }}</mat-option>
                </mat-select>
                <mat-icon matPrefix>toggle_on</mat-icon>
              </mat-form-field>
            </div>
          </form>
        </mat-tab>

        <!-- Address Tab -->
        <mat-tab [label]="translationService.translateSync('admin.users.dialogs.profile.tabs.address')">
          <form [formGroup]="addressForm" class="profile-form">
            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.street_address') }}</mat-label>
              <input
                matInput
                formControlName="street"
                [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.street_address')"
                maxlength="255"
              />
              <mat-icon matPrefix>home</mat-icon>
              <mat-error *ngIf="addressForm.get('street')?.hasError('required')">
                {{ translationService.translateSync('admin.users.dialogs.profile.errors.street_required') }}
              </mat-error>
            </mat-form-field>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.city') }}</mat-label>
                <input matInput formControlName="city" [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.city')" maxlength="100" />
                <mat-icon matPrefix>location_city</mat-icon>
                <mat-error *ngIf="addressForm.get('city')?.hasError('required')">
                  {{ translationService.translateSync('admin.users.dialogs.profile.errors.city_required') }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.postal_code') }}</mat-label>
                <input
                  matInput
                  formControlName="postalCode"
                  [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.postal_code')"
                  maxlength="20"
                />
                <mat-icon matPrefix>markunread_mailbox</mat-icon>
                <mat-error *ngIf="addressForm.get('postalCode')?.hasError('required')">
                  {{ translationService.translateSync('admin.users.dialogs.profile.errors.postal_code_required') }}
                </mat-error>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.country') }}</mat-label>
              <input
                matInput
                formControlName="country"
                [placeholder]="translationService.translateSync('admin.users.dialogs.profile.placeholders.country')"
                maxlength="100"
              />
              <mat-icon matPrefix>public</mat-icon>
              <mat-hint>{{ translationService.translateSync('admin.users.dialogs.profile.hints.country_default') }}</mat-hint>
            </mat-form-field>

            <div class="address-note" *ngIf="addressForm.dirty">
              <mat-icon>info</mat-icon>
              <p>
                {{ translationService.translateSync('admin.users.dialogs.profile.notices.address_change_warning') }}
              </p>
            </div>
          </form>
        </mat-tab>

        <!-- Preferences Tab -->
        <mat-tab [label]="translationService.translateSync('admin.users.dialogs.profile.tabs.preferences')">
          <form [formGroup]="preferencesForm" class="profile-form">
            <h3>{{ translationService.translateSync('admin.users.dialogs.profile.sections.notification_preferences') }}</h3>
            <mat-divider></mat-divider>

            <div class="preferences-section">
              <mat-slide-toggle formControlName="emailNotifications">
                <span class="toggle-label">
                  <mat-icon>email</mat-icon>
                  {{ translationService.translateSync('admin.users.dialogs.profile.preferences.email_notifications') }}
                </span>
              </mat-slide-toggle>

              <mat-slide-toggle formControlName="requestUpdates">
                <span class="toggle-label">
                  <mat-icon>update</mat-icon>
                  {{ translationService.translateSync('admin.users.dialogs.profile.preferences.request_updates') }}
                </span>
              </mat-slide-toggle>

              <mat-slide-toggle formControlName="weeklyDigest">
                <span class="toggle-label">
                  <mat-icon>summarize</mat-icon>
                  {{ translationService.translateSync('admin.users.dialogs.profile.preferences.weekly_digest') }}
                </span>
              </mat-slide-toggle>

              <mat-slide-toggle formControlName="maintenanceAlerts">
                <span class="toggle-label">
                  <mat-icon>build</mat-icon>
                  {{ translationService.translateSync('admin.users.dialogs.profile.preferences.maintenance_alerts') }}
                </span>
              </mat-slide-toggle>
            </div>

            <h3>{{ translationService.translateSync('admin.users.dialogs.profile.sections.privacy_settings') }}</h3>
            <mat-divider></mat-divider>

            <div class="preferences-section">
              <mat-form-field appearance="outline">
                <mat-label>{{ translationService.translateSync('admin.users.dialogs.profile.fields.profile_visibility') }}</mat-label>
                <mat-select formControlName="profileVisibility">
                  <mat-option value="private">{{ translationService.translateSync('admin.users.dialogs.profile.visibility.private') }}</mat-option>
                  <mat-option value="team">{{ translationService.translateSync('admin.users.dialogs.profile.visibility.team_only') }}</mat-option>
                  <mat-option value="company">{{ translationService.translateSync('admin.users.dialogs.profile.visibility.company_wide') }}</mat-option>
                </mat-select>
                <mat-icon matPrefix>visibility</mat-icon>
              </mat-form-field>

              <mat-slide-toggle formControlName="allowAnalytics">
                <span class="toggle-label">
                  <mat-icon>analytics</mat-icon>
                  {{ translationService.translateSync('admin.users.dialogs.profile.preferences.allow_analytics') }}
                </span>
              </mat-slide-toggle>

              <mat-slide-toggle formControlName="shareLocationData">
                <span class="toggle-label">
                  <mat-icon>location_on</mat-icon>
                  {{ translationService.translateSync('admin.users.dialogs.profile.preferences.share_location_data') }}
                </span>
              </mat-slide-toggle>
            </div>
          </form>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="isLoading">{{ translationService.translateSync('common.buttons.cancel') }}</button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSubmit()"
        [disabled]="!isFormValid() || isLoading"
      >
        <mat-icon *ngIf="isLoading">hourglass_empty</mat-icon>
        <mat-icon *ngIf="!isLoading">save</mat-icon>
        {{ isLoading ? translationService.translateSync('common.actions.saving') : translationService.translateSync('admin.users.dialogs.profile.actions.save_changes') }}
      </button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./user-profile-dialog.component.scss'],
})
export class UserProfileDialogComponent implements OnInit {
  profileForm: FormGroup;
  addressForm: FormGroup;
  preferencesForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    public translationService: TranslationService,
    private dialogRef: MatDialogRef<UserProfileDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserProfileDialogData
  ) {
    this.profileForm = this.createProfileForm();
    this.addressForm = this.createAddressForm();
    this.preferencesForm = this.createPreferencesForm();
  }

  ngOnInit(): void {
    if (this.data.user) {
      this.populateForms();
    }
  }

  private createProfileForm(): FormGroup {
    return this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      phoneNumber: ['', [Validators.pattern('^\\+?[0-9\\s\\-()]+$')]],
      // Admin-only fields
      email: [
        { value: '', disabled: !this.data.isAdminEdit },
        [Validators.required, Validators.email],
      ],
      employeeNumber: [{ value: '', disabled: !this.data.isAdminEdit }],
      role: [{ value: '', disabled: !this.data.isAdminEdit }],
      status: [{ value: '', disabled: !this.data.isAdminEdit }],
    });
  }

  private createAddressForm(): FormGroup {
    return this.fb.group({
      street: ['', [Validators.required, Validators.maxLength(255)]],
      city: ['', [Validators.required, Validators.maxLength(100)]],
      postalCode: ['', [Validators.required, Validators.maxLength(20)]],
      country: ['Switzerland', [Validators.maxLength(100)]],
    });
  }

  private createPreferencesForm(): FormGroup {
    return this.fb.group({
      // Notification preferences
      emailNotifications: [true],
      requestUpdates: [true],
      weeklyDigest: [false],
      maintenanceAlerts: [true],
      // Privacy settings
      profileVisibility: ['team'],
      allowAnalytics: [true],
      shareLocationData: [true],
    });
  }

  private populateForms(): void {
    const user = this.data.user;

    this.profileForm.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber || '',
      email: user.email,
      employeeNumber: user.employeeNumber,
      role: user.role,
      status: user.status,
    });

    this.addressForm.patchValue({
      street: user.homeAddress.street,
      city: user.homeAddress.city,
      postalCode: user.homeAddress.postalCode,
      country: user.homeAddress.country || 'Switzerland',
    });

    // Note: In a real implementation, these would come from the user's stored preferences
    this.preferencesForm.patchValue({
      emailNotifications: true,
      requestUpdates: true,
      weeklyDigest: false,
      maintenanceAlerts: true,
      profileVisibility: 'team',
      allowAnalytics: true,
      shareLocationData: true,
    });
  }

  isFormValid(): boolean {
    return this.profileForm.valid && this.addressForm.valid && this.preferencesForm.valid;
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }

    this.isLoading = true;

    const updateRequest: AdminUserProfileUpdateRequest = {
      ...this.profileForm.value,
      homeAddress: this.addressForm.value,
      notificationPreferences: {
        email: this.preferencesForm.value.emailNotifications,
        requestUpdates: this.preferencesForm.value.requestUpdates,
        weeklyDigest: this.preferencesForm.value.weeklyDigest,
        maintenanceAlerts: this.preferencesForm.value.maintenanceAlerts,
      },
      privacySettings: {
        profileVisibility: this.preferencesForm.value.profileVisibility,
        allowAnalytics: this.preferencesForm.value.allowAnalytics,
        shareLocationData: this.preferencesForm.value.shareLocationData,
        allowManagerAccess: true,
        dataRetentionConsent: true,
      },
    };

    // Clean up undefined values
    Object.keys(updateRequest).forEach(key => {
      if (updateRequest[key as keyof AdminUserProfileUpdateRequest] === undefined) {
        delete updateRequest[key as keyof AdminUserProfileUpdateRequest];
      }
    });

    this.adminService.updateUserProfile(this.data.user.id, updateRequest).subscribe({
      next: response => {
        this.isLoading = false;
        this.dialogRef.close(response);
      },
      error: error => {
        this.isLoading = false;
        console.error('Failed to update user profile:', error);

        // Handle validation errors
        if (error.error?.validationErrors) {
          const validationErrors = error.error.validationErrors;
          Object.keys(validationErrors).forEach(field => {
            const control = this.profileForm.get(field) || this.addressForm.get(field);
            if (control) {
              control.setErrors({ serverValidation: validationErrors[field] });
            }
          });
        }
      },
    });
  }
}
