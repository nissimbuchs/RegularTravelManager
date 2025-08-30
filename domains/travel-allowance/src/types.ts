import { BaseEntity } from '@rtm/shared';

export interface TravelRequest extends BaseEntity {
  employeeId: string;
  projectId: string;
  fromAddress: string;
  toAddress: string;
  distanceKm: number;
  allowanceAmount: number;
  status: TravelRequestStatus;
  requestDate: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export enum TravelRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
