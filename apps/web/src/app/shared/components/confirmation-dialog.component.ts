import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
  icon?: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>
        <mat-icon *ngIf="data.icon" [color]="data.confirmColor || 'primary'">
          {{ data.icon }}
        </mat-icon>
        {{ data.title }}
      </h2>
    </div>

    <mat-dialog-content>
      <p class="dialog-message">{{ data.message }}</p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ data.cancelText || 'Cancel' }}
      </button>
      <button mat-raised-button [color]="data.confirmColor || 'primary'" (click)="onConfirm()">
        {{ data.confirmText || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-header {
        margin-bottom: 16px;
      }

      .dialog-header h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
      }

      .dialog-message {
        margin: 0;
        line-height: 1.6;
        color: rgba(0, 0, 0, 0.87);
      }

      mat-dialog-actions {
        padding: 16px 0;
        gap: 8px;
      }
    `,
  ],
})
export class ConfirmationDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationDialogData
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
