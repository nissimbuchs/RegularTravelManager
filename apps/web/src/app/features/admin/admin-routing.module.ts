import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Guards
import { authGuard } from '../../core/guards/auth.guard';
import { adminGuard } from '../../core/guards/admin.guard';

// Components
import { UserManagementComponent } from './components/user-management.component';
import { ProjectsListComponent } from './components/projects-list.component';
import { ProjectDetailComponent } from './components/project-detail.component';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard, adminGuard],
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full',
      },
      {
        path: 'users',
        component: UserManagementComponent,
        data: {
          title: 'User Management',
          breadcrumb: 'Users',
        },
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./components/user-detail.component').then(c => c.UserDetailComponent),
        data: {
          title: 'User Details',
          breadcrumb: 'User Details',
        },
      },
      {
        path: 'projects',
        component: ProjectsListComponent,
        data: {
          title: 'Project Management',
          breadcrumb: 'Projects',
        },
      },
      {
        path: 'projects/:id',
        component: ProjectDetailComponent,
        data: {
          title: 'Project Details',
          breadcrumb: 'Project Details',
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
