import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { UserProfileDialogComponent } from '../user-profile-dialog.component';
import { AdminService } from '../../../../core/services/admin.service';
import { UserDetails } from '@rtm/shared';

describe('UserProfileDialogComponent', () => {
  let component: UserProfileDialogComponent;
  let fixture: ComponentFixture<UserProfileDialogComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<UserProfileDialogComponent>>;
  let mockAdminService: jasmine.SpyObj<AdminService>;

  const mockUser: UserDetails = {
    id: '123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    employeeNumber: 'EMP-001',
    phoneNumber: '+41 79 123 45 67',
    role: 'employee',
    status: 'active',
    homeAddress: {
      street: '123 Main St',
      city: 'Zurich',
      postalCode: '8001',
      country: 'Switzerland',
    },
    homeCoordinates: {
      latitude: 47.3769,
      longitude: 8.5417,
    },
    manager: {
      id: '456',
      name: 'Manager Name',
    },
    registeredAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    mockAdminService = jasmine.createSpyObj('AdminService', ['updateUserProfile']);

    await TestBed.configureTestingModule({
      imports: [UserProfileDialogComponent, ReactiveFormsModule, BrowserAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { title: 'Edit User', user: mockUser, isAdminEdit: true },
        },
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Initialization', () => {
    it('should populate forms with user data', () => {
      expect(component.profileForm.value.firstName).toBe('John');
      expect(component.profileForm.value.lastName).toBe('Doe');
      expect(component.profileForm.value.phoneNumber).toBe('+41 79 123 45 67');
      expect(component.addressForm.value.street).toBe('123 Main St');
      expect(component.addressForm.value.city).toBe('Zurich');
      expect(component.addressForm.value.postalCode).toBe('8001');
    });

    it('should enable admin fields for admin edit', () => {
      expect(component.profileForm.get('email')?.enabled).toBeTruthy();
      expect(component.profileForm.get('role')?.enabled).toBeTruthy();
      expect(component.profileForm.get('status')?.enabled).toBeTruthy();
    });

    it('should disable admin fields for non-admin edit', () => {
      // Create component with non-admin mode
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [UserProfileDialogComponent, ReactiveFormsModule, BrowserAnimationsModule],
        providers: [
          { provide: MatDialogRef, useValue: mockDialogRef },
          {
            provide: MAT_DIALOG_DATA,
            useValue: { title: 'Edit Profile', user: mockUser, isAdminEdit: false },
          },
          { provide: AdminService, useValue: mockAdminService },
        ],
      });

      const nonAdminFixture = TestBed.createComponent(UserProfileDialogComponent);
      const nonAdminComponent = nonAdminFixture.componentInstance;
      nonAdminFixture.detectChanges();

      expect(nonAdminComponent.profileForm.get('email')?.disabled).toBeTruthy();
      expect(nonAdminComponent.profileForm.get('role')?.disabled).toBeTruthy();
      expect(nonAdminComponent.profileForm.get('status')?.disabled).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', () => {
      component.profileForm.patchValue({
        firstName: '',
        lastName: '',
      });
      component.addressForm.patchValue({
        street: '',
        city: '',
        postalCode: '',
      });

      expect(component.profileForm.valid).toBeFalsy();
      expect(component.addressForm.valid).toBeFalsy();
      expect(component.isFormValid()).toBeFalsy();
    });

    it('should validate phone number format', () => {
      const phoneControl = component.profileForm.get('phoneNumber');

      // Valid phone numbers
      phoneControl?.setValue('+41 79 123 45 67');
      expect(phoneControl?.valid).toBeTruthy();

      phoneControl?.setValue('079 123 45 67');
      expect(phoneControl?.valid).toBeTruthy();

      // Invalid phone numbers
      phoneControl?.setValue('invalid phone');
      expect(phoneControl?.valid).toBeFalsy();

      phoneControl?.setValue('abc123');
      expect(phoneControl?.valid).toBeFalsy();
    });

    it('should validate email format', () => {
      const emailControl = component.profileForm.get('email');

      emailControl?.setValue('valid@example.com');
      expect(emailControl?.valid).toBeTruthy();

      emailControl?.setValue('invalid-email');
      expect(emailControl?.valid).toBeFalsy();
    });

    it('should validate max length constraints', () => {
      const firstNameControl = component.profileForm.get('firstName');
      const longString = 'a'.repeat(101);

      firstNameControl?.setValue(longString);
      expect(firstNameControl?.hasError('maxLength')).toBeTruthy();

      firstNameControl?.setValue('a'.repeat(100));
      expect(firstNameControl?.hasError('maxLength')).toBeFalsy();
    });
  });

  describe('Form Submission', () => {
    it('should submit valid form successfully', () => {
      mockAdminService.updateUserProfile.and.returnValue(of({ success: true, profile: mockUser }));

      component.profileForm.patchValue({
        firstName: 'Jane',
        lastName: 'Smith',
      });

      component.onSubmit();

      expect(mockAdminService.updateUserProfile).toHaveBeenCalledWith(
        '123',
        jasmine.objectContaining({
          firstName: 'Jane',
          lastName: 'Smith',
        })
      );

      expect(mockDialogRef.close).toHaveBeenCalledWith({ success: true, profile: mockUser });
    });

    it('should not submit invalid form', () => {
      component.profileForm.patchValue({
        firstName: '',
        lastName: '',
      });

      component.onSubmit();

      expect(mockAdminService.updateUserProfile).not.toHaveBeenCalled();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should handle submission errors', () => {
      const error = {
        error: {
          validationErrors: {
            firstName: 'Invalid first name',
          },
        },
      };

      mockAdminService.updateUserProfile.and.returnValue(throwError(error));

      component.onSubmit();

      expect(component.isLoading).toBeFalsy();
      expect(component.profileForm.get('firstName')?.hasError('serverValidation')).toBeTruthy();
    });

    it('should clean up undefined values before submission', () => {
      mockAdminService.updateUserProfile.and.returnValue(of({ success: true, profile: mockUser }));

      component.profileForm.patchValue({
        firstName: 'John',
        phoneNumber: '',
      });

      component.onSubmit();

      const callArgs = mockAdminService.updateUserProfile.calls.mostRecent().args[1];
      expect('phoneNumber' in callArgs).toBeFalsy();
    });

    it('should include address in submission', () => {
      mockAdminService.updateUserProfile.and.returnValue(of({ success: true, profile: mockUser }));

      component.addressForm.patchValue({
        street: '456 New St',
        city: 'Geneva',
        postalCode: '1200',
        country: 'Switzerland',
      });

      component.onSubmit();

      expect(mockAdminService.updateUserProfile).toHaveBeenCalledWith(
        '123',
        jasmine.objectContaining({
          homeAddress: {
            street: '456 New St',
            city: 'Geneva',
            postalCode: '1200',
            country: 'Switzerland',
          },
        })
      );
    });

    it('should include notification preferences in submission', () => {
      mockAdminService.updateUserProfile.and.returnValue(of({ success: true, profile: mockUser }));

      component.preferencesForm.patchValue({
        emailNotifications: false,
        requestUpdates: true,
        weeklyDigest: true,
      });

      component.onSubmit();

      expect(mockAdminService.updateUserProfile).toHaveBeenCalledWith(
        '123',
        jasmine.objectContaining({
          notificationPreferences: jasmine.objectContaining({
            email: false,
            requestUpdates: true,
            weeklyDigest: true,
          }),
        })
      );
    });

    it('should include privacy settings in submission', () => {
      mockAdminService.updateUserProfile.and.returnValue(of({ success: true, profile: mockUser }));

      component.preferencesForm.patchValue({
        profileVisibility: 'private',
        allowAnalytics: false,
      });

      component.onSubmit();

      expect(mockAdminService.updateUserProfile).toHaveBeenCalledWith(
        '123',
        jasmine.objectContaining({
          privacySettings: jasmine.objectContaining({
            profileVisibility: 'private',
            allowAnalytics: false,
          }),
        })
      );
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator during submission', () => {
      mockAdminService.updateUserProfile.and.returnValue(
        of({ success: true, profile: mockUser }).pipe(
          // Simulate delay
          new Promise(resolve => setTimeout(resolve, 100))
        )
      );

      component.onSubmit();
      expect(component.isLoading).toBeTruthy();

      // After completion
      fixture.whenStable().then(() => {
        expect(component.isLoading).toBeFalsy();
      });
    });

    it('should disable form during loading', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector('button[color="primary"]');
      expect(submitButton?.disabled).toBeTruthy();
    });
  });

  describe('Dialog Interaction', () => {
    it('should close dialog on cancel', () => {
      const cancelButton = fixture.nativeElement.querySelector('button[mat-dialog-close]');
      cancelButton?.click();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });

    it('should close dialog with result on successful submission', () => {
      const result = { success: true, profile: mockUser };
      mockAdminService.updateUserProfile.and.returnValue(of(result));

      component.onSubmit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(result);
    });
  });

  describe('Tab Navigation', () => {
    it('should have three tabs', () => {
      const tabs = fixture.nativeElement.querySelectorAll('mat-tab');
      expect(tabs.length).toBe(3);
    });

    it('should display correct tab labels', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Basic Information');
      expect(compiled.textContent).toContain('Address');
      expect(compiled.textContent).toContain('Preferences');
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      const firstNameField = fixture.nativeElement.querySelector('mat-form-field mat-label');
      expect(firstNameField?.textContent).toContain('First Name');
    });

    it('should have proper error messages', () => {
      component.profileForm.get('firstName')?.setValue('');
      component.profileForm.get('firstName')?.markAsTouched();
      fixture.detectChanges();

      const errorMessage = fixture.nativeElement.querySelector('mat-error');
      expect(errorMessage?.textContent).toContain('First name is required');
    });
  });
});
