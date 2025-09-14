import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import {
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
} from '@rtm/shared';

@Injectable({
  providedIn: 'root',
})
export class RegistrationService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = this.configService.apiUrl;
  }

  /**
   * Register a new user
   */
  register(
    registerData: RegisterRequest
  ): Observable<{ success: boolean; data: RegisterResponse }> {
    return this.http.post<{ success: boolean; data: RegisterResponse }>(
      `${this.apiUrl}/auth/register`,
      registerData
    );
  }

  /**
   * Verify email with token
   */
  verifyEmail(
    verificationData: VerifyEmailRequest
  ): Observable<{ success: boolean; data: VerifyEmailResponse }> {
    return this.http.post<{ success: boolean; data: VerifyEmailResponse }>(
      `${this.apiUrl}/auth/verify-email`,
      verificationData
    );
  }

  /**
   * Resend verification email
   */
  resendVerification(
    resendData: ResendVerificationRequest
  ): Observable<{ success: boolean; data: ResendVerificationResponse }> {
    return this.http.post<{ success: boolean; data: ResendVerificationResponse }>(
      `${this.apiUrl}/auth/resend-verification`,
      resendData
    );
  }
}
