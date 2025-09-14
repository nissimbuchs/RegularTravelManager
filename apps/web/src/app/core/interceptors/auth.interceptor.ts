import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap, catchError, takeUntil, timeout } from 'rxjs/operators';
import { throwError, EMPTY, Subject } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AngularCleanupService } from '../services/angular-cleanup.service';

// Global cleanup signal for all HTTP requests
let globalHttpCleanup$ = new Subject<void>();

// Function to trigger cleanup of all HTTP requests (called during logout)
export function triggerHttpCleanup(): void {
  globalHttpCleanup$.next();
  globalHttpCleanup$.complete();
  globalHttpCleanup$ = new Subject<void>();
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Phase 2: Add cleanup and timeout to all HTTP requests
  return authService.getCurrentUser().pipe(
    takeUntil(globalHttpCleanup$), // Cancel if global cleanup triggered
    timeout(30000), // 30 second timeout to prevent hanging requests
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
          return next(authReq).pipe(takeUntil(globalHttpCleanup$), timeout(30000));
        }

        // Production - get current token and add to request
        return authService.getCurrentAccessToken().pipe(
          takeUntil(globalHttpCleanup$),
          timeout(10000), // Token request timeout
          switchMap(token => {
            const authReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`,
              },
            });
            return next(authReq).pipe(takeUntil(globalHttpCleanup$), timeout(30000));
          }),
          catchError(() => {
            // Current token failed - try to refresh token once
            return authService.refreshToken().pipe(
              takeUntil(globalHttpCleanup$),
              timeout(10000), // Refresh token timeout
              switchMap(refreshedToken => {
                const authReq = req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${refreshedToken}`,
                  },
                });
                return next(authReq).pipe(takeUntil(globalHttpCleanup$), timeout(30000));
              }),
              catchError(refreshError => {
                // Token refresh also failed - return original error
                console.warn('Token refresh failed during HTTP request:', refreshError);
                return throwError(() => refreshError);
              })
            );
          })
        );
      } else {
        // Allow config file requests to proceed (needed for app initialization)
        if (req.url.includes('/assets/config/')) {
          return next(req).pipe(takeUntil(globalHttpCleanup$), timeout(30000));
        }

        // Allow authentication endpoints to proceed without user authentication
        if (
          req.url.includes('/auth/register') ||
          req.url.includes('/auth/verify-email') ||
          req.url.includes('/auth/resend-verification') ||
          req.url.includes('/auth/login')
        ) {
          return next(req).pipe(takeUntil(globalHttpCleanup$), timeout(30000));
        }

        // No user authenticated - cancel request to prevent unauthorized errors
        return EMPTY;
      }
    }),
    // Add error handling at the top level to catch any unexpected errors
    catchError(error => {
      // Enhanced error handling to prevent persistent error messages
      if (error.name === 'TimeoutError') {
        return EMPTY; // Cancel timed out requests
      }

      // Check if cleanup was triggered
      if (globalHttpCleanup$.closed) {
        return EMPTY; // Cancel requests during cleanup
      }

      // Only log if it's not an auth-related error during logout
      if (!(error.status === 401 || error.status === 403)) {
        console.warn('Auth interceptor error:', error);
      }

      // For auth errors when user is logged out, return EMPTY instead of proceeding
      const currentUser = authService.getCurrentUser();
      return currentUser.pipe(
        switchMap(user => {
          if (!user && (error.status === 401 || error.status === 403)) {
            return EMPTY; // Suppress auth errors when logged out
          }
          return next(req);
        })
      );
    })
  );
};
