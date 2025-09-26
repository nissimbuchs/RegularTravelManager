import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, takeUntil, timeout, switchMap } from 'rxjs/operators';
import { throwError, timer, EMPTY, Subject } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../services/auth.service';
import { TranslationService } from '../services/translation.service';
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
  const translationService = inject(TranslationService);

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
          // If cleanup was triggered, suppress error
          if (globalErrorCleanup$.closed) {
            return EMPTY;
          }

          // For auth endpoints, always pass through errors even if user not authenticated
          if (req.url.includes('/auth')) {
            return throwError(() => error);
          }

          // For other endpoints, suppress error if user not authenticated
          if (!user) {
            return EMPTY;
          }

          let errorMessage = translationService.translateSync('errors.general.unexpected');

          if (error.error instanceof ErrorEvent) {
            // Client-side error
            errorMessage = translationService.translateSync('errors.client.general', { message: error.error.message });
          } else {
            // Server-side error
            switch (error.status) {
              case 400:
                errorMessage = translationService.translateSync('errors.http.bad_request');
                break;
              case 401:
                errorMessage = translationService.translateSync('errors.http.unauthorized');
                break;
              case 403:
                errorMessage = translationService.translateSync('errors.http.forbidden');
                break;
              case 404:
                errorMessage = translationService.translateSync('errors.http.not_found');
                break;
              case 500:
                errorMessage = translationService.translateSync('errors.http.server_error');
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
          if (
            user &&
            !req.url.includes('/auth') &&
            error.status !== 401 &&
            !globalErrorCleanup$.closed
          ) {
            snackBar.open(errorMessage, translationService.translateSync('common.actions.close'), {
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
