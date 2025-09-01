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
