import { BaseEntity, Address } from '@rtm/shared';

export interface Employee extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  homeAddress: Address;
  managerId?: string;
}
