import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Project, Subproject } from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';
import { LoadingService } from '../../../core/services/loading.service';
import { SubprojectFormDialogComponent } from './subproject-form-dialog.component';
import { ProjectFormDialogComponent } from './project-form-dialog.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatTabsModule,
    MatDividerModule,
  ],
  template: `
    <div class="project-detail-container" *ngIf="project">
      <!-- Project Header -->
      <mat-card class="project-header-card">
        <mat-card-header>
          <mat-card-title>
            <div class="title-row">
              <div class="title-info">
                <mat-icon class="project-icon">business_center</mat-icon>
                <h2>{{ project.name }}</h2>
                <mat-chip [color]="project.isActive ? 'primary' : 'warn'">
                  {{ project.isActive ? 'Active' : 'Inactive' }}
                </mat-chip>
              </div>

              <div class="header-actions">
                <button mat-stroked-button (click)="editProject()">
                  <mat-icon>edit</mat-icon>
                  Edit Project
                </button>
                <button mat-button [routerLink]="['/admin/projects']">
                  <mat-icon>arrow_back</mat-icon>
                  Back to Projects
                </button>
              </div>
            </div>
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="project-info">
            <div class="info-grid">
              <div class="info-item">
                <mat-icon>description</mat-icon>
                <div>
                  <strong>Description</strong>
                  <p>{{ project.description || 'No description provided' }}</p>
                </div>
              </div>

              <div class="info-item">
                <mat-icon>attach_money</mat-icon>
                <div>
                  <strong>Default Cost per Kilometer</strong>
                  <p class="cost-value">{{ formatCurrency(project.defaultCostPerKm) }}</p>
                </div>
              </div>

              <div class="info-item">
                <mat-icon>event</mat-icon>
                <div>
                  <strong>Created</strong>
                  <p>{{ project.createdAt | date: 'medium' }}</p>
                </div>
              </div>

              <div class="info-item">
                <mat-icon>location_on</mat-icon>
                <div>
                  <strong>Subprojects</strong>
                  <p>{{ subprojects.length }} location(s)</p>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Subprojects Management -->
      <mat-card class="subprojects-card">
        <mat-card-header>
          <mat-card-title>
            <div class="subprojects-header">
              <div class="header-title">
                <mat-icon>location_on</mat-icon>
                Subproject Locations
              </div>
              <button mat-raised-button color="primary" (click)="createSubproject()">
                <mat-icon>add_location</mat-icon>
                Add Location
              </button>
            </div>
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="table-container">
            <table mat-table [dataSource]="dataSource" matSort class="subprojects-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Location Name</th>
                <td mat-cell *matCellDef="let subproject">
                  <div class="location-name">
                    <strong>{{ subproject.name }}</strong>
                    <mat-chip [color]="subproject.isActive ? 'primary' : 'warn'">
                      {{ subproject.isActive ? 'Active' : 'Inactive' }}
                    </mat-chip>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="address">
                <th mat-header-cell *matHeaderCellDef>Address</th>
                <td mat-cell *matCellDef="let subproject">
                  <div class="address" *ngIf="hasAddress(subproject); else noAddress">
                    <mat-icon class="address-icon">place</mat-icon>
                    <div class="address-text">
                      <div>{{ subproject.locationStreet }}</div>
                      <div class="city-postal">
                        {{ subproject.locationCity }} {{ subproject.locationPostalCode }}
                      </div>
                    </div>
                  </div>
                  <ng-template #noAddress>
                    <span class="no-address">No address provided</span>
                  </ng-template>
                </td>
              </ng-container>

              <ng-container matColumnDef="coordinates">
                <th mat-header-cell *matHeaderCellDef>Coordinates</th>
                <td mat-cell *matCellDef="let subproject">
                  <div class="coordinates" *ngIf="subproject.locationCoordinates; else noCoords">
                    <mat-icon class="coords-icon">my_location</mat-icon>
                    <span class="coords-text">
                      {{ subproject.locationCoordinates.latitude | number: '1.6-6' }},
                      {{ subproject.locationCoordinates.longitude | number: '1.6-6' }}
                    </span>
                  </div>
                  <ng-template #noCoords>
                    <span class="no-coordinates">Not geocoded</span>
                  </ng-template>
                </td>
              </ng-container>

              <ng-container matColumnDef="costPerKm">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Cost/km</th>
                <td mat-cell *matCellDef="let subproject">
                  <div class="cost-info">
                    <span class="cost-value">
                      {{ formatCurrency(subproject.costPerKm || project.defaultCostPerKm) }}
                    </span>
                    <span class="cost-source" *ngIf="!subproject.costPerKm"> (inherited) </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Created</th>
                <td mat-cell *matCellDef="let subproject">
                  {{ subproject.createdAt | date: 'short' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let subproject">
                  <div class="action-buttons">
                    <button
                      mat-icon-button
                      (click)="editSubproject(subproject)"
                      matTooltip="Edit Location"
                    >
                      <mat-icon>edit_location</mat-icon>
                    </button>

                    <button
                      mat-icon-button
                      (click)="toggleSubprojectStatus(subproject)"
                      [matTooltip]="subproject.isActive ? 'Deactivate' : 'Activate'"
                    >
                      <mat-icon [color]="subproject.isActive ? 'warn' : 'primary'">
                        {{ subproject.isActive ? 'toggle_off' : 'toggle_on' }}
                      </mat-icon>
                    </button>

                    <button
                      mat-icon-button
                      (click)="deleteSubproject(subproject)"
                      matTooltip="Delete Location"
                      color="warn"
                    >
                      <mat-icon>delete_forever</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>

            <div *ngIf="subprojects.length === 0" class="no-subprojects">
              <mat-icon>location_off</mat-icon>
              <h3>No locations added yet</h3>
              <p>Add subproject locations to specify work sites and custom cost rates.</p>
              <button mat-raised-button color="primary" (click)="createSubproject()">
                <mat-icon>add_location</mat-icon>
                Add First Location
              </button>
            </div>

            <mat-paginator
              *ngIf="subprojects.length > 0"
              [pageSizeOptions]="[5, 10, 25]"
              [pageSize]="10"
            >
            </mat-paginator>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .project-detail-container {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .project-header-card {
        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          width: 100%;
        }

        .title-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .project-icon {
          font-size: 2rem;
          width: 2rem;
          height: 2rem;
          color: #1976d2;
        }

        h2 {
          margin: 0;
          font-size: 1.8rem;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }
      }

      .project-info {
        margin-top: 16px;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
      }

      .info-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        background-color: #f9f9f9;
        border-radius: 8px;
      }

      .info-item mat-icon {
        color: #666;
        margin-top: 2px;
      }

      .info-item strong {
        display: block;
        margin-bottom: 4px;
        color: rgba(0, 0, 0, 0.87);
      }

      .info-item p {
        margin: 0;
        color: rgba(0, 0, 0, 0.6);
      }

      .cost-value {
        font-weight: 500;
        color: #2e7d32;
        font-family: 'Roboto Mono', monospace;
      }

      .subprojects-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .table-container {
        overflow-x: auto;
        margin-top: 16px;
      }

      .subprojects-table {
        width: 100%;
        min-width: 800px;
      }

      .location-name {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .location-name mat-chip {
        font-size: 0.75rem;
        min-height: 20px;
      }

      .address {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .address-icon {
        color: #666;
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
        margin-top: 2px;
      }

      .address-text {
        font-size: 0.875rem;
      }

      .city-postal {
        color: rgba(0, 0, 0, 0.6);
        font-size: 0.8rem;
      }

      .no-address,
      .no-coordinates {
        color: rgba(0, 0, 0, 0.4);
        font-style: italic;
        font-size: 0.875rem;
      }

      .coordinates {
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: 'Roboto Mono', monospace;
        font-size: 0.75rem;
      }

      .coords-icon {
        color: #1976d2;
        font-size: 0.875rem;
        width: 0.875rem;
        height: 0.875rem;
      }

      .cost-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      .cost-source {
        font-size: 0.75rem;
        color: rgba(0, 0, 0, 0.4);
        font-style: italic;
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

      .no-subprojects {
        text-align: center;
        padding: 40px 20px;
        color: rgba(0, 0, 0, 0.6);
      }

      .no-subprojects mat-icon {
        font-size: 4rem;
        width: 4rem;
        height: 4rem;
        color: #ccc;
        margin-bottom: 16px;
      }

      .no-subprojects h3 {
        margin: 16px 0 8px 0;
        color: rgba(0, 0, 0, 0.87);
      }

      .no-subprojects p {
        margin: 0 0 24px 0;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      }

      @media (max-width: 768px) {
        .project-detail-container {
          padding: 12px;
        }

        .title-row {
          flex-direction: column;
          gap: 16px;
          align-items: stretch;
        }

        .header-actions {
          justify-content: stretch;
        }

        .header-actions button {
          flex: 1;
        }

        .info-grid {
          grid-template-columns: 1fr;
        }

        .subprojects-header {
          flex-direction: column;
          gap: 16px;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  project: Project | null = null;
  subprojects: Subproject[] = [];
  dataSource = new MatTableDataSource<Subproject>([]);

  displayedColumns: string[] = [
    'name',
    'address',
    'coordinates',
    'costPerKm',
    'createdAt',
    'actions',
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private loadingService: LoadingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const projectId = params['id'];
      if (projectId) {
        this.loadProject(projectId);
        this.loadSubprojects(projectId);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private loadProject(id: string): void {
    this.loadingService.setLoading(true);

    this.projectService
      .getProject(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: project => {
          this.project = project;
          this.loadingService.setLoading(false);
        },
        error: error => {
          console.error('Failed to load project:', error);
          this.snackBar.open('Failed to load project', 'Close', { duration: 3000 });
          this.router.navigate(['/admin/projects']);
          this.loadingService.setLoading(false);
        },
      });
  }

  private loadSubprojects(projectId: string): void {
    this.projectService
      .getSubprojects(projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: subprojects => {
          this.subprojects = subprojects;
          this.dataSource.data = subprojects;
        },
        error: error => {
          console.error('Failed to load subprojects:', error);
          this.snackBar.open('Failed to load subprojects', 'Close', { duration: 3000 });
        },
      });
  }

  editProject(): void {
    if (!this.project) return;

    const dialogRef = this.dialog.open(ProjectFormDialogComponent, {
      width: '600px',
      data: { title: 'Edit Project', project: this.project },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadProject(this.project!.id);
        this.snackBar.open('Project updated successfully', 'Close', { duration: 3000 });
      }
    });
  }

  createSubproject(): void {
    if (!this.project) return;

    const dialogRef = this.dialog.open(SubprojectFormDialogComponent, {
      width: '700px',
      data: {
        title: 'Add New Location',
        project: this.project,
        subproject: null,
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadSubprojects(this.project!.id);
        this.snackBar.open('Location added successfully', 'Close', { duration: 3000 });
      }
    });
  }

  editSubproject(subproject: Subproject): void {
    if (!this.project) return;

    const dialogRef = this.dialog.open(SubprojectFormDialogComponent, {
      width: '700px',
      data: {
        title: 'Edit Location',
        project: this.project,
        subproject,
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadSubprojects(this.project!.id);
        this.snackBar.open('Location updated successfully', 'Close', { duration: 3000 });
      }
    });
  }

  toggleSubprojectStatus(subproject: Subproject): void {
    if (!this.project) return;

    const action = subproject.isActive ? 'deactivate' : 'activate';
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: `${action === 'activate' ? 'Activate' : 'Deactivate'} Location`,
        message: `Are you sure you want to ${action} "${subproject.name}"?`,
        confirmText: action === 'activate' ? 'Activate' : 'Deactivate',
        confirmColor: action === 'activate' ? 'primary' : 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.projectService
          .toggleSubprojectStatus(this.project!.id, subproject.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadSubprojects(this.project!.id);
              this.snackBar.open(`Location ${action}d successfully`, 'Close', { duration: 3000 });
            },
            error: error => {
              console.error('Failed to toggle subproject status:', error);
              this.snackBar.open(`Failed to ${action} location`, 'Close', { duration: 3000 });
            },
          });
      }
    });
  }

  deleteSubproject(subproject: Subproject): void {
    if (!this.project) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Location',
        message: `Are you sure you want to delete "${subproject.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
        icon: 'delete_forever',
      },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.projectService
          .deleteSubproject(this.project!.id, subproject.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadSubprojects(this.project!.id);
              this.snackBar.open('Location deleted successfully', 'Close', { duration: 3000 });
            },
            error: error => {
              console.error('Failed to delete subproject:', error);
              this.snackBar.open('Failed to delete location', 'Close', { duration: 3000 });
            },
          });
      }
    });
  }

  hasAddress(subproject: Subproject): boolean {
    return !!(
      subproject.locationStreet ||
      subproject.locationCity ||
      subproject.locationPostalCode
    );
  }

  formatCurrency(amount: number): string {
    return this.projectService.formatCHF(amount);
  }
}
