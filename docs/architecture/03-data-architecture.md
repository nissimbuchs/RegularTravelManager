# Data Architecture & Database Design

## Employee Identification Strategy

**Architectural Pattern:** Three-ID system addressing different concerns of employee identification across authentication, business operations, and database management.

### Three ID Types & Usage

| ID Type | Purpose | Security Context | Display Context |
|---------|---------|------------------|----------------|
| **UUID (id)** | Database primary key | Internal operations, foreign keys | Never exposed to frontend |
| **Employee ID** | Human-readable business identifier | UI display, reports | `EMP-0001`, `MGR-0001` format |
| **Cognito User ID** | Authentication identifier | API calls, JWT token validation | Security boundary enforcement |

### Critical Security Pattern

**API Authentication Rule:** Frontend uses `cognito_user_id` for all API calls. Backend queries by `cognito_user_id` ensure users can only access their own data, preventing unauthorized access through URL manipulation while maintaining clear separation between display IDs and security tokens.

## Domain Data Models

### Core Entity Relationships

**TravelRequest** (Aggregate Root) - Central business entity linking employee to manager through approval workflow with complete audit trail

**Employee** - Contains authentication mapping (cognito_user_id), home address for calculations, and manager hierarchy

**Project & SubProject** - Hierarchical structure with geographic coordinates and configurable cost-per-kilometer rates

**Address & Location** (Value Objects) - Immutable geographic representations for PostGIS distance calculations

### Data Relationship Architecture

```
Employee (1) ←→ (n) TravelRequest
Employee (1) ←→ (n) Employee (manager relationship)
Project (1) ←→ (n) SubProject
TravelRequest (n) ←→ (1) SubProject
```

## Database Architecture

### PostgreSQL with PostGIS Extension

**Technology Choice:** PostgreSQL with PostGIS provides ACID compliance, accurate geographic distance calculations, and efficient spatial indexing for location-based queries.

### Core Schema Design Principles

**Geographic Data Management:** All coordinates stored in WGS 84 (SRID 4326) with GIST spatial indexes and PostGIS ST_Distance function for calculations.

**Audit Trail Architecture:** Immutable audit records track employee address changes and travel request status changes with timestamps and user attribution.

**Data Integrity Patterns:** CHECK constraints enforce business rules, foreign keys maintain referential integrity, and NOT NULL constraints protect required data.

### Key Database Features

**Indexing Strategy:** GIST indexes on geographic columns, B-tree indexes on foreign keys, and composite indexes for common query patterns optimize performance.

**PostGIS Functions:** ST_Distance for calculations, GEOMETRY(POINT, 4326) for storage, and spatial indexing enable efficient location-based operations.

## Data Security & Privacy

**Access Control:** Row-level security through cognito_user_id filtering ensures users access only their own data, with managers limited to direct reports and admin users having controlled elevated access.

**Data Privacy:** Home addresses stored for calculation purposes only, with personal information access controlled by authentication and comprehensive audit trails.

This data architecture ensures secure, efficient management of travel allowance data while maintaining strong entity relationships and comprehensive audit capabilities.