import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { signIn, signOut, getCurrentUser, fetchAuthSession, AuthUser } from '@aws-amplify/auth';
import { environment } from '../../../environments/environment';

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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.currentUser$.pipe(map(user => !!user));

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    // Check if we should use mock authentication
    if (environment.cognito.useMockAuth) {
      console.log('🧪 Using mock authentication mode');
      this.initializeMockAuth();
      return;
    }
    
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      
      if (user && session.tokens) {
        const userData = this.mapAuthUserToUser(user, session.tokens);
        this.currentUserSubject.next(userData);
      }
    } catch (error) {
      console.log('⚠️ Real authentication failed, falling back to mock auth', error);
      // Fallback to mock authentication
      if (window.location.hostname === 'localhost') {
        this.initializeMockAuth();
      } else {
        this.currentUserSubject.next(null);
      }
    }
  }

  private initializeMockAuth(): void {
    // Check for user override in localStorage for testing (defaults to employee1)
    const userOverride = localStorage.getItem('mockUser') as 'employee1' | 'employee2' | 'manager1' | 'manager2' | null;
    const selectedUser = userOverride || 'employee1';
    
    // Production-matching test users
    const mockUsers = {
      employee1: {
        id: 'employee1-cognito-id',
        email: 'employee1@company.com',
        name: 'John Employee',
        role: 'employee' as const,
        groups: ['employees']
      },
      employee2: {
        id: 'employee2-cognito-id', 
        email: 'employee2@company.com',
        name: 'Jane Worker',
        role: 'employee' as const,
        groups: ['employees']
      },
      manager1: {
        id: 'manager1-cognito-id',
        email: 'manager1@company.com', 
        name: 'Bob Manager',
        role: 'manager' as const,
        groups: ['managers', 'employees']
      },
      manager2: {
        id: 'manager2-cognito-id',
        email: 'manager2@company.com',
        name: 'Alice Director', 
        role: 'manager' as const,
        groups: ['managers', 'employees']
      }
    };
    
    const mockUser = mockUsers[selectedUser];
    this.currentUserSubject.next(mockUser);
    
    console.log(`🧪 Mock authentication initialized with user: ${selectedUser}`, mockUser);
    console.log('💡 To change user, run: localStorage.setItem("mockUser", "employee1|employee2|manager1|manager2"); window.location.reload()');
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    // Handle mock authentication
    if (environment.cognito.useMockAuth) {
      return this.mockLogin(credentials);
    }
    
    // Handle real Cognito authentication
    return from(signIn({
      username: credentials.email,
      password: credentials.password
    })).pipe(
      switchMap(async () => {
        // After successful sign in, get the user data
        const user = await getCurrentUser();
        const session = await fetchAuthSession();
        
        if (!user || !session.tokens?.accessToken) {
          throw new Error('Failed to get user data after login');
        }

        const userData = this.mapAuthUserToUser(user, session.tokens);
        this.currentUserSubject.next(userData);
        
        return {
          user: userData,
          accessToken: session.tokens.accessToken.toString()
        };
      }),
      catchError(error => {
        console.error('Login failed:', error);
        return throwError(() => new Error(error.message || 'Login failed'));
      })
    );
  }

  private mockLogin(credentials: LoginCredentials): Observable<AuthResponse> {
    // Mock users with their credentials
    const mockUsers = {
      'employee1@company.com': {
        id: 'employee1-cognito-id',
        email: 'employee1@company.com',
        name: 'John Employee',
        role: 'employee' as const,
        groups: ['employees']
      },
      'employee2@company.com': {
        id: 'employee2-cognito-id', 
        email: 'employee2@company.com',
        name: 'Jane Worker',
        role: 'employee' as const,
        groups: ['employees']
      },
      'manager1@company.com': {
        id: 'manager1-cognito-id',
        email: 'manager1@company.com', 
        name: 'Bob Manager',
        role: 'manager' as const,
        groups: ['managers', 'employees']
      },
      'manager2@company.com': {
        id: 'manager2-cognito-id',
        email: 'manager2@company.com',
        name: 'Alice Director', 
        role: 'manager' as const,
        groups: ['managers', 'employees']
      }
    };

    const mockUser = mockUsers[credentials.email as keyof typeof mockUsers];
    
    if (!mockUser) {
      return throwError(() => new Error('User not found. Use: employee1@company.com, employee2@company.com, manager1@company.com, or manager2@company.com'));
    }

    // Simulate async login delay
    return from(new Promise<AuthResponse>(resolve => {
      setTimeout(() => {
        this.currentUserSubject.next(mockUser);
        console.log(`🧪 Mock login successful for: ${mockUser.name}`);
        
        resolve({
          user: mockUser,
          accessToken: 'mock-jwt-token-' + mockUser.id
        });
      }, 500); // 500ms delay to simulate network request
    }));
  }

  logout(): Observable<void> {
    if (environment.cognito.useMockAuth) {
      // Mock logout
      return from(new Promise<void>(resolve => {
        this.currentUserSubject.next(null);
        console.log('🧪 Mock logout successful');
        resolve();
      }));
    }

    // Real logout
    return from(signOut()).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
      }),
      catchError(error => {
        console.error('Logout failed:', error);
        // Even if logout fails, clear local state
        this.currentUserSubject.next(null);
        return throwError(() => new Error(error.message || 'Logout failed'));
      })
    );
  }

  refreshToken(): Observable<string> {
    if (environment.cognito.useMockAuth) {
      // Mock refresh token
      const currentUser = this.currentUserSubject.value;
      if (currentUser) {
        return from(Promise.resolve('mock-jwt-token-' + currentUser.id));
      } else {
        return throwError(() => new Error('No user logged in'));
      }
    }

    return from(fetchAuthSession({ forceRefresh: true })).pipe(
      map(session => {
        if (!session.tokens?.accessToken) {
          throw new Error('No access token available');
        }
        return session.tokens.accessToken.toString();
      }),
      catchError(error => {
        console.error('Token refresh failed:', error);
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
      name: `${tokens.idToken?.payload?.given_name || ''} ${tokens.idToken?.payload?.family_name || ''}`.trim() || 'User',
      role: role,
      groups: groups
    };
  }

  hasRole(role: 'employee' | 'manager' | 'admin'): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => user?.role === role || false)
    );
  }

  hasAnyRole(roles: ('employee' | 'manager' | 'admin')[]): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => user ? roles.includes(user.role) : false)
    );
  }
}