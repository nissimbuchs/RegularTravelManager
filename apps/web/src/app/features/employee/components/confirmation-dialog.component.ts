import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CalculationPreview } from '@rtm/shared';

export interface ConfirmationData {
  requestId: string;
  calculationPreview: CalculationPreview;
  projectName: string;
  subprojectName: string;
  managerName: string;
  daysPerWeek: number;
  justification: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.css']
})
export class ConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationData
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  onViewRequests(): void {
    this.dialogRef.close('view-requests');
  }

  onCreateNew(): void {
    this.dialogRef.close('create-new');
  }
}