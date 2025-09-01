import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { employeeGuard } from './core/guards/employee.guard';
import { managerGuard } from './core/guards/manager.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/components/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./shared/components/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./shared/components/role-redirect.component').then(m => m.RoleRedirectComponent),
        pathMatch: 'full',
      },
      {
        path: 'employee',
        canActivate: [employeeGuard],
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/employee/components/dashboard.component').then(
                m => m.DashboardComponent
              ),
          },
          {
            path: 'address',
            loadComponent: () =>
              import('./features/employee/components/address.component').then(
                m => m.AddressComponent
              ),
          },
          {
            path: 'request',
            loadComponent: () =>
              import('./features/employee/components/travel-request-form.component').then(
                m => m.TravelRequestFormComponent
              ),
          },
        ],
      },
      {
        path: 'manager',
        canActivate: [managerGuard],
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/manager/components/dashboard.component').then(
                m => m.DashboardComponent
              ),
          },
          {
            path: 'approvals',
            loadComponent: () =>
              import('./features/manager/components/manager-request-queue.component').then(
                m => m.ManagerRequestQueueComponent
              ),
          },
          {
            path: 'employees',
            loadComponent: () =>
              import('./features/manager/components/employees.component').then(
                m => m.EmployeesComponent
              ),
          },
          {
            path: 'projects',
            loadComponent: () =>
              import('./features/manager/components/projects.component').then(
                m => m.ProjectsComponent
              ),
          },
        ],
      },
      {
        path: 'admin',
        canActivate: [adminGuard], // Admin functions accessible to administrators
        children: [
          {
            path: 'projects',
            loadComponent: () =>
              import('./features/admin/components/projects-list.component').then(
                m => m.ProjectsListComponent
              ),
          },
          {
            path: 'projects/:id',
            loadComponent: () =>
              import('./features/admin/components/project-detail.component').then(
                m => m.ProjectDetailComponent
              ),
          },
          { path: '', redirectTo: 'projects', pathMatch: 'full' },
        ],
      },
    ],
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./shared/components/unauthorized.component').then(m => m.UnauthorizedComponent),
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
