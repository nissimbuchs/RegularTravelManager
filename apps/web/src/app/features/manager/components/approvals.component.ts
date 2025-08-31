import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="approvals-container">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>check_circle</mat-icon>
          <mat-card-title>Travel Request Approvals</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>This feature will be implemented in Epic 3.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .approvals-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    mat-card-header mat-icon { background-color: #e8f5e8; color: #2e7d32; }
  `]
})
export class ApprovalsComponent {}