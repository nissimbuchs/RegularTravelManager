# Data Models

Based on our brainstorming session and DDD approach, here are the core domain models that will be shared between frontend and backend:

## TravelRequest

**Purpose:** Core aggregate root representing an employee's request for regular travel allowance

**Key Attributes:**
- id: string - Unique identifier for the request
- employeeId: string - Reference to the requesting employee
- managerId: string - Reference to the approving manager
- projectId: string - Reference to the project
- subProjectId: string - Reference to the specific subproject
- daysPerWeek: number - Number of travel days requested per week
- justification: string - Employee's reason for the travel request
- status: RequestStatus - Current approval status
- calculatedDistance: number - Straight-line distance in kilometers
- calculatedAllowance: number - Daily allowance amount in CHF
- submittedAt: Date - When the request was submitted
- processedAt: Date | null - When approved/rejected
- processedBy: string | null - Manager who processed the request
- rejectionReason: string | null - Reason if rejected

### TypeScript Interface
```typescript
interface TravelRequest {
  id: string;
  employeeId: string;
  managerId: string;
  projectId: string;
  subProjectId: string;
  daysPerWeek: number;
  justification: string;
  status: RequestStatus;
  calculatedDistance: number;
  calculatedAllowance: number;
  submittedAt: Date;
  processedAt: Date | null;
  processedBy: string | null;
  rejectionReason: string | null;
}
```

### Relationships
- Belongs to one Employee (employeeId)
- Managed by one Manager (managerId)
- References one Project and SubProject
- Can have multiple StatusHistory entries

## Employee

**Purpose:** Represents an employee who can submit travel requests

**Key Attributes:**
- id: string - Unique employee identifier
- email: string - Employee email address
- firstName: string - Employee first name
- lastName: string - Employee last name
- homeAddress: Address - Employee's home location for distance calculation
- managerId: string - Default manager for requests
- isActive: boolean - Whether employee can submit requests

### TypeScript Interface
```typescript
interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  homeAddress: Address;
  managerId: string;
  isActive: boolean;
}
```

### Relationships
- Has many TravelRequests
- Reports to one Manager
- Has one Address

## Project

**Purpose:** Represents a project with specific locations where employees travel

**Key Attributes:**
- id: string - Unique project identifier
- name: string - Project display name
- description: string - Project description
- isActive: boolean - Whether project accepts new requests
- defaultCostPerKm: number - Default CHF rate per kilometer

### TypeScript Interface
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  defaultCostPerKm: number;
}
```

### Relationships
- Has many SubProjects
- Referenced by many TravelRequests

## SubProject

**Purpose:** Specific work location within a project with precise geographic coordinates

**Key Attributes:**
- id: string - Unique subproject identifier
- projectId: string - Parent project reference
- name: string - Subproject display name
- location: Location - Geographic coordinates and address
- costPerKm: number - Specific CHF rate per kilometer (can override project default)
- isActive: boolean - Whether subproject accepts new requests

### TypeScript Interface
```typescript
interface SubProject {
  id: string;
  projectId: string;
  name: string;
  location: Location;
  costPerKm: number;
  isActive: boolean;
}
```

### Relationships
- Belongs to one Project
- Referenced by many TravelRequests
- Has one Location

## Address (Value Object)

**Purpose:** Immutable address representation for distance calculations

### TypeScript Interface
```typescript
interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
}
```

## Location (Value Object)

**Purpose:** Geographic location with coordinates for project sites

### TypeScript Interface
```typescript
interface Location {
  address: Address;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}
```

## RequestStatus (Enum)

**Purpose:** Defines valid states for travel requests

### TypeScript Interface
```typescript
enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn'
}
```
