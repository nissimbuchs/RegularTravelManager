import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="approvals-container">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>check_circle</mat-icon>
          <mat-card-title>{{ translationService.translateSync('manager.approvals.title') }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>{{ translationService.translateSync('manager.approvals.coming_soon') }}</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrls: ['./approvals.component.scss'],
})
export class ApprovalsComponent {
  constructor(public translationService: TranslationService) {}
}
