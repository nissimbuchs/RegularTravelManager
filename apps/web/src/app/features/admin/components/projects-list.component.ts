import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { Project, ProjectSearchFilters } from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ProjectFormDialogComponent } from './project-form-dialog.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
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
    MatSlideToggleModule,
    MatCardModule,
  ],
  template: `
    <div class="projects-container">
      <mat-card class="search-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>business_center</mat-icon>
            Project Management
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="searchForm" class="search-form">
            <mat-form-field appearance="outline">
              <mat-label>Search projects</mat-label>
              <input
                matInput
                formControlName="search"
                placeholder="Search by name or description"
              />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="isActive">
                <mat-option [value]="null">All</mat-option>
                <mat-option [value]="true">Active</mat-option>
                <mat-option [value]="false">Inactive</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Min Cost (CHF)</mat-label>
              <input
                matInput
                type="number"
                formControlName="minCostPerKm"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Max Cost (CHF)</mat-label>
              <input
                matInput
                type="number"
                formControlName="maxCostPerKm"
                placeholder="999.99"
                step="0.01"
                min="0"
              />
            </mat-form-field>

            <div class="form-actions">
              <button mat-raised-button color="primary" (click)="createProject()">
                <mat-icon>add</mat-icon>
                New Project
              </button>

              <button mat-stroked-button (click)="clearFilters()">
                <mat-icon>clear</mat-icon>
                Clear Filters
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="table-card">
        <div class="table-container">
          <table mat-table [dataSource]="dataSource" matSort class="projects-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
              <td mat-cell *matCellDef="let project">
                <div class="project-name">
                  <strong>{{ project.name }}</strong>
                  <mat-chip [color]="project.isActive ? 'primary' : 'warn'">
                    {{ project.isActive ? 'Active' : 'Inactive' }}
                  </mat-chip>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>Description</th>
              <td mat-cell *matCellDef="let project">
                <span class="description" [matTooltip]="project.description || 'No description'">
                  {{ project.description || 'No description' | slice: 0 : 50 }}
                  <span *ngIf="(project.description?.length || 0) > 50">...</span>
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="defaultCostPerKm">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Default Cost/km</th>
              <td mat-cell *matCellDef="let project">
                <span class="cost-rate">{{ formatCurrency(project.defaultCostPerKm) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="subprojectsCount">
              <th mat-header-cell *matHeaderCellDef>Subprojects</th>
              <td mat-cell *matCellDef="let project">
                <mat-icon class="subprojects-icon">location_on</mat-icon>
                {{ project.subprojectCount || 0 }}
              </td>
            </ng-container>

            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Created</th>
              <td mat-cell *matCellDef="let project">
                {{ project.createdAt | date: 'short' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let project">
                <div class="action-buttons">
                  <button
                    mat-icon-button
                    [routerLink]="['/admin/projects', project.id]"
                    matTooltip="View Details"
                  >
                    <mat-icon>visibility</mat-icon>
                  </button>

                  <button mat-icon-button (click)="editProject(project)" matTooltip="Edit Project">
                    <mat-icon>edit</mat-icon>
                  </button>

                  <button
                    mat-icon-button
                    (click)="toggleProjectStatus(project)"
                    [matTooltip]="project.isActive ? 'Deactivate' : 'Activate'"
                  >
                    <mat-icon [color]="project.isActive ? 'warn' : 'primary'">
                      {{ project.isActive ? 'toggle_off' : 'toggle_on' }}
                    </mat-icon>
                  </button>

                  <button
                    mat-icon-button
                    (click)="deleteProject(project)"
                    matTooltip="Delete Project"
                    color="warn"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>

          <mat-paginator [pageSizeOptions]="[10, 25, 50, 100]" [pageSize]="25" showFirstLastButtons>
          </mat-paginator>
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .projects-container {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .search-card {
        margin-bottom: 20px;
      }

      .search-form {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr;
        gap: 16px;
        align-items: start;
      }

      .form-actions {
        grid-column: 1 / -1;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 16px;
      }

      .table-card {
        min-height: 400px;
      }

      .table-container {
        overflow-x: auto;
      }

      .projects-table {
        width: 100%;
        min-width: 800px;
      }

      .project-name {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .project-name mat-chip {
        font-size: 0.75rem;
        min-height: 20px;
      }

      .description {
        color: rgba(0, 0, 0, 0.6);
        font-size: 0.875rem;
      }

      .cost-rate {
        font-weight: 500;
        color: #2e7d32;
      }

      .subprojects-icon {
        vertical-align: middle;
        margin-right: 4px;
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
      }

      .action-buttons {
        display: flex;
        gap: 4px;
      }

      .action-buttons button {
        width: 32px;
        height: 32px;
        line-height: 32px;
      }

      .action-buttons mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      @media (max-width: 768px) {
        .projects-container {
          padding: 12px;
        }

        .search-form {
          grid-template-columns: 1fr;
        }

        .form-actions {
          justify-content: stretch;
        }

        .form-actions button {
          flex: 1;
        }
      }
    `,
  ],
})
export class ProjectsListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  displayedColumns: string[] = [
    'name',
    'description',
    'defaultCostPerKm',
    'subprojectsCount',
    'createdAt',
    'actions',
  ];

  dataSource = new MatTableDataSource<Project>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  searchForm = new FormGroup({
    search: new FormControl(''),
    isActive: new FormControl<boolean | null>(null),
    minCostPerKm: new FormControl<number | null>(null),
    maxCostPerKm: new FormControl<number | null>(null),
  });

  constructor(
    private projectService: ProjectService,
    private loadingService: LoadingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.setupSearch();
    this.loadProjects();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private setupSearch(): void {
    this.searchForm.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.applyFilters();
      });
  }

  private loadProjects(): void {
    this.loadingService.setLoading(true);

    this.projectService
      .getProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: projects => {
          this.dataSource.data = projects;
          this.loadingService.setLoading(false);
        },
        error: error => {
          console.error('Failed to load projects:', error);
          this.snackBar.open('Failed to load projects', 'Close', { duration: 3000 });
          this.loadingService.setLoading(false);
        },
      });
  }

  private applyFilters(): void {
    const filters: ProjectSearchFilters = {};
    const formValue = this.searchForm.value;

    if (formValue.search?.trim()) {
      filters.search = formValue.search.trim();
    }

    if (formValue.isActive !== null) {
      filters.isActive = formValue.isActive;
    }

    if (
      formValue.minCostPerKm !== null &&
      formValue.minCostPerKm !== undefined &&
      formValue.minCostPerKm >= 0
    ) {
      filters.minCostPerKm = formValue.minCostPerKm;
    }

    if (
      formValue.maxCostPerKm !== null &&
      formValue.maxCostPerKm !== undefined &&
      formValue.maxCostPerKm >= 0
    ) {
      filters.maxCostPerKm = formValue.maxCostPerKm;
    }

    this.loadingService.setLoading(true);

    this.projectService
      .getProjects(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: projects => {
          this.dataSource.data = projects;
          this.loadingService.setLoading(false);
        },
        error: error => {
          console.error('Failed to filter projects:', error);
          this.snackBar.open('Failed to filter projects', 'Close', { duration: 3000 });
          this.loadingService.setLoading(false);
        },
      });
  }

  createProject(): void {
    const dialogRef = this.dialog.open(ProjectFormDialogComponent, {
      width: '600px',
      data: { title: 'Create New Project', project: null },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadProjects();
        this.snackBar.open('Project created successfully', 'Close', { duration: 3000 });
      }
    });
  }

  editProject(project: Project): void {
    const dialogRef = this.dialog.open(ProjectFormDialogComponent, {
      width: '600px',
      data: { title: 'Edit Project', project },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadProjects();
        this.snackBar.open('Project updated successfully', 'Close', { duration: 3000 });
      }
    });
  }

  toggleProjectStatus(project: Project): void {
    const action = project.isActive ? 'deactivate' : 'activate';
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: `${action === 'activate' ? 'Activate' : 'Deactivate'} Project`,
        message: `Are you sure you want to ${action} "${project.name}"?`,
        confirmText: action === 'activate' ? 'Activate' : 'Deactivate',
        confirmColor: action === 'activate' ? 'primary' : 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.projectService
          .toggleProjectStatus(project.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadProjects();
              this.snackBar.open(`Project ${action}d successfully`, 'Close', { duration: 3000 });
            },
            error: error => {
              console.error('Failed to toggle project status:', error);
              this.snackBar.open(`Failed to ${action} project`, 'Close', { duration: 3000 });
            },
          });
      }
    });
  }

  deleteProject(project: Project): void {
    // First check if project can be deleted
    this.projectService
      .checkProjectReferences(project.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          if (!result.canDelete) {
            this.snackBar.open(
              `Cannot delete project. It is referenced by ${result.referencesCount} travel request(s).`,
              'Close',
              { duration: 5000 }
            );
            return;
          }

          const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            data: {
              title: 'Delete Project',
              message: `Are you sure you want to delete "${project.name}"? This action cannot be undone.`,
              confirmText: 'Delete',
              confirmColor: 'warn',
            },
          });

          dialogRef.afterClosed().subscribe(confirmed => {
            if (confirmed) {
              this.projectService
                .deleteProject(project.id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: () => {
                    this.loadProjects();
                    this.snackBar.open('Project deleted successfully', 'Close', { duration: 3000 });
                  },
                  error: error => {
                    console.error('Failed to delete project:', error);
                    this.snackBar.open('Failed to delete project', 'Close', { duration: 3000 });
                  },
                });
            }
          });
        },
        error: error => {
          console.error('Failed to check project references:', error);
          this.snackBar.open('Failed to verify project deletion safety', 'Close', {
            duration: 3000,
          });
        },
      });
  }

  clearFilters(): void {
    this.searchForm.reset({
      search: '',
      isActive: null,
      minCostPerKm: null,
      maxCostPerKm: null,
    });
  }

  formatCurrency(amount: number): string {
    return this.projectService.formatCHF(amount);
  }
}
