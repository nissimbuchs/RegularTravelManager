import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { EmployeeService } from '../../../core/services/employee.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { TranslationService } from '../../../core/services/translation.service';
import { EmployeeDto, UpdateEmployeeAddressRequest } from '@rtm/shared';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';

@Component({
  selector: 'app-address',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <div class="address-container">
      <!-- Current Address Display -->
      <mat-card class="current-address-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>home</mat-icon>
          <mat-card-title>{{ translationService.translateSync('employee.address.current.title') }}</mat-card-title>
          <mat-card-subtitle>{{ translationService.translateSync('employee.address.current.subtitle') }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="employee && hasAddress(); else noAddress" class="address-display">
            <div class="address-info">
              <mat-icon class="address-icon">place</mat-icon>
              <div class="address-text">
                <div class="street">{{ employee.homeStreet }}</div>
                <div class="city-postal">{{ employee.homePostalCode }} {{ employee.homeCity }}</div>
                <div class="country">{{ employee.homeCountry }}</div>
              </div>
            </div>

            <div class="coordinates" *ngIf="employee.homeLocation">
              <mat-icon class="coords-icon">my_location</mat-icon>
              <span class="coords-text">
                {{ employee.homeLocation.latitude | number: '1.6-6' }},
                {{ employee.homeLocation.longitude | number: '1.6-6' }}
              </span>
            </div>
          </div>

          <ng-template #noAddress>
            <div class="no-address">
              <mat-icon>location_off</mat-icon>
              <h3>{{ translationService.translateSync('employee.address.no_address.title') }}</h3>
              <p>{{ translationService.translateSync('employee.address.no_address.description') }}</p>
            </div>
          </ng-template>
        </mat-card-content>
        <mat-card-actions>
          <button
            mat-raised-button
            color="primary"
            (click)="toggleEditMode()"
            [disabled]="isLoading"
          >
            <mat-icon>{{ isEditMode ? 'cancel' : 'edit' }}</mat-icon>
            {{ isEditMode ? translationService.translateSync('employee.address.actions.cancel') : hasAddress() ? translationService.translateSync('employee.address.actions.edit') : translationService.translateSync('employee.address.actions.add') }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Address Form -->
      <mat-card *ngIf="isEditMode" class="address-form-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>edit_location</mat-icon>
          <mat-card-title>{{ hasAddress() ? translationService.translateSync('employee.address.form.update_title') : translationService.translateSync('employee.address.form.add_title') }}</mat-card-title>
          <mat-card-subtitle>{{ translationService.translateSync('employee.address.form.subtitle') }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="addressForm" (ngSubmit)="onSubmit()">
            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ translationService.translateSync('employee.address.form.fields.street.label') }}</mat-label>
                <input
                  matInput
                  formControlName="homeStreet"
                  [placeholder]="translationService.translateSync('employee.address.form.fields.street.placeholder')"
                  maxlength="255"
                />
                <mat-icon matSuffix>home</mat-icon>
                <mat-error *ngIf="addressForm.get('homeStreet')?.errors?.['required']">
                  {{ translationService.translateSync('employee.address.form.errors.street.required') }}
                </mat-error>
                <mat-error *ngIf="addressForm.get('homeStreet')?.errors?.['minlength']">
                  {{ translationService.translateSync('employee.address.form.errors.street.minlength') }}
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="city-field">
                <mat-label>{{ translationService.translateSync('employee.address.form.fields.city.label') }}</mat-label>
                <input
                  matInput
                  formControlName="homeCity"
                  [placeholder]="translationService.translateSync('employee.address.form.fields.city.placeholder')"
                  maxlength="100"
                />
                <mat-icon matSuffix>location_city</mat-icon>
                <mat-error *ngIf="addressForm.get('homeCity')?.errors?.['required']">
                  {{ translationService.translateSync('employee.address.form.errors.city.required') }}
                </mat-error>
                <mat-error *ngIf="addressForm.get('homeCity')?.errors?.['minlength']">
                  {{ translationService.translateSync('employee.address.form.errors.city.minlength') }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="postal-field">
                <mat-label>{{ translationService.translateSync('employee.address.form.fields.postal_code.label') }}</mat-label>
                <input
                  matInput
                  formControlName="homePostalCode"
                  [placeholder]="translationService.translateSync('employee.address.form.fields.postal_code.placeholder')"
                  maxlength="4"
                />
                <mat-icon matSuffix>markunread_mailbox</mat-icon>
                <mat-error *ngIf="addressForm.get('homePostalCode')?.errors?.['required']">
                  {{ translationService.translateSync('employee.address.form.errors.postal_code.required') }}
                </mat-error>
                <mat-error *ngIf="addressForm.get('homePostalCode')?.errors?.['pattern']">
                  {{ translationService.translateSync('employee.address.form.errors.postal_code.pattern') }}
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ translationService.translateSync('employee.address.form.fields.country.label') }}</mat-label>
                <mat-select formControlName="homeCountry">
                  <mat-option *ngFor="let country of supportedCountries" [value]="country">
                    {{ country }}
                  </mat-option>
                </mat-select>
                <mat-icon matSuffix>flag</mat-icon>
                <mat-error *ngIf="addressForm.get('homeCountry')?.errors?.['required']">
                  {{ translationService.translateSync('employee.address.form.errors.country.required') }}
                </mat-error>
              </mat-form-field>
            </div>
          </form>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-button type="button" (click)="toggleEditMode()" [disabled]="isLoading">
            {{ translationService.translateSync('employee.address.form.actions.cancel') }}
          </button>
          <button
            mat-raised-button
            color="primary"
            (click)="onSubmit()"
            [disabled]="!addressForm.valid || isLoading"
          >
            <mat-spinner diameter="20" *ngIf="isLoading" class="button-spinner"></mat-spinner>
            <mat-icon *ngIf="!isLoading">{{ hasAddress() ? 'update' : 'add_location' }}</mat-icon>
            {{ hasAddress() ? translationService.translateSync('employee.address.form.actions.update') : translationService.translateSync('employee.address.form.actions.add') }} {{ translationService.translateSync('employee.address.form.actions.address') }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Address History -->
      <mat-card *ngIf="employee && hasAddress()" class="address-history-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>history</mat-icon>
          <mat-card-title>{{ translationService.translateSync('employee.address.info.title') }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="info-grid">
            <div class="info-item">
              <mat-icon>event</mat-icon>
              <div>
                <strong>{{ translationService.translateSync('employee.address.info.last_updated') }}</strong>
                <p>{{ employee.updatedAt | date: 'medium' }}</p>
              </div>
            </div>
            <div class="info-item" *ngIf="employee.homeLocation">
              <mat-icon>map</mat-icon>
              <div>
                <strong>{{ translationService.translateSync('employee.address.info.geocoding_status') }}</strong>
                <p>{{ translationService.translateSync('employee.address.info.geocoded_success') }}</p>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./address.component.scss'],
})
export class AddressComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  employee: EmployeeDto | null = null;
  addressForm: FormGroup;
  isEditMode = false;
  isLoading = false;
  supportedCountries: string[];

  constructor(
    private fb: FormBuilder,
    private employeeService: EmployeeService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public translationService: TranslationService
  ) {
    this.supportedCountries = this.employeeService.getSupportedCountries();
    this.addressForm = this.createAddressForm();
  }

  ngOnInit(): void {
    this.loadEmployeeProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createAddressForm(): FormGroup {
    return this.fb.group({
      homeStreet: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
      homeCity: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      homePostalCode: ['', [Validators.required, Validators.pattern(/^[0-9]{4}$/)]],
      homeCountry: ['Switzerland', [Validators.required]],
    });
  }

  private loadEmployeeProfile(): void {
    this.loadingService.setLoading(true);

    // Get current user ID from auth service
    this.authService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: user => {
          if (user?.id) {
            this.employeeService
              .getEmployeeProfile(user.id)
              .pipe(
                takeUntil(this.destroy$),
                finalize(() => this.loadingService.setLoading(false))
              )
              .subscribe({
                next: employee => {
                  this.employee = employee;
                  this.populateForm();
                },
                error: error => {
                  console.error('Failed to load employee profile:', error);
                  this.snackBar.open(
                    `${this.translationService.translateSync('employee.address.errors.load_profile')}: ${error.message || error.status}`,
                    this.translationService.translateSync('common.actions.close'),
                    { duration: 5000 }
                  );
                },
              });
          } else {
            this.snackBar.open(this.translationService.translateSync('employee.address.errors.no_auth'), this.translationService.translateSync('common.actions.close'), { duration: 3000 });
            this.loadingService.setLoading(false);
          }
        },
        error: error => {
          console.error('Failed to get current user:', error);
          this.snackBar.open(this.translationService.translateSync('employee.address.errors.auth_error'), this.translationService.translateSync('common.actions.close'), { duration: 3000 });
          this.loadingService.setLoading(false);
        },
      });
  }

  private populateForm(): void {
    if (this.employee && this.hasAddress()) {
      this.addressForm.patchValue({
        homeStreet: this.employee.homeStreet,
        homeCity: this.employee.homeCity,
        homePostalCode: this.employee.homePostalCode,
        homeCountry: this.employee.homeCountry,
      });
    }
  }

  hasAddress(): boolean {
    return !!(
      this.employee?.homeStreet &&
      this.employee?.homeCity &&
      this.employee?.homePostalCode
    );
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    if (this.isEditMode) {
      this.populateForm();
    } else {
      this.addressForm.reset();
      this.addressForm.patchValue({ homeCountry: 'Switzerland' });
    }
  }

  onSubmit(): void {
    if (!this.addressForm.valid || !this.employee) {
      return;
    }

    const addressData: UpdateEmployeeAddressRequest = this.addressForm.value;

    // Show confirmation dialog if updating existing address
    if (this.hasAddress()) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: {
          title: this.translationService.translateSync('employee.address.confirm.update.title'),
          message: this.translationService.translateSync('employee.address.confirm.update.message'),
          confirmText: this.translationService.translateSync('employee.address.confirm.update.confirm'),
          confirmColor: 'primary',
          icon: 'update',
        },
      });

      dialogRef.afterClosed().subscribe(confirmed => {
        if (confirmed) {
          this.performAddressUpdate(addressData);
        }
      });
    } else {
      this.performAddressUpdate(addressData);
    }
  }

  private performAddressUpdate(addressData: UpdateEmployeeAddressRequest): void {
    this.isLoading = true;

    // Get current user ID (cognito_user_id) from auth service
    this.authService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: user => {
          if (user?.id) {
            this.employeeService
              .updateEmployeeAddress(user.id, addressData)
              .pipe(
                takeUntil(this.destroy$),
                finalize(() => (this.isLoading = false))
              )
              .subscribe({
                next: updatedEmployee => {
                  this.employee = updatedEmployee;
                  this.isEditMode = false;
                  this.snackBar.open(
                    updatedEmployee.homeLocation
                      ? this.translationService.translateSync('employee.address.success.updated_geocoded')
                      : this.translationService.translateSync('employee.address.success.updated_pending'),
                    this.translationService.translateSync('common.actions.close'),
                    { duration: 3000 }
                  );
                },
                error: error => {
                  console.error('Failed to update address:', error);
                  let errorMessage = this.translationService.translateSync('employee.address.errors.update_failed');

                  if (error.status === 422) {
                    errorMessage = this.translationService.translateSync('employee.address.errors.invalid_format');
                  } else if (error.status === 404) {
                    errorMessage = this.translationService.translateSync('employee.address.errors.profile_not_found');
                  } else if (error.error?.message) {
                    errorMessage = error.error.message;
                  }

                  this.snackBar.open(errorMessage, this.translationService.translateSync('common.actions.close'), { duration: 5000 });
                },
              });
          } else {
            this.isLoading = false;
            this.snackBar.open(this.translationService.translateSync('employee.address.errors.no_user_id'), this.translationService.translateSync('common.actions.close'), {
              duration: 3000,
            });
          }
        },
        error: error => {
          console.error('Failed to get current user:', error);
          this.isLoading = false;
          this.snackBar.open(this.translationService.translateSync('employee.address.errors.auth_error'), this.translationService.translateSync('common.actions.close'), { duration: 3000 });
        },
      });
  }
}
