import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { signIn, signOut, getCurrentUser, fetchAuthSession, AuthUser } from '@aws-amplify/auth';

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
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      
      if (user && session.tokens) {
        const userData = this.mapAuthUserToUser(user, session.tokens);
        this.currentUserSubject.next(userData);
      }
    } catch (error) {
      // User not authenticated, which is fine for initialization
      this.currentUserSubject.next(null);
    }
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
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

  logout(): Observable<void> {
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