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
        // For development with mock auth, skip token refresh
        if (window.location.hostname === 'localhost' && user.id === 'test-user-id') {
          // Mock development scenario - proceed without auth header
          return next(req);
        }
        
        // Get current token and add to request
        return authService.refreshToken().pipe(
          switchMap(token => {
            const authReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`
              }
            });
            return next(authReq);
          }),
          catchError(error => {
            // Token refresh failed, logout user
            authService.logout().subscribe();
            router.navigate(['/login']);
            return throwError(() => error);
          })
        );
      } else {
        // No user, proceed without auth header
        return next(req);
      }
    })
  );
};