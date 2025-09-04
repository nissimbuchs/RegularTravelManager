import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CalculationPreview } from '@rtm/shared';

export interface ConfirmationData {
  requestId: string;
  calculationPreview: CalculationPreview;
  projectName: string;
  subprojectName: string;
  managerId: string;
  managerName: string;
  daysPerWeek: number;
  justification: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.css'],
})
export class ConfirmationDialogComponent implements OnInit, OnDestroy {
  autoCloseTimer: any;
  countdownInterval: any;
  autoCloseCountdown = 8; // 8 seconds
  currentCountdown = this.autoCloseCountdown;
  private isDestroyed = false;

  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationData
  ) {}

  ngOnInit(): void {
    this.startAutoCloseTimer();
    this.startCountdownDisplay();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  private startAutoCloseTimer(): void {
    // Auto-close after 8 seconds, navigating to dashboard
    this.autoCloseTimer = setTimeout(() => {
      // Check if component is still active before closing
      if (!this.isDestroyed) {
        this.onViewRequests(); // Navigate to dashboard
      }
    }, this.autoCloseCountdown * 1000);
  }

  private startCountdownDisplay(): void {
    this.countdownInterval = setInterval(() => {
      if (this.isDestroyed) {
        clearInterval(this.countdownInterval);
        return;
      }

      this.currentCountdown--;
      if (this.currentCountdown <= 0) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  onClose(): void {
    this.clearTimers();
    this.dialogRef.close();
  }

  onViewRequests(): void {
    this.clearTimers();
    this.dialogRef.close('view-requests');
  }

  onCreateNew(): void {
    this.clearTimers();
    this.dialogRef.close('create-new');
  }

  private clearTimers(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}
