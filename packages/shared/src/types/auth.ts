// Authentication and registration types
import { Address } from '../types';

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  homeAddress: Address;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface RegisterResponse {
  userId: string;
  email: string;
  verificationRequired: boolean;
  message: string;
}

export interface VerifyEmailRequest {
  email: string;
  verificationToken: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
}

export interface RegistrationStatusResponse {
  email: string;
  isVerified: boolean;
  registrationComplete: boolean;
  accountEnabled: boolean;
}

export interface VerificationToken {
  id: string;
  email: string;
  token: string;
  expiresAt: Date;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface VerificationEmailTemplate {
  subject: string;
  templateData: {
    firstName: string;
    verificationUrl: string;
    expirationHours: number;
    supportEmail: string;
  };
}