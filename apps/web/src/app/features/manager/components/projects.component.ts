import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="projects-container">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>business_center</mat-icon>
          <mat-card-title>Project Management</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>This feature will be implemented in Story 2.2.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./projects.component.scss'],
})
export class ProjectsComponent {}
