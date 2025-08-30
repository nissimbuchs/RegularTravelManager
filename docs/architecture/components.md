# Components

Based on our DDD architecture, AWS serverless platform, and identified workflows, here are the major logical components across the fullstack:

## TravelRequestService

**Responsibility:** Core domain service managing the complete travel request lifecycle including submission, processing, and status management

**Key Interfaces:**
- `submitRequest(dto: CreateTravelRequestDto): Promise<TravelRequest>`
- `processRequest(requestId: string, action: ProcessAction): Promise<TravelRequest>`
- `getRequestsByEmployee(employeeId: string): Promise<TravelRequest[]>`
- `getRequestsForManager(managerId: string): Promise<TravelRequest[]>`

**Dependencies:** TravelRequestRepository, DistanceCalculator, AllowanceCalculator, NotificationService

**Technology Stack:** Lambda functions with Fastify, TypeScript domain models, PostgreSQL with repository pattern

## DistanceCalculator

**Responsibility:** Calculates straight-line distance between employee home address and project subproject location

**Key Interfaces:**
- `calculateDistance(from: Address, to: Address): Promise<number>`
- `validateCoordinates(address: Address): boolean`

**Dependencies:** PostGIS geometric functions, Address value objects

**Technology Stack:** PostgreSQL PostGIS ST_Distance function, TypeScript geometric calculations as fallback

## NotificationService

**Responsibility:** Handles email notifications for request status changes and new submissions

**Key Interfaces:**
- `notifyRequestSubmitted(request: TravelRequest, manager: Employee): Promise<void>`
- `notifyRequestApproved(request: TravelRequest, employee: Employee): Promise<void>`
- `notifyRequestRejected(request: TravelRequest, employee: Employee, reason: string): Promise<void>`

**Dependencies:** AWS SES, Employee data for email addresses, email templates

**Technology Stack:** AWS SES SDK, TypeScript template engine, Lambda event triggers
