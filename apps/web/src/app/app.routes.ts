import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/employee/travel-request',
    pathMatch: 'full'
  },
  {
    path: 'employee/travel-request',
    loadComponent: () => import('./features/employee/components/travel-request-form.component').then(m => m.TravelRequestFormComponent)
  }
];
