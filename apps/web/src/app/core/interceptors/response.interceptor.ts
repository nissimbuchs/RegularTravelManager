import { HttpInterceptorFn, HttpEventType, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs/operators';

/**
 * Response Interceptor
 *
 * Automatically unwraps API responses from the backend which come in the format:
 * {
 *   "success": true,
 *   "data": { ...actual_data... },
 *   "timestamp": "...",
 *   "requestId": "..."
 * }
 *
 * This interceptor extracts the 'data' field automatically so services
 * can work with the actual data directly.
 */
export const responseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map(event => {
      // Only process successful HTTP responses
      if (event.type === HttpEventType.Response) {
        const response = event as HttpResponse<any>;

        // Check if response has the wrapped format
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
    })
  );
};
