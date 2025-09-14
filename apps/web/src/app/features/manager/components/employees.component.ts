import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="employees-container">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>people</mat-icon>
          <mat-card-title>Employee Management</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>This feature will be implemented in Epic 3.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./employees.component.scss'],
})
export class EmployeesComponent {}
