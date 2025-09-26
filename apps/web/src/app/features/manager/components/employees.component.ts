import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="employees-container">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>people</mat-icon>
          <mat-card-title>{{ translationService.translateSync('manager.employees.title') }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>{{ translationService.translateSync('manager.employees.coming_soon') }}</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./employees.component.scss'],
})
export class EmployeesComponent {
  constructor(public translationService: TranslationService) {}
}
