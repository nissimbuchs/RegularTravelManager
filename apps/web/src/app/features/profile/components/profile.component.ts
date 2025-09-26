import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { TranslationService } from '../../../core/services/translation.service';
import { UserProfile, UserProfileUpdateRequest } from '@rtm/shared';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatCheckboxModule,
    MatSelectModule,
    MatTabsModule,
  ],
  template: `
    <div class="profile-container">
      <mat-card class="profile-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>account_circle</mat-icon>
            {{ translationService.translateSync('profile.title') }}
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-tab-group animationDuration="0ms">
            <!-- Personal Information Tab -->
            <mat-tab [label]="translationService.translateSync('profile.tabs.personal')">
              <div class="tab-content">
                <form [formGroup]="personalForm" (ngSubmit)="savePersonalInfo()">
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="form-field-half">
                      <mat-label>{{ translationService.translateSync('profile.personal.fields.first_name') }}</mat-label>
                      <input matInput formControlName="firstName" />
                      <mat-icon matPrefix>person</mat-icon>
                      <mat-error *ngIf="personalForm.get('firstName')?.hasError('required')">
                        {{ translationService.translateSync('profile.personal.errors.first_name_required') }}
                      </mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="form-field-half">
                      <mat-label>{{ translationService.translateSync('profile.personal.fields.last_name') }}</mat-label>
                      <input matInput formControlName="lastName" />
                      <mat-error *ngIf="personalForm.get('lastName')?.hasError('required')">
                        {{ translationService.translateSync('profile.personal.errors.last_name_required') }}
                      </mat-error>
                    </mat-form-field>
                  </div>

                  <mat-form-field appearance="outline" class="form-field-full">
                    <mat-label>{{ translationService.translateSync('profile.personal.fields.email') }}</mat-label>
                    <input matInput formControlName="email" readonly />
                    <mat-icon matPrefix>email</mat-icon>
                    <mat-hint
                      >{{ translationService.translateSync('profile.personal.fields.email_hint') }}</mat-hint
                    >
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="form-field-full">
                    <mat-label>{{ translationService.translateSync('profile.personal.fields.phone') }}</mat-label>
                    <input
                      matInput
                      formControlName="phoneNumber"
                      [placeholder]="translationService.translateSync('profile.personal.fields.phone_placeholder')"
                    />
                    <mat-icon matPrefix>phone</mat-icon>
                    <mat-error *ngIf="personalForm.get('phoneNumber')?.hasError('pattern')">
                      {{ translationService.translateSync('profile.personal.errors.phone_invalid') }}
                    </mat-error>
                  </mat-form-field>

                  <div class="form-actions">
                    <button
                      mat-button
                      type="button"
                      (click)="resetPersonalForm()"
                      [disabled]="loading"
                    >
                      {{ translationService.translateSync('profile.personal.actions.reset') }}
                    </button>
                    <button
                      mat-raised-button
                      color="primary"
                      type="submit"
                      [disabled]="personalForm.invalid || !personalForm.dirty || loading"
                    >
                      <mat-icon *ngIf="!loading">save</mat-icon>
                      <mat-progress-spinner
                        *ngIf="loading"
                        mode="indeterminate"
                        diameter="20"
                      ></mat-progress-spinner>
                      {{ translationService.translateSync('profile.personal.actions.save') }}
                    </button>
                  </div>
                </form>
              </div>
            </mat-tab>

            <!-- Address Management Tab -->
            <mat-tab [label]="translationService.translateSync('profile.tabs.address')">
              <div class="tab-content">
                <div class="address-info-card">
                  <mat-icon class="address-icon">home</mat-icon>
                  <h3>{{ translationService.translateSync('profile.address.title') }}</h3>
                  <p>
                    {{ translationService.translateSync('profile.address.description') }}
                  </p>

                  <div class="current-address" *ngIf="profile?.homeAddress">
                    <h4>{{ translationService.translateSync('profile.address.current') }}:</h4>
                    <div class="address-display">
                      <div>{{ profile!.homeAddress!.street }}</div>
                      <div>
                        {{ profile!.homeAddress!.postalCode }} {{ profile!.homeAddress!.city }}
                      </div>
                      <div>{{ profile!.homeAddress!.country }}</div>
                    </div>
                  </div>

                  <div class="no-address" *ngIf="!profile?.homeAddress">
                    <mat-icon>location_off</mat-icon>
                    <p>
                      {{ translationService.translateSync('profile.address.no_address') }}
                    </p>
                  </div>

                  <button
                    mat-raised-button
                    color="primary"
                    (click)="navigateToAddress()"
                    class="address-button"
                  >
                    <mat-icon>edit_location</mat-icon>
                    {{ translationService.translateSync('profile.address.manage_button') }}
                  </button>
                </div>
              </div>
            </mat-tab>

            <!-- Notification Settings Tab -->
            <mat-tab [label]="translationService.translateSync('profile.tabs.notifications')">
              <div class="tab-content">
                <form [formGroup]="notificationForm" (ngSubmit)="saveNotifications()">
                  <h3>{{ translationService.translateSync('profile.notifications.title') }}</h3>
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="email">
                      {{ translationService.translateSync('profile.notifications.enable_email') }}
                    </mat-checkbox>
                    <mat-checkbox formControlName="requestUpdates">
                      {{ translationService.translateSync('profile.notifications.request_updates') }}
                    </mat-checkbox>
                    <mat-checkbox formControlName="weeklyDigest">
                      {{ translationService.translateSync('profile.notifications.weekly_digest') }}
                    </mat-checkbox>
                    <mat-checkbox formControlName="maintenanceAlerts">
                      {{ translationService.translateSync('profile.notifications.maintenance_alerts') }}
                    </mat-checkbox>
                  </div>

                  <mat-form-field appearance="outline" class="form-field-full">
                    <mat-label>{{ translationService.translateSync('profile.notifications.frequency_label') }}</mat-label>
                    <mat-select formControlName="frequency">
                      <mat-option value="immediate">{{ translationService.translateSync('profile.notifications.frequency.immediate') }}</mat-option>
                      <mat-option value="daily">{{ translationService.translateSync('profile.notifications.frequency.daily') }}</mat-option>
                      <mat-option value="weekly">{{ translationService.translateSync('profile.notifications.frequency.weekly') }}</mat-option>
                    </mat-select>
                    <mat-icon matPrefix>schedule</mat-icon>
                  </mat-form-field>

                  <div class="form-actions">
                    <button
                      mat-button
                      type="button"
                      (click)="resetNotificationForm()"
                      [disabled]="loading"
                    >
                      {{ translationService.translateSync('profile.notifications.actions.reset') }}
                    </button>
                    <button
                      mat-raised-button
                      color="primary"
                      type="submit"
                      [disabled]="!notificationForm.dirty || loading"
                    >
                      <mat-icon *ngIf="!loading">save</mat-icon>
                      <mat-progress-spinner
                        *ngIf="loading"
                        mode="indeterminate"
                        diameter="20"
                      ></mat-progress-spinner>
                      {{ translationService.translateSync('profile.notifications.actions.save') }}
                    </button>
                  </div>
                </form>
              </div>
            </mat-tab>

            <!-- Security Tab -->
            <mat-tab [label]="translationService.translateSync('profile.tabs.security')">
              <div class="tab-content">
                <div class="security-info">
                  <h3>{{ translationService.translateSync('profile.security.title') }}</h3>
                  <div class="info-row">
                    <span class="info-label">{{ translationService.translateSync('profile.security.account_status') }}:</span>
                    <span class="info-value">{{ profile?.status | titlecase }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">{{ translationService.translateSync('profile.security.role') }}:</span>
                    <span class="info-value">{{ profile?.role | titlecase }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">{{ translationService.translateSync('profile.security.last_login') }}:</span>
                    <span class="info-value">{{ profile?.lastLoginAt | date: 'medium' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">{{ translationService.translateSync('profile.security.email_verified') }}:</span>
                    <span class="info-value">
                      <mat-icon *ngIf="profile?.emailVerifiedAt" color="primary"
                        >check_circle</mat-icon
                      >
                      <mat-icon *ngIf="!profile?.emailVerifiedAt" color="warn">cancel</mat-icon>
                    </span>
                  </div>
                  <div class="button-group">
                    <button mat-stroked-button color="primary" disabled>
                      <mat-icon>lock</mat-icon>
                      {{ translationService.translateSync('profile.security.change_password') }}
                    </button>
                    <button mat-stroked-button disabled>
                      <mat-icon>security</mat-icon>
                      {{ translationService.translateSync('profile.security.two_factor') }}
                    </button>
                  </div>
                  <mat-hint class="security-hint"
                    >{{ translationService.translateSync('profile.security.coming_soon') }}</mat-hint
                  >
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  personalForm: FormGroup;
  notificationForm: FormGroup;

  profile: UserProfile | null = null;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private adminService: AdminService,
    private snackBar: MatSnackBar,
    public translationService: TranslationService
  ) {
    this.personalForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      phoneNumber: ['', [Validators.pattern(/^[\+]?[0-9\s\-\.\(\)]{10,20}$/)]],
    });

    this.notificationForm = this.fb.group({
      email: [true],
      requestUpdates: [true],
      weeklyDigest: [false],
      maintenanceAlerts: [true],
      frequency: ['immediate'],
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProfile(): void {
    this.loading = true;
    this.adminService
      .getUserProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: profile => {
          this.profile = profile;
          this.populateForms(profile);
          this.loading = false;
        },
        error: error => {
          console.error('Failed to load profile:', error);
          this.snackBar.open(this.translationService.translateSync('profile.messages.load_failed'), this.translationService.translateSync('common.actions.close'), { duration: 3000 });
          this.loading = false;
        },
      });
  }

  populateForms(profile: UserProfile): void {
    this.personalForm.patchValue({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phoneNumber: profile.phoneNumber || '',
    });

    if (profile.notificationPreferences) {
      this.notificationForm.patchValue(profile.notificationPreferences);
    }
  }

  savePersonalInfo(): void {
    if (this.personalForm.invalid) return;

    const updates: UserProfileUpdateRequest = {
      firstName: this.personalForm.get('firstName')?.value,
      lastName: this.personalForm.get('lastName')?.value,
      phoneNumber: this.personalForm.get('phoneNumber')?.value || undefined,
    };

    this.updateProfile(updates, this.translationService.translateSync('profile.messages.personal_info'));
  }

  navigateToAddress(): void {
    this.router.navigate(['/employee/address']);
  }

  saveNotifications(): void {
    const updates: UserProfileUpdateRequest = {
      notificationPreferences: this.notificationForm.value,
    };

    this.updateProfile(updates, this.translationService.translateSync('profile.messages.notification_preferences'));
  }

  private updateProfile(updates: UserProfileUpdateRequest, updateType: string): void {
    this.loading = true;
    this.adminService
      .updateCurrentUserProfile(updates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: updatedProfile => {
          this.profile = updatedProfile;
          this.populateForms(updatedProfile);
          this.snackBar.open(this.translationService.translateSync('profile.messages.update_success', { type: updateType }), this.translationService.translateSync('common.actions.close'), { duration: 3000 });
          this.loading = false;

          // Mark forms as pristine after successful save
          this.personalForm.markAsPristine();
          this.notificationForm.markAsPristine();
        },
        error: error => {
          console.error('Failed to update profile:', error);
          this.snackBar.open(this.translationService.translateSync('profile.messages.update_failed', { type: updateType.toLowerCase() }), this.translationService.translateSync('common.actions.close'), {
            duration: 3000,
          });
          this.loading = false;
        },
      });
  }

  resetPersonalForm(): void {
    if (this.profile) {
      this.personalForm.patchValue({
        firstName: this.profile.firstName,
        lastName: this.profile.lastName,
        phoneNumber: this.profile.phoneNumber || '',
      });
      this.personalForm.markAsPristine();
    }
  }

  resetNotificationForm(): void {
    if (this.profile?.notificationPreferences) {
      this.notificationForm.patchValue(this.profile.notificationPreferences);
      this.notificationForm.markAsPristine();
    }
  }
}
