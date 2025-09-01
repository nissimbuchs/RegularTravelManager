import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Don't show loading for auth-related requests to avoid UI flicker
  const skipLoading = req.url.includes('/auth') || req.url.includes('/token');

  if (!skipLoading) {
    loadingService.setLoading(true);
  }

  return next(req).pipe(
    finalize(() => {
      if (!skipLoading) {
        loadingService.setLoading(false);
      }
    })
  );
};
