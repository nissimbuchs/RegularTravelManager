import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

// Angular Material Modules
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';

// Admin Routing
import { AdminRoutingModule } from './admin-routing.module';

// Admin Components
import { UserManagementComponent } from './components/user-management.component';
import { ProjectsListComponent } from './components/projects-list.component';
import { ProjectDetailComponent } from './components/project-detail.component';
import { ProjectFormDialogComponent } from './components/project-form-dialog.component';
import { SubprojectFormDialogComponent } from './components/subproject-form-dialog.component';

@NgModule({
  declarations: [
    // Project management components are already declared elsewhere
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AdminRoutingModule,

    // Material Modules
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatDividerModule,

    // Standalone Components
    UserManagementComponent,
    ProjectsListComponent,
    ProjectDetailComponent,
    ProjectFormDialogComponent,
    SubprojectFormDialogComponent,
  ],
})
export class AdminModule {}
