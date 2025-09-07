import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getCurrentUser().pipe(
    switchMap(user => {
      if (user) {
        // For development with mock auth, add mock headers for local API
        if (window.location.hostname === 'localhost') {
          const authReq = req.clone({
            setHeaders: {
              'x-user-id': user.id,
              'x-user-email': user.email,
              'x-user-groups': user.groups.join(','),
            },
          });
          return next(authReq);
        }

        // Production - get current token and add to request
        return authService.refreshToken().pipe(
          switchMap(token => {
            const authReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`,
              },
            });
            return next(authReq);
          }),
          catchError(error => {
            // Token refresh failed - just return error without recursive logout
            // The logout should only be initiated by user action, not by failed HTTP requests
            console.warn('Token refresh failed during HTTP request:', error);
            return throwError(() => error);
          })
        );
      } else {
        // No user authenticated - proceed without auth header
        // This handles the case where HTTP requests are still being processed during/after logout
        return next(req).pipe(
          catchError(error => {
            // Silently handle auth errors when user is not logged in
            // This prevents error logging for expected 401/403 errors during logout
            if (error.status === 401 || error.status === 403) {
              // Don't log these as they're expected when user is logged out
              return throwError(() => error);
            }
            // Log other unexpected errors
            console.warn('HTTP request failed during logged out state:', error);
            return throwError(() => error);
          })
        );
      }
    }),
    // Add error handling at the top level to catch any unexpected errors
    catchError(error => {
      // Only log if it's not an auth-related error during logout
      if (!(error.status === 401 || error.status === 403)) {
        console.warn('Auth interceptor error:', error);
      }
      return next(req);
    })
  );
};
