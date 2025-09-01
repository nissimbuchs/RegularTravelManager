import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const managerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.hasRole('manager').pipe(
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
