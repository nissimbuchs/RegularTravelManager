import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="projects-container">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>business_center</mat-icon>
          <mat-card-title>{{ translationService.translateSync('manager.projects.title') }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>{{ translationService.translateSync('manager.projects.coming_soon') }}</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./projects.component.scss'],
})
export class ProjectsComponent {
  constructor(public translationService: TranslationService) {}
}
