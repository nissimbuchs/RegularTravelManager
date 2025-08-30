import { BaseEntity, Address } from '@rtm/shared';

export interface Project extends BaseEntity {
  name: string;
  description: string;
  locations: ProjectLocation[];
  managerId: string;
  isActive: boolean;
}

export interface ProjectLocation extends BaseEntity {
  projectId: string;
  name: string;
  address: Address;
}
