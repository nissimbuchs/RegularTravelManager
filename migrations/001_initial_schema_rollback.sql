-- Rollback Migration: 001_initial_schema_rollback.sql
-- Description: Rollback initial database schema migration
-- Version: 1.0
-- Date: 2025-08-30

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS request_status_history;
DROP TABLE IF EXISTS employee_address_history;
DROP TABLE IF EXISTS travel_requests;
DROP TABLE IF EXISTS subprojects;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS employees;

-- Drop custom functions
DROP FUNCTION IF EXISTS calculate_travel_distance(GEOMETRY, GEOMETRY);

-- Drop extensions (only if no other dependencies exist)
-- Note: Extensions should only be dropped if no other tables/functions depend on them
-- DROP EXTENSION IF EXISTS "uuid-ossp";
-- DROP EXTENSION IF EXISTS postgis;