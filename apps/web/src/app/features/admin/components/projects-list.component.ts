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
import { TranslationService } from '../../../core/services/translation.service';
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
            {{ translationService.translateSync('admin.projects.title') }}
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="searchForm" class="search-form">
            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.projects.search.label') }}</mat-label>
              <input
                matInput
                formControlName="search"
                [placeholder]="translationService.translateSync('admin.projects.search.placeholder')"
              />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.projects.filters.status.label') }}</mat-label>
              <mat-select formControlName="isActive">
                <mat-option [value]="null">{{ translationService.translateSync('admin.projects.filters.status.all') }}</mat-option>
                <mat-option [value]="true">{{ translationService.translateSync('common.status.active') }}</mat-option>
                <mat-option [value]="false">{{ translationService.translateSync('common.status.inactive') }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.projects.filters.min_cost.label') }}</mat-label>
              <input
                matInput
                type="number"
                formControlName="minCostPerKm"
                [placeholder]="translationService.translateSync('admin.projects.filters.min_cost.placeholder')"
                step="0.01"
                min="0"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ translationService.translateSync('admin.projects.filters.max_cost.label') }}</mat-label>
              <input
                matInput
                type="number"
                formControlName="maxCostPerKm"
                [placeholder]="translationService.translateSync('admin.projects.filters.max_cost.placeholder')"
                step="0.01"
                min="0"
              />
            </mat-form-field>

            <div class="form-actions">
              <button mat-raised-button color="primary" (click)="createProject()">
                <mat-icon>add</mat-icon>
                {{ translationService.translateSync('admin.projects.actions.new_project') }}
              </button>

              <button mat-stroked-button (click)="clearFilters()">
                <mat-icon>clear</mat-icon>
                {{ translationService.translateSync('admin.projects.actions.clear_filters') }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="table-card">
        <div class="table-container">
          <table mat-table [dataSource]="dataSource" matSort class="projects-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ translationService.translateSync('admin.projects.table.columns.name') }}</th>
              <td mat-cell *matCellDef="let project">
                <div class="project-name">
                  <strong>{{ project.name }}</strong>
                  <mat-chip [color]="project.isActive ? 'primary' : 'warn'">
                    {{ project.isActive ? translationService.translateSync('common.status.active') : translationService.translateSync('common.status.inactive') }}
                  </mat-chip>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>{{ translationService.translateSync('admin.projects.table.columns.description') }}</th>
              <td mat-cell *matCellDef="let project">
                <span class="description" [matTooltip]="project.description || translationService.translateSync('admin.projects.table.no_description')">
                  {{ project.description || translationService.translateSync('admin.projects.table.no_description') | slice: 0 : 50 }}
                  <span *ngIf="(project.description?.length || 0) > 50">...</span>
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="defaultCostPerKm">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ translationService.translateSync('admin.projects.table.columns.default_cost') }}</th>
              <td mat-cell *matCellDef="let project">
                <span class="cost-rate">{{ formatCurrency(project.defaultCostPerKm) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="subprojectsCount">
              <th mat-header-cell *matHeaderCellDef>{{ translationService.translateSync('admin.projects.table.columns.subprojects') }}</th>
              <td mat-cell *matCellDef="let project">
                <mat-icon class="subprojects-icon">location_on</mat-icon>
                {{ project.subprojectCount || 0 }}
              </td>
            </ng-container>

            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ translationService.translateSync('admin.projects.table.columns.created') }}</th>
              <td mat-cell *matCellDef="let project">
                {{ project.createdAt | date: 'short' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>{{ translationService.translateSync('admin.projects.table.columns.actions') }}</th>
              <td mat-cell *matCellDef="let project">
                <div class="action-buttons">
                  <button
                    mat-icon-button
                    [routerLink]="['/admin/projects', project.id]"
                    [matTooltip]="translationService.translateSync('admin.projects.actions.view_details')"
                  >
                    <mat-icon>visibility</mat-icon>
                  </button>

                  <button
                    mat-icon-button
                    (click)="editProject(project)"
                    [matTooltip]="translationService.translateSync('admin.projects.actions.edit_project')"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>

                  <button
                    mat-icon-button
                    (click)="toggleProjectStatus(project)"
                    [matTooltip]="project.isActive ? translationService.translateSync('admin.projects.actions.deactivate') : translationService.translateSync('admin.projects.actions.activate')"
                  >
                    <mat-icon [color]="project.isActive ? 'warn' : 'primary'">
                      {{ project.isActive ? 'toggle_off' : 'toggle_on' }}
                    </mat-icon>
                  </button>

                  <button
                    mat-icon-button
                    (click)="deleteProject(project)"
                    [matTooltip]="translationService.translateSync('admin.projects.actions.delete_project')"
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
  styleUrls: ['./projects-list.component.scss'],
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
    private snackBar: MatSnackBar,
    public translationService: TranslationService
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
          this.snackBar.open(
            this.translationService.translateSync('admin.projects.messages.load_failed'),
            this.translationService.translateSync('common.buttons.close'),
            { duration: 3000 }
          );
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
          this.snackBar.open(
            this.translationService.translateSync('admin.projects.messages.filter_failed'),
            this.translationService.translateSync('common.buttons.close'),
            { duration: 3000 }
          );
          this.loadingService.setLoading(false);
        },
      });
  }

  createProject(): void {
    const dialogRef = this.dialog.open(ProjectFormDialogComponent, {
      width: '600px',
      data: {
        title: this.translationService.translateSync('admin.projects.dialogs.create.title'),
        project: null
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          this.loadProjects();
          this.snackBar.open(
            this.translationService.translateSync('admin.projects.messages.created_successfully'),
            this.translationService.translateSync('common.buttons.close'),
            { duration: 3000 }
          );
        }
      });
  }

  editProject(project: Project): void {
    const dialogRef = this.dialog.open(ProjectFormDialogComponent, {
      width: '600px',
      data: {
        title: this.translationService.translateSync('admin.projects.dialogs.edit.title'),
        project
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          this.loadProjects();
          this.snackBar.open(
            this.translationService.translateSync('admin.projects.messages.updated_successfully'),
            this.translationService.translateSync('common.buttons.close'),
            { duration: 3000 }
          );
        }
      });
  }

  toggleProjectStatus(project: Project): void {
    const action = project.isActive ? 'deactivate' : 'activate';
    const titleKey = action === 'activate' ? 'admin.projects.dialogs.activate.title' : 'admin.projects.dialogs.deactivate.title';
    const confirmKey = action === 'activate' ? 'admin.projects.dialogs.activate.confirm' : 'admin.projects.dialogs.deactivate.confirm';

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: this.translationService.translateSync(titleKey),
        message: this.translationService.translateSync(`admin.projects.dialogs.${action}.message`, { projectName: project.name }),
        confirmText: this.translationService.translateSync(confirmKey),
        confirmColor: action === 'activate' ? 'primary' : 'warn',
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) {
          this.projectService
            .toggleProjectStatus(project.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.loadProjects();
                const successKey = action === 'activate' ? 'admin.projects.messages.activated_successfully' : 'admin.projects.messages.deactivated_successfully';
                this.snackBar.open(
                  this.translationService.translateSync(successKey),
                  this.translationService.translateSync('common.buttons.close'),
                  { duration: 3000 }
                );
              },
              error: error => {
                console.error('Failed to toggle project status:', error);
                const errorKey = action === 'activate' ? 'admin.projects.messages.activate_failed' : 'admin.projects.messages.deactivate_failed';
                this.snackBar.open(
                  this.translationService.translateSync(errorKey),
                  this.translationService.translateSync('common.buttons.close'),
                  { duration: 3000 }
                );
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
              this.translationService.translateSync('admin.projects.messages.cannot_delete_referenced', { count: result.referencesCount }),
              this.translationService.translateSync('common.buttons.close'),
              { duration: 5000 }
            );
            return;
          }

          const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            data: {
              title: this.translationService.translateSync('admin.projects.dialogs.delete.title'),
              message: this.translationService.translateSync('admin.projects.dialogs.delete.message', { projectName: project.name }),
              confirmText: this.translationService.translateSync('admin.projects.dialogs.delete.confirm'),
              confirmColor: 'warn',
            },
          });

          dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(confirmed => {
              if (confirmed) {
                this.projectService
                  .deleteProject(project.id)
                  .pipe(takeUntil(this.destroy$))
                  .subscribe({
                    next: () => {
                      this.loadProjects();
                      this.snackBar.open(
                        this.translationService.translateSync('admin.projects.messages.deleted_successfully'),
                        this.translationService.translateSync('common.buttons.close'),
                        { duration: 3000 }
                      );
                    },
                    error: error => {
                      console.error('Failed to delete project:', error);
                      this.snackBar.open(
                        this.translationService.translateSync('admin.projects.messages.delete_failed'),
                        this.translationService.translateSync('common.buttons.close'),
                        { duration: 3000 }
                      );
                    },
                  });
              }
            });
        },
        error: error => {
          console.error('Failed to check project references:', error);
          this.snackBar.open(
            this.translationService.translateSync('admin.projects.messages.check_references_failed'),
            this.translationService.translateSync('common.buttons.close'),
            { duration: 3000 }
          );
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
