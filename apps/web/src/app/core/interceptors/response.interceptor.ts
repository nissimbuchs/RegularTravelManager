import {
  HttpInterceptorFn,
  HttpEventType,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { map, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

/**
 * Response Interceptor
 *
 * Automatically unwraps API responses from the backend:
 *
 * Success responses: { "success": true, "data": {...}, "timestamp": "...", "requestId": "..." }
 * Error responses: { "error": { "code": "...", "message": "...", "timestamp": "...", "requestId": "..." } }
 *
 * This interceptor unwraps both success and error responses to provide direct access to data/error content.
 */
export const responseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map(event => {
      // Only process successful HTTP responses
      if (event.type === HttpEventType.Response) {
        const response = event as HttpResponse<any>;

        // Check if response has the wrapped success format
        if (
          response.body &&
          typeof response.body === 'object' &&
          'success' in response.body &&
          'data' in response.body
        ) {
          // Clone the response and replace body with unwrapped data
          return response.clone({
            body: response.body.data,
          });
        }
      }

      return event;
    }),
    catchError((error: HttpErrorResponse) => {
      // Unwrap error responses that have the wrapped error format
      if (
        error.error &&
        typeof error.error === 'object' &&
        'error' in error.error &&
        typeof error.error.error === 'object'
      ) {
        // Create a new error with unwrapped error details
        const unwrappedError = new HttpErrorResponse({
          error: error.error.error, // Unwrap the nested error object
          headers: error.headers,
          status: error.status,
          statusText: error.statusText,
          url: error.url || undefined,
        });

        return throwError(() => unwrappedError);
      }

      // Return original error if not in wrapped format
      return throwError(() => error);
    })
  );
};
