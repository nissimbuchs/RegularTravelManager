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
 * Transforms API responses from the backend for service compatibility:
 *
 * Backend format: { "success": true, "data": {...}, "timestamp": "...", "requestId": "..." }
 * Service format: { "data": {...} }
 * Error responses: { "error": { "code": "...", "message": "...", "timestamp": "...", "requestId": "..." } }
 *
 * This interceptor preserves the {data: T} wrapper that services expect while removing metadata.
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
          // Clone the response and preserve {data: T} wrapper for service compatibility
          return response.clone({
            body: { data: response.body.data },
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
