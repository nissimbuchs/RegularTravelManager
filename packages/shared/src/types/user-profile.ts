/**
 * User Profile Management Types
 * Story 5.2 - User profile updates, password changes, and settings
 */

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  employeeNumber: string;
  role: 'employee' | 'manager' | 'administrator';
  status: 'active' | 'inactive' | 'pending';
  homeAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  homeCoordinates?: {
    latitude: number;
    longitude: number;
  };
  notificationPreferences?: NotificationPreferences;
  privacySettings?: PrivacySettings;
  lastUpdatedAt?: Date;
  lastLoginAt?: Date;
  emailVerifiedAt?: Date;
  profileUpdatedAt?: Date;
}

export interface UserProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  homeAddress?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  notificationPreferences?: NotificationPreferences;
  privacySettings?: PrivacySettings;
}

export interface AdminUserProfileUpdateRequest extends UserProfileUpdateRequest {
  email?: string;
  employeeNumber?: string;
  role?: 'employee' | 'manager' | 'administrator';
  status?: 'active' | 'inactive' | 'pending';
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordChangeValidation {
  currentPasswordValid: boolean;
  newPasswordComplexity: boolean;
  passwordsMatch: boolean;
  notRecentlyUsed: boolean;
  meetsCognitoPolicy: boolean;
}

export interface EmailChangeRequest {
  newEmail: string;
  password: string; // For security confirmation
}

export interface EmailChangeProcess {
  id: string;
  employeeId: string;
  currentEmail: string;
  newEmail: string;
  currentEmailToken?: string;
  newEmailToken?: string;
  currentEmailVerified: boolean;
  newEmailVerified: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface NotificationPreferences {
  email: boolean;
  requestUpdates: boolean;
  weeklyDigest: boolean;
  maintenanceAlerts: boolean;
  frequency?: 'immediate' | 'daily' | 'weekly';
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };
}

export interface PrivacySettings {
  profileVisibility: 'private' | 'team' | 'company';
  allowAnalytics: boolean;
  shareLocationData?: boolean;
  allowManagerAccess?: boolean;
  dataRetentionConsent?: boolean;
}

export interface ProfileChangeHistory {
  id: string;
  employeeId: string;
  changedFields: string[];
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  changeReason?: string;
  changedBy: string;
  changedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AddressChangeImpact {
  affectedRequests: number;
  distanceChanges: DistanceChange[];
  totalAllowanceImpact: number;
  requiresManagerNotification: boolean;
}

export interface DistanceChange {
  requestId: string;
  projectName: string;
  oldDistance: number;
  newDistance: number;
  oldAllowance: number;
  newAllowance: number;
  percentageChange: number;
}

export interface ProfileUpdateResponse {
  success: boolean;
  profile: UserProfile;
  addressChangeImpact?: AddressChangeImpact;
  validationErrors?: Record<string, string>;
}

export interface SecurityConfirmationRequest {
  confirmationType: 'password' | 'sms' | 'email';
  confirmationValue: string;
  criticalFields: string[];
}
