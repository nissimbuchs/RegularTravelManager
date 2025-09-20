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
            My Profile
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-tab-group animationDuration="0ms">
            <!-- Personal Information Tab -->
            <mat-tab label="Personal Information">
              <div class="tab-content">
                <form [formGroup]="personalForm" (ngSubmit)="savePersonalInfo()">
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="form-field-half">
                      <mat-label>First Name</mat-label>
                      <input matInput formControlName="firstName" />
                      <mat-icon matPrefix>person</mat-icon>
                      <mat-error *ngIf="personalForm.get('firstName')?.hasError('required')">
                        First name is required
                      </mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="form-field-half">
                      <mat-label>Last Name</mat-label>
                      <input matInput formControlName="lastName" />
                      <mat-error *ngIf="personalForm.get('lastName')?.hasError('required')">
                        Last name is required
                      </mat-error>
                    </mat-form-field>
                  </div>

                  <mat-form-field appearance="outline" class="form-field-full">
                    <mat-label>Email</mat-label>
                    <input matInput formControlName="email" readonly />
                    <mat-icon matPrefix>email</mat-icon>
                    <mat-hint>Email cannot be changed directly. Contact admin for changes.</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="form-field-full">
                    <mat-label>Phone Number</mat-label>
                    <input matInput formControlName="phoneNumber" placeholder="e.g., +41 79 123 45 67, +1 555 123 4567" />
                    <mat-icon matPrefix>phone</mat-icon>
                    <mat-error *ngIf="personalForm.get('phoneNumber')?.hasError('pattern')">
                      Please enter a valid phone number (10-15 digits, optional + prefix)
                    </mat-error>
                  </mat-form-field>

                  <div class="form-actions">
                    <button mat-button type="button" (click)="resetPersonalForm()" [disabled]="loading">
                      Reset
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
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </mat-tab>

            <!-- Address Management Tab -->
            <mat-tab label="Home Address">
              <div class="tab-content">
                <div class="address-info-card">
                  <mat-icon class="address-icon">home</mat-icon>
                  <h3>Manage Your Home Address</h3>
                  <p>
                    Your home address is used to calculate travel distances and allowances for your
                    travel requests.
                  </p>

                  <div class="current-address" *ngIf="profile?.homeAddress">
                    <h4>Current Address:</h4>
                    <div class="address-display">
                      <div>{{ profile!.homeAddress!.street }}</div>
                      <div>{{ profile!.homeAddress!.postalCode }} {{ profile!.homeAddress!.city }}</div>
                      <div>{{ profile!.homeAddress!.country }}</div>
                    </div>
                  </div>

                  <div class="no-address" *ngIf="!profile?.homeAddress">
                    <mat-icon>location_off</mat-icon>
                    <p>No address set. Please add your home address to enable travel distance calculations.</p>
                  </div>

                  <button
                    mat-raised-button
                    color="primary"
                    (click)="navigateToAddress()"
                    class="address-button"
                  >
                    <mat-icon>edit_location</mat-icon>
                    Manage Address
                  </button>
                </div>
              </div>
            </mat-tab>

            <!-- Notification Settings Tab -->
            <mat-tab label="Notifications">
              <div class="tab-content">
                <form [formGroup]="notificationForm" (ngSubmit)="saveNotifications()">
                  <h3>Email Notifications</h3>
                  <div class="checkbox-group">
                    <mat-checkbox formControlName="email">
                      Enable email notifications
                    </mat-checkbox>
                    <mat-checkbox formControlName="requestUpdates">
                      Request status updates
                    </mat-checkbox>
                    <mat-checkbox formControlName="weeklyDigest">
                      Weekly expense summaries
                    </mat-checkbox>
                    <mat-checkbox formControlName="maintenanceAlerts">
                      System maintenance alerts
                    </mat-checkbox>
                  </div>

                  <mat-form-field appearance="outline" class="form-field-full">
                    <mat-label>Notification Frequency</mat-label>
                    <mat-select formControlName="frequency">
                      <mat-option value="immediate">Immediate</mat-option>
                      <mat-option value="daily">Daily Digest</mat-option>
                      <mat-option value="weekly">Weekly Summary</mat-option>
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
                      Reset
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
                      Save Preferences
                    </button>
                  </div>
                </form>
              </div>
            </mat-tab>

            <!-- Security Tab -->
            <mat-tab label="Security">
              <div class="tab-content">
                <div class="security-info">
                  <h3>Account Security</h3>
                  <div class="info-row">
                    <span class="info-label">Account Status:</span>
                    <span class="info-value">{{ profile?.status | titlecase }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Role:</span>
                    <span class="info-value">{{ profile?.role | titlecase }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Last Login:</span>
                    <span class="info-value">{{ profile?.lastLoginAt | date : 'medium' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Email Verified:</span>
                    <span class="info-value">
                      <mat-icon *ngIf="profile?.emailVerifiedAt" color="primary"
                        >check_circle</mat-icon
                      >
                      <mat-icon *ngIf="!profile?.emailVerifiedAt" color="warn"
                        >cancel</mat-icon
                      >
                    </span>
                  </div>
                  <div class="button-group">
                    <button mat-stroked-button color="primary" disabled>
                      <mat-icon>lock</mat-icon>
                      Change Password
                    </button>
                    <button mat-stroked-button disabled>
                      <mat-icon>security</mat-icon>
                      Two-Factor Authentication
                    </button>
                  </div>
                  <mat-hint class="security-hint"
                    >Password and security features coming soon</mat-hint
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
    private snackBar: MatSnackBar
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
    this.adminService.getUserProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.populateForms(profile);
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load profile:', error);
          this.snackBar.open('Failed to load profile', 'Close', { duration: 3000 });
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

    this.updateProfile(updates, 'Personal information');
  }

  navigateToAddress(): void {
    this.router.navigate(['/employee/address']);
  }

  saveNotifications(): void {
    const updates: UserProfileUpdateRequest = {
      notificationPreferences: this.notificationForm.value,
    };

    this.updateProfile(updates, 'Notification preferences');
  }

  private updateProfile(updates: UserProfileUpdateRequest, updateType: string): void {
    this.loading = true;
    this.adminService.updateCurrentUserProfile(updates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedProfile) => {
          this.profile = updatedProfile;
          this.populateForms(updatedProfile);
          this.snackBar.open(`${updateType} updated successfully`, 'Close', { duration: 3000 });
          this.loading = false;

          // Mark forms as pristine after successful save
          this.personalForm.markAsPristine();
          this.notificationForm.markAsPristine();
        },
        error: (error) => {
          console.error('Failed to update profile:', error);
          this.snackBar.open(`Failed to update ${updateType.toLowerCase()}`, 'Close', { duration: 3000 });
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