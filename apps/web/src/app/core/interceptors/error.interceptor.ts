import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, takeUntil, timeout, switchMap } from 'rxjs/operators';
import { throwError, timer, EMPTY, Subject } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../services/auth.service';
import { User } from '../services/auth.service';

// Global error cleanup signal
let globalErrorCleanup$ = new Subject<void>();

// Function to trigger cleanup of error handling (called during logout)
export function triggerErrorCleanup(): void {
  globalErrorCleanup$.next();
  globalErrorCleanup$.complete();
  globalErrorCleanup$ = new Subject<void>();
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const authService = inject(AuthService);

  return next(req).pipe(
    takeUntil(globalErrorCleanup$), // Cancel if error cleanup triggered
    retry({
      count: 2,
      delay: (error, retryCount) => {
        // Don't retry if cleanup was triggered
        if (globalErrorCleanup$.closed) {
          throw error; // Stop retrying during cleanup
        }
        
        // Retry after 1 second, then 2 seconds
        if (error instanceof HttpErrorResponse && error.status >= 500) {
          return timer(retryCount * 1000).pipe(takeUntil(globalErrorCleanup$));
        }
        throw error;
      },
    }),
    catchError((error: HttpErrorResponse) => {
      // Check if user is authenticated before showing error messages
      return authService.getCurrentUser().pipe(
        takeUntil(globalErrorCleanup$),
        timeout(1000), // Quick timeout for user check
        catchError(() => EMPTY), // If user check fails, assume logged out
        switchMap((user: User | null) => {
          // If cleanup was triggered or user is not authenticated, suppress error
          if (globalErrorCleanup$.closed || !user) {
            return EMPTY;
          }

          let errorMessage = 'An unexpected error occurred';

          if (error.error instanceof ErrorEvent) {
            // Client-side error
            errorMessage = `Error: ${error.error.message}`;
          } else {
            // Server-side error
            switch (error.status) {
              case 400:
                errorMessage = 'Bad request. Please check your input.';
                break;
              case 401:
                errorMessage = 'You are not authorized to perform this action.';
                break;
              case 403:
                errorMessage = "Access forbidden. You don't have permission.";
                break;
              case 404:
                errorMessage = 'The requested resource was not found.';
                break;
              case 500:
                errorMessage = 'Internal server error. Please try again later.';
                break;
              default:
                errorMessage = error.error?.message || errorMessage;
            }
          }

          // Enhanced condition for showing error messages
          // Only show errors if:
          // 1. User is authenticated
          // 2. Not an auth URL
          // 3. Not a 401 error (handled by auth interceptor)
          // 4. Cleanup hasn't been triggered
          if (user && !req.url.includes('/auth') && error.status !== 401 && !globalErrorCleanup$.closed) {
            snackBar.open(errorMessage, 'Close', {
              duration: 5000,
              panelClass: ['error-snackbar'],
            });
          }

          return throwError(() => error);
        })
      );
    })
  );
};
