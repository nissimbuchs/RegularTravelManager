-- RegularTravelManager Database Schema
-- Description: Database schema creation for PostgreSQL with PostGIS
-- Version: 1.0
-- Date: 2025-09-04
-- NOTE: This file contains ONLY schema - sample data is loaded via sample-data.sql

-- Enable PostGIS extension for geographic functions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean slate - remove existing tables if present
DROP TABLE IF EXISTS request_status_history CASCADE;
DROP TABLE IF EXISTS employee_address_history CASCADE;
DROP TABLE IF EXISTS calculation_cache CASCADE;
DROP TABLE IF EXISTS calculation_audit CASCADE;
DROP TABLE IF EXISTS travel_requests CASCADE;
DROP TABLE IF EXISTS subprojects CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;

-- Schema migrations tracking table
CREATE TABLE schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64) NOT NULL
);

-- Employees table with home address and coordinates
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    home_street VARCHAR(255) NOT NULL,
    home_city VARCHAR(100) NOT NULL,
    home_postal_code VARCHAR(20) NOT NULL,
    home_country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
    home_location GEOMETRY(POINT, 4326) NOT NULL,
    manager_id UUID REFERENCES employees(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cognito_user_id VARCHAR(255) NOT NULL UNIQUE,
    employee_id VARCHAR(50) NOT NULL UNIQUE
);

-- Projects table for organizing work locations
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_cost_per_km DECIMAL(10,2) NOT NULL CHECK (default_cost_per_km > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subprojects table for specific work locations  
CREATE TABLE subprojects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    street_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
    location GEOMETRY(POINT, 4326) NOT NULL,
    cost_per_km DECIMAL(10,2) NOT NULL CHECK (cost_per_km > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Travel requests table (main aggregate)
CREATE TABLE travel_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    manager_id UUID NOT NULL REFERENCES employees(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    subproject_id UUID NOT NULL REFERENCES subprojects(id),
    days_per_week INTEGER NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
    justification TEXT NOT NULL CHECK (LENGTH(justification) >= 10),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    calculated_distance_km DECIMAL(10,3) NOT NULL CHECK (calculated_distance_km >= 0),
    calculated_allowance_chf DECIMAL(10,2) NOT NULL CHECK (calculated_allowance_chf >= 0),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE NULL,
    processed_by UUID NULL REFERENCES employees(id),
    rejection_reason TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employee address history for audit trail
CREATE TABLE employee_address_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    previous_street VARCHAR(255) NOT NULL,
    previous_city VARCHAR(100) NOT NULL,
    previous_postal_code VARCHAR(20) NOT NULL,
    previous_country VARCHAR(100) NOT NULL,
    previous_location GEOMETRY(POINT, 4326) NOT NULL,
    new_street VARCHAR(255) NOT NULL,
    new_city VARCHAR(100) NOT NULL,
    new_postal_code VARCHAR(20) NOT NULL,
    new_country VARCHAR(100) NOT NULL,
    new_location GEOMETRY(POINT, 4326) NOT NULL,
    reason TEXT,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by UUID NOT NULL REFERENCES employees(id)
);

-- Request status history for audit trail  
CREATE TABLE request_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    travel_request_id UUID NOT NULL REFERENCES travel_requests(id),
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    comment TEXT,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by UUID NOT NULL REFERENCES employees(id)
);

-- Database indexes for performance
CREATE INDEX idx_employees_manager_id ON employees(manager_id);
CREATE INDEX idx_employees_location ON employees USING GIST (home_location);
CREATE INDEX idx_employees_cognito_user_id ON employees(cognito_user_id);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_projects_is_active ON projects(is_active);
CREATE INDEX idx_subprojects_project_id ON subprojects(project_id);
CREATE INDEX idx_subprojects_location ON subprojects USING GIST (location);
CREATE INDEX idx_subprojects_is_active ON subprojects(is_active);
CREATE INDEX idx_travel_requests_employee_id ON travel_requests(employee_id);
CREATE INDEX idx_travel_requests_manager_id ON travel_requests(manager_id);
CREATE INDEX idx_travel_requests_status ON travel_requests(status);
CREATE INDEX idx_travel_requests_submitted_at ON travel_requests(submitted_at);
CREATE INDEX idx_employee_address_history_employee_id ON employee_address_history(employee_id);
CREATE INDEX idx_request_status_history_travel_request_id ON request_status_history(travel_request_id);

-- Add constraint to ensure valid employee ID format
ALTER TABLE employees 
ADD CONSTRAINT chk_employee_id_format 
CHECK (employee_id ~ '^(EMP|MGR|ADM)-[0-9]{4}$');

-- Function to calculate distance using PostGIS
CREATE OR REPLACE FUNCTION calculate_travel_distance(
    employee_location GEOMETRY,
    project_location GEOMETRY
) RETURNS DECIMAL(10,3) AS $$
BEGIN
    RETURN ST_Distance(
        employee_location::geography, 
        project_location::geography
    ) / 1000.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to sync employee data with Cognito user
CREATE OR REPLACE FUNCTION sync_employee_with_cognito(
  p_email VARCHAR(255),
  p_first_name VARCHAR(100),  
  p_last_name VARCHAR(100),
  p_home_address TEXT
) RETURNS UUID AS $$
DECLARE
  existing_employee_id UUID;
  new_employee_id UUID;
BEGIN
  -- Check if employee already exists by email
  SELECT id INTO existing_employee_id 
  FROM employees 
  WHERE email = p_email;
  
  IF existing_employee_id IS NOT NULL THEN
    -- Update existing employee
    UPDATE employees 
    SET first_name = p_first_name,
        last_name = p_last_name,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = existing_employee_id;
    
    RETURN existing_employee_id;
  ELSE
    -- Create new employee with default values
    INSERT INTO employees (
      email,
      cognito_user_id,
      employee_id,
      first_name,
      last_name,
      home_street,
      home_city,
      home_postal_code,
      home_country,
      home_location
    ) VALUES (
      p_email,
      REPLACE(LOWER(p_email), '@', '-') || '-cognito-id',
      'EMP-' || LPAD((SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 5) AS INTEGER)), 0) + 1 FROM employees WHERE employee_id LIKE 'EMP-%')::TEXT, 4, '0'),
      p_first_name,
      p_last_name,
      'Default Street 1',
      'Zürich', 
      '8001',
      'Switzerland',
      ST_GeomFromText('POINT(8.540192 47.376887)', 4326)::geometry
    )
    RETURNING id INTO new_employee_id;
    
    RETURN new_employee_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Record schema migrations as completed
INSERT INTO schema_migrations (version, filename, checksum) VALUES 
  ('001_initial_schema', '001_initial_schema.sql', 'init_checksum_001'),
  ('002_add_cognito_fields', '002_add_cognito_fields.sql', 'init_checksum_002'),
  ('003_distance_calculation_functions', '003_distance_calculation_functions.sql', 'init_checksum_003');

-- Database initialization completed (schema only, no sample data)
INSERT INTO schema_migrations (version, filename, checksum) VALUES ('init_complete_v17', 'init-db-schema-only.sql', 'init_schema_only_checksum');