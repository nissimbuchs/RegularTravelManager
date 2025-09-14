import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { signIn, signOut, getCurrentUser, fetchAuthSession, AuthUser } from '@aws-amplify/auth';
import { ConfigService } from './config.service';
import { MatDialog } from '@angular/material/dialog';
import { AngularCleanupService } from './angular-cleanup.service';
import { triggerHttpCleanup } from '../interceptors/auth.interceptor';
import { triggerErrorCleanup } from '../interceptors/error.interceptor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'employee' | 'manager' | 'admin';
  groups: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

interface TokenCache {
  token: string;
  expiresAt: number; // Unix timestamp
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.currentUser$.pipe(map(user => !!user));
  private dialog = inject(MatDialog);
  private configService = inject(ConfigService);
  private angularCleanupService = inject(AngularCleanupService);

  // Token caching with 5-minute buffer before expiration
  private tokenCache: TokenCache | null = null;
  private readonly TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize auth after config is loaded
    this.initializeAuthWhenReady();
  }

  private cacheToken(token: string, expiresAt?: number): void {
    // Default to 1 hour expiration if not provided (from Cognito config)
    const defaultExpirationMs = 60 * 60 * 1000; // 1 hour
    const expirationTime = expiresAt || Date.now() + defaultExpirationMs;

    this.tokenCache = {
      token,
      expiresAt: expirationTime,
    };

    console.log('🔐 Token cached until:', new Date(expirationTime).toISOString());
  }

  private getCachedToken(): string | null {
    if (!this.tokenCache) {
      return null;
    }

    const now = Date.now();
    const expiresWithBuffer = this.tokenCache.expiresAt - this.TOKEN_EXPIRY_BUFFER_MS;

    if (now >= expiresWithBuffer) {
      console.log('🔐 Cached token expired or about to expire, clearing cache');
      this.clearTokenCache();
      return null;
    }

    console.log(
      '🔐 Using cached token (expires in',
      Math.floor((this.tokenCache.expiresAt - now) / 1000),
      'seconds)'
    );
    return this.tokenCache.token;
  }

  private clearTokenCache(): void {
    this.tokenCache = null;
    console.log('🔐 Token cache cleared');
  }

  private async initializeAuthWhenReady(): Promise<void> {
    // Wait for configuration to be loaded
    await this.configService.waitForConfig();
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    // Check if we should use mock authentication
    if (this.configService.cognitoConfig.useMockAuth) {
      console.log('🧪 Using mock authentication mode');

      // Clear any existing authentication state when switching to mock mode
      this.clearTokenCache();
      this.currentUserSubject.next(null);

      // Also clear any AWS Amplify cached sessions
      try {
        await signOut();
        console.log('🧪 Cleared existing Cognito session for mock mode');
      } catch (error) {
        // Ignore errors - user might not have been signed in
        console.log('🧪 No existing Cognito session to clear');
      }
      return;
    }

    try {
      // Only check for existing session, don't force authentication
      const user = await getCurrentUser();
      const session = await fetchAuthSession();

      if (user && session.tokens) {
        const userData = this.mapAuthUserToUser(user, session.tokens);
        this.currentUserSubject.next(userData);
        console.log('✅ Restored existing authentication session');
      } else {
        this.currentUserSubject.next(null);
      }
    } catch (error) {
      // This is expected for unauthenticated users - don't log as error
      console.log('ℹ️ No existing authentication session found');
      this.currentUserSubject.next(null);
    }
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    // Handle mock authentication
    if (this.configService.cognitoConfig.useMockAuth) {
      return this.mockLogin(credentials);
    }

    // Handle real Cognito authentication - sign out first if already authenticated
    return from(
      signOut()
        .then(() =>
          signIn({
            username: credentials.email,
            password: credentials.password,
          })
        )
        .catch(async () => {
          // If signOut fails (e.g., no user signed in), proceed with signIn
          return signIn({
            username: credentials.email,
            password: credentials.password,
          });
        })
    ).pipe(
      switchMap(async () => {
        // After successful sign in, get the user data
        const user = await getCurrentUser();
        const session = await fetchAuthSession();

        if (!user || !session.tokens?.accessToken) {
          throw new Error('Failed to get user data after login');
        }

        const userData = this.mapAuthUserToUser(user, session.tokens);
        this.currentUserSubject.next(userData);

        const token = session.tokens.accessToken.toString();

        // Cache the token after successful login
        let expiresAt: number | undefined;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp) {
            expiresAt = payload.exp * 1000; // Convert from seconds to milliseconds
          }
        } catch (e) {
          console.warn('Could not parse token expiration during login, using default');
        }

        this.cacheToken(token, expiresAt);
        console.log('✅ Login successful, token cached');

        return {
          user: userData,
          accessToken: token,
        };
      }),
      catchError(error => {
        console.error('Login failed:', error);
        return throwError(() => new Error(error.message || 'Login failed'));
      })
    );
  }

  private mockLogin(credentials: LoginCredentials): Observable<AuthResponse> {
    // Mock users with predictable UUID format IDs matching backend database
    const mockUsers = {
      'admin1@company.ch': {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin1@company.ch',
        name: 'Hans Zimmermann',
        role: 'admin' as const,
        groups: ['administrators', 'managers', 'employees'],
      },
      'admin2@company.ch': {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'admin2@company.ch',
        name: 'Maria Weber',
        role: 'admin' as const,
        groups: ['administrators', 'managers', 'employees'],
      },
      'manager1@company.ch': {
        id: '33333333-3333-3333-3333-333333333333',
        email: 'manager1@company.ch',
        name: 'Thomas Müller',
        role: 'manager' as const,
        groups: ['managers', 'employees'],
      },
      'manager2@company.ch': {
        id: '44444444-4444-4444-4444-444444444444',
        email: 'manager2@company.ch',
        name: 'Sophie Dubois',
        role: 'manager' as const,
        groups: ['managers', 'employees'],
      },
      'employee1@company.ch': {
        id: '55555555-5555-5555-5555-555555555555',
        email: 'employee1@company.ch',
        name: 'Anna Schneider',
        role: 'employee' as const,
        groups: ['employees'],
      },
      'employee2@company.ch': {
        id: '66666666-6666-6666-6666-666666666666',
        email: 'employee2@company.ch',
        name: 'Marco Rossi',
        role: 'employee' as const,
        groups: ['employees'],
      },
      'employee3@company.ch': {
        id: '77777777-7777-7777-7777-777777777777',
        email: 'employee3@company.ch',
        name: 'Lisa Meier',
        role: 'employee' as const,
        groups: ['employees'],
      },
      'employee4@company.ch': {
        id: '88888888-8888-8888-8888-888888888888',
        email: 'employee4@company.ch',
        name: 'Pierre Martin',
        role: 'employee' as const,
        groups: ['employees'],
      },
      'employee5@company.ch': {
        id: '99999999-9999-9999-9999-999999999999',
        email: 'employee5@company.ch',
        name: 'Julia Fischer',
        role: 'employee' as const,
        groups: ['employees'],
      },
      'employee6@company.ch': {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        email: 'employee6@company.ch',
        name: 'Michael Keller',
        role: 'employee' as const,
        groups: ['employees'],
      },
    };

    const mockUser = mockUsers[credentials.email as keyof typeof mockUsers];

    if (!mockUser) {
      return throwError(
        () =>
          new Error(
            'User not found. Use: employee1@company.ch, employee2@company.ch, employee3@company.ch, manager1@company.ch, manager2@company.ch, admin1@company.ch, or admin2@company.ch'
          )
      );
    }

    // Simulate async login delay
    return from(
      new Promise<AuthResponse>(resolve => {
        setTimeout(() => {
          this.currentUserSubject.next(mockUser);
          console.log(`🧪 Mock login successful for: ${mockUser.name}`);

          resolve({
            user: mockUser,
            accessToken: 'mock-jwt-token-' + mockUser.id,
          });
        }, 500); // 500ms delay to simulate network request
      })
    );
  }

  logout(): Observable<void> {
    // Trigger HTTP and error cleanup
    triggerHttpCleanup();
    triggerErrorCleanup();

    // Force cleanup Angular internal subscriptions
    this.angularCleanupService.forceCleanupAngularInternals();

    // Close all open dialogs before logout to prevent persistence issues
    this.dialog.closeAll();

    // Execute service cleanups to stop background operations
    this.executeServiceCleanups();

    if (this.configService.cognitoConfig.useMockAuth) {
      // Mock logout
      return from(
        new Promise<void>(resolve => {
          this.clearTokenCache(); // Clear token cache
          this.currentUserSubject.next(null);
          console.log('🧪 Mock logout successful');
          resolve();
        })
      );
    }

    // Real logout
    return from(signOut()).pipe(
      tap(() => {
        this.clearTokenCache(); // Clear token cache
        this.currentUserSubject.next(null);
        console.log('✅ Logout successful');
      }),
      catchError(error => {
        console.error('Logout failed:', error);
        // Even if logout fails, clear local state
        this.clearTokenCache(); // Clear token cache even on error
        this.currentUserSubject.next(null);
        return throwError(() => new Error(error.message || 'Logout failed'));
      })
    );
  }

  getCurrentAccessToken(): Observable<string> {
    if (this.configService.cognitoConfig.useMockAuth) {
      // Mock current token
      const currentUser = this.currentUserSubject.value;
      if (currentUser) {
        return from(Promise.resolve('mock-jwt-token-' + currentUser.id));
      } else {
        return throwError(() => new Error('No user logged in'));
      }
    }

    // Check cache first
    const cachedToken = this.getCachedToken();
    if (cachedToken) {
      return from(Promise.resolve(cachedToken));
    }

    // Cache miss - fetch from Cognito and cache result
    return from(fetchAuthSession()).pipe(
      map(session => {
        if (!session.tokens?.accessToken) {
          throw new Error('No access token available');
        }

        const token = session.tokens.accessToken.toString();

        // Extract expiration from JWT token and cache it
        let expiresAt: number | undefined;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp) {
            expiresAt = payload.exp * 1000; // Convert from seconds to milliseconds
          }
        } catch (e) {
          console.warn('Could not parse token expiration, using default');
        }

        this.cacheToken(token, expiresAt);
        return token;
      }),
      catchError(error => {
        console.error('Failed to get current access token:', error);
        this.clearTokenCache(); // Clear cache on error
        return throwError(() => new Error('Failed to get access token'));
      })
    );
  }

  refreshToken(): Observable<string> {
    if (this.configService.cognitoConfig.useMockAuth) {
      // Mock refresh token
      const currentUser = this.currentUserSubject.value;
      if (currentUser) {
        return from(Promise.resolve('mock-jwt-token-' + currentUser.id));
      } else {
        return throwError(() => new Error('No user logged in'));
      }
    }

    // Clear existing cache before refreshing
    this.clearTokenCache();

    return from(fetchAuthSession({ forceRefresh: true })).pipe(
      map(session => {
        if (!session.tokens?.accessToken) {
          throw new Error('No access token available');
        }

        const token = session.tokens.accessToken.toString();

        // Extract expiration from JWT token and cache it
        let expiresAt: number | undefined;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp) {
            expiresAt = payload.exp * 1000; // Convert from seconds to milliseconds
          }
        } catch (e) {
          console.warn('Could not parse token expiration during refresh, using default');
        }

        this.cacheToken(token, expiresAt);
        console.log('🔄 Token refreshed and cached successfully');
        return token;
      }),
      catchError(error => {
        console.error('Token refresh failed:', error);
        this.clearTokenCache(); // Clear cache on refresh failure
        this.logout().subscribe(); // Auto logout on refresh failure
        return throwError(() => new Error('Token refresh failed'));
      })
    );
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser$;
  }

  private mapAuthUserToUser(authUser: AuthUser, tokens: any): User {
    const groups = tokens.accessToken?.payload['cognito:groups'] || [];

    // Determine role based on group membership (admin > manager > employee)
    let role: 'employee' | 'manager' | 'admin' = 'employee';
    if (groups.includes('administrators')) {
      role = 'admin';
    } else if (groups.includes('managers')) {
      role = 'manager';
    }

    return {
      id: authUser.userId,
      email: authUser.signInDetails?.loginId || '',
      name:
        `${tokens.idToken?.payload?.given_name || ''} ${tokens.idToken?.payload?.family_name || ''}`.trim() ||
        'User',
      role: role,
      groups: groups,
    };
  }

  hasRole(role: 'employee' | 'manager' | 'admin'): Observable<boolean> {
    return this.currentUser$.pipe(map(user => user?.role === role || false));
  }

  hasAnyRole(roles: ('employee' | 'manager' | 'admin')[]): Observable<boolean> {
    return this.currentUser$.pipe(map(user => (user ? roles.includes(user.role) : false)));
  }

  /**
   * Execute service cleanups to stop background operations
   * Called during logout to prevent subscription persistence
   */
  private executeServiceCleanups(): void {
    console.log('🧹 Executing service cleanup operations...');

    try {
      // Dynamically import and cleanup ProjectService
      import('./project.service')
        .then(({ ProjectService }) => {
          const projectService = inject(ProjectService);
          projectService.cleanup();
        })
        .catch(() => {
          // Service may not be instantiated, which is fine
        });
    } catch (error) {
      console.warn('ProjectService cleanup failed:', error);
    }

    try {
      // Dynamically import and cleanup ManagerDashboardService
      import('../../features/manager/services/manager-dashboard.service')
        .then(({ ManagerDashboardService }) => {
          const managerService = inject(ManagerDashboardService);
          managerService.cleanup();
        })
        .catch(() => {
          // Service may not be instantiated, which is fine
        });
    } catch (error) {
      console.warn('ManagerDashboardService cleanup failed:', error);
    }

    console.log('✅ Service cleanup operations completed');
  }

  /**
   * Force clear all authentication cache and state
   * Useful for debugging or when switching between auth modes
   */
  async forceCleanAuthState(): Promise<void> {
    console.log('🔄 Force clearing all authentication state...');

    // Execute service cleanups first
    this.executeServiceCleanups();

    // Clear in-memory cache
    this.clearTokenCache();
    this.currentUserSubject.next(null);

    // Clear AWS Amplify sessions
    try {
      await signOut();
      console.log('✅ Cleared Cognito session');
    } catch (error) {
      console.log('ℹ️ No Cognito session to clear');
    }

    // Clear browser storage (localStorage, sessionStorage)
    try {
      localStorage.clear();
      sessionStorage.clear();
      console.log('✅ Cleared browser storage');
    } catch (error) {
      console.log('⚠️ Could not clear browser storage');
    }

    console.log('✅ Authentication state cleared - please refresh the page');
  }
}
