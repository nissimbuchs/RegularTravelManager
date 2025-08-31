import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.hasRole('admin').pipe(
    take(1),
    map(hasRole => {
      if (!hasRole) {
        router.navigate(['/unauthorized']);
        return false;
      }
      return true;
    })
  );
};