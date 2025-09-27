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

**Technology Choice:** PostgreSQL with PostGIS provides ACID compliance, accurate geographic distance calculations, efficient spatial indexing for location-based queries, and translation caching for multilingual content.

### Core Schema Design Principles

**Geographic Data Management:** All coordinates stored in WGS 84 (SRID 4326) with GIST spatial indexes and PostGIS ST_Distance function for calculations.

**Translation Cache Management:** Master data translations stored with 24-hour TTL, automatic cleanup functions, and multi-language support for user-generated content.

**Audit Trail Architecture:** Immutable audit records track employee address changes and travel request status changes with timestamps and user attribution.

**Data Integrity Patterns:** CHECK constraints enforce business rules, foreign keys maintain referential integrity, and NOT NULL constraints protect required data.

### Key Database Features

**Indexing Strategy:** GIST indexes on geographic columns, B-tree indexes on foreign keys, composite indexes for common query patterns, and optimized translation cache indexes for multilingual queries.

**PostGIS Functions:** ST_Distance for calculations, GEOMETRY(POINT, 4326) for storage, and spatial indexing enable efficient location-based operations.

### Translation Cache Schema

**Master Data Translations Table:**
```sql
CREATE TABLE master_data_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_language VARCHAR(2) DEFAULT 'auto',
  target_language VARCHAR(2) NOT NULL CHECK (target_language IN ('de', 'fr', 'it', 'en')),
  context VARCHAR(50) NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),

  UNIQUE(original_text, target_language, context)
);
```

**Translation Cache Indexes:**
```sql
-- Performance optimization for translation lookups
CREATE INDEX idx_master_data_translations_lookup
ON master_data_translations(original_text, target_language, context);

-- Cleanup optimization for expired translations
CREATE INDEX idx_master_data_translations_expiry
ON master_data_translations(expires_at);
```

**Automatic Cleanup Function:**
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_master_data_translations()
RETURNS void AS $$
BEGIN
  DELETE FROM master_data_translations WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

## Data Security & Privacy

**Access Control:** Row-level security through cognito_user_id filtering ensures users access only their own data, with managers limited to direct reports and admin users having controlled elevated access.

**Translation Data Privacy:** Translation cache contains no personal information, only business content (project names, descriptions) with automatic expiration.

**Data Privacy:** Home addresses stored for calculation purposes only, with personal information access controlled by authentication and comprehensive audit trails.

This data architecture ensures secure, efficient management of travel allowance data while maintaining strong entity relationships, comprehensive audit capabilities, and optimized multilingual content translation with intelligent caching strategies.