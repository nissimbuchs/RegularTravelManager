import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-address',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="address-container">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>add_location</mat-icon>
          <mat-card-title>Home Address Management</mat-card-title>
          <mat-card-subtitle>Manage your home address for travel calculations</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>This feature will be implemented in Story 2.1.</p>
          <p>You'll be able to set and update your home address with geographic coordinates.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .address-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    mat-card-header mat-icon {
      background-color: #e8f5e8;
      color: #2e7d32;
    }
  `]
})
export class AddressComponent {}