-- Database Initialization Script for RegularTravelManager
-- This script sets up the complete database schema and initial data
-- Compatible with PostgreSQL 16 + PostGIS 3.4

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for fresh start)
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
    -- Cognito authentication fields
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

-- Calculation audit table
CREATE TABLE calculation_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    travel_request_id UUID NOT NULL REFERENCES travel_requests(id),
    employee_location GEOMETRY(POINT, 4326) NOT NULL,
    work_location GEOMETRY(POINT, 4326) NOT NULL,
    calculated_distance_km DECIMAL(10,3) NOT NULL,
    calculation_method VARCHAR(50) NOT NULL DEFAULT 'PostGIS_Distance',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Calculation cache table for performance
CREATE TABLE calculation_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_location GEOMETRY(POINT, 4326) NOT NULL,
    to_location GEOMETRY(POINT, 4326) NOT NULL,
    distance_km DECIMAL(10,3) NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
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
CREATE INDEX idx_calculation_cache_locations ON calculation_cache USING GIST (from_location, to_location);
CREATE INDEX idx_calculation_cache_expires ON calculation_cache(expires_at);

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

-- Add constraint to ensure valid employee ID format
ALTER TABLE employees 
ADD CONSTRAINT chk_employee_id_format 
CHECK (employee_id ~ '^(EMP|MGR|ADM)-[0-9]{4}$');

-- Function to sync employee data with Cognito user
CREATE OR REPLACE FUNCTION sync_employee_with_cognito(
  p_email VARCHAR(255),
  p_cognito_user_id VARCHAR(255),
  p_first_name VARCHAR(100),
  p_last_name VARCHAR(100)
) RETURNS UUID AS $$
DECLARE
  employee_uuid UUID;
  next_employee_number INTEGER;
BEGIN
  -- Check if employee already exists by email
  SELECT id INTO employee_uuid FROM employees WHERE email = p_email;
  
  IF employee_uuid IS NOT NULL THEN
    -- Update existing employee with Cognito ID
    UPDATE employees 
    SET 
      cognito_user_id = p_cognito_user_id,
      first_name = p_first_name,
      last_name = p_last_name,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = employee_uuid;
    
    RETURN employee_uuid;
  ELSE
    -- Get next employee number
    SELECT COALESCE(MAX(SUBSTRING(employee_id FROM '(EMP|MGR)-([0-9]+)')::INTEGER), 0) + 1
    INTO next_employee_number
    FROM employees
    WHERE employee_id ~ '^(EMP|MGR)-[0-9]+$';
    
    -- Create new employee record
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
      p_cognito_user_id,
      'EMP-' || LPAD(next_employee_number::text, 4, '0'),
      p_first_name,
      p_last_name,
      'Pending Address',
      'Pending City',
      '0000',
      'Switzerland',
      ST_SetSRID(ST_MakePoint(7.447447, 46.947974), 4326) -- Default to Bern coordinates
    )
    RETURNING id INTO employee_uuid;
    
    RETURN employee_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert sample employees with correct cognito_user_ids for development
INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, home_postal_code, home_country, home_location, manager_id, is_active, cognito_user_id, employee_id)
VALUES 
  (
    '550e8400-e29b-41d4-a716-446655440001',
    'employee1@company.com',
    'John',
    'Employee',
    'Bahnhofstrasse 123',
    'Zürich',
    '8001',
    'Switzerland',
    ST_GeomFromText('POINT(8.540192 47.376887)', 4326),
    NULL,
    true,
    'employee1-cognito-id',
    'EMP-0001'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440002',
    'employee2@company.com', 
    'Jane',
    'Worker',
    'Freie Strasse 78',
    'Basel',
    '4001',
    'Switzerland',
    ST_GeomFromText('POINT(7.588576 47.559599)', 4326),
    '550e8400-e29b-41d4-a716-446655440001',
    true,
    'employee2-cognito-id',
    'EMP-0002'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440003',
    'manager1@company.com',
    'Bob', 
    'Manager',
    'Kramgasse 45',
    'Bern',
    '3011',
    'Switzerland',
    ST_GeomFromText('POINT(7.447447 46.947974)', 4326),
    NULL,
    true,
    'manager1-cognito-id',
    'MGR-0001'
  );

-- Insert sample projects
INSERT INTO projects (id, name, description, default_cost_per_km, is_active)
VALUES 
  (
    '660e8400-e29b-41d4-a716-446655440001',
    'Digital Transformation Initiative',
    'Company-wide digital transformation project including system modernization and process optimization',
    0.70,
    true
  ),
  (
    '660e8400-e29b-41d4-a716-446655440002',
    'Infrastructure Modernization',
    'Upgrading IT infrastructure and network systems across all Swiss offices',
    0.75,
    true
  );

-- Insert sample subprojects with realistic Swiss locations
INSERT INTO subprojects (id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active)
VALUES 
  (
    '770e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440001',
    'Geneva Digital Hub',
    'Rue du Rhône 65',
    'Genève',
    '1204',
    'Switzerland',
    ST_GeomFromText('POINT(6.143158 46.204391)', 4326),
    0.70,
    true
  ),
  (
    '770e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440001',
    'Lausanne Development Center',
    'Place St-François 12',
    'Lausanne',
    '1003',
    'Switzerland',
    ST_GeomFromText('POINT(6.633597 46.519653)', 4326),
    0.70,
    true
  ),
  (
    '770e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440002',
    'Zürich Data Center',
    'Limmatquai 92',
    'Zürich',
    '8001',
    'Switzerland',
    ST_GeomFromText('POINT(8.544054 47.370371)', 4326),
    0.75,
    true
  ),
  (
    '770e8400-e29b-41d4-a716-446655440004',
    '660e8400-e29b-41d4-a716-446655440002',
    'St. Gallen Regional Office',
    'Multergasse 25',
    'St. Gallen',
    '9000',
    'Switzerland',
    ST_GeomFromText('POINT(9.376716 47.424057)', 4326),
    0.75,
    true
  );

-- Insert sample travel requests
INSERT INTO travel_requests (
    id,
    employee_id,
    manager_id,
    project_id,
    subproject_id,
    days_per_week,
    justification,
    status,
    calculated_distance_km,
    calculated_allowance_chf,
    submitted_at
)
VALUES 
  (
    '880e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440001',
    3,
    'Need to work on-site in Geneva to coordinate with international team for digital transformation project. Remote collaboration has been challenging due to timezone and communication barriers.',
    'pending',
    calculate_travel_distance(
        ST_GeomFromText('POINT(8.540192 47.376887)', 4326),
        ST_GeomFromText('POINT(6.143158 46.204391)', 4326)
    ),
    calculate_travel_distance(
        ST_GeomFromText('POINT(8.540192 47.376887)', 4326),
        ST_GeomFromText('POINT(6.143158 46.204391)', 4326)
    ) * 0.70 * 3,
    CURRENT_TIMESTAMP
  ),
  (
    '880e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440002',
    '770e8400-e29b-41d4-a716-446655440004',
    2,
    'Required to oversee infrastructure modernization at St. Gallen office. Physical presence needed for server installations and network configuration that cannot be done remotely.',
    'approved',
    calculate_travel_distance(
        ST_GeomFromText('POINT(7.588576 47.559599)', 4326),
        ST_GeomFromText('POINT(9.376716 47.424057)', 4326)
    ),
    calculate_travel_distance(
        ST_GeomFromText('POINT(7.588576 47.559599)', 4326),
        ST_GeomFromText('POINT(9.376716 47.424057)', 4326)
    ) * 0.75 * 2,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  );

-- Update the approved request with processing information
UPDATE travel_requests 
SET 
    processed_at = CURRENT_TIMESTAMP - INTERVAL '1 day',
    processed_by = '550e8400-e29b-41d4-a716-446655440003'
WHERE id = '880e8400-e29b-41d4-a716-446655440002';

-- Insert status history for the approved request
INSERT INTO request_status_history (travel_request_id, previous_status, new_status, comment, changed_by)
VALUES (
    '880e8400-e29b-41d4-a716-446655440002',
    'pending',
    'approved',
    'Approved due to clear business necessity and reasonable travel distance.',
    '550e8400-e29b-41d4-a716-446655440003'
);

-- Record schema migrations
INSERT INTO schema_migrations (version, filename, checksum) VALUES 
  ('001_initial_schema', '001_initial_schema.sql', 'init_checksum_001'),
  ('002_add_cognito_fields', '002_add_cognito_fields.sql', 'init_checksum_002'),
  ('003_distance_calculation_functions', '003_distance_calculation_functions.sql', 'init_checksum_003');

-- Database initialization completed
INSERT INTO schema_migrations (version, filename, checksum) VALUES ('init_complete_v16', 'init-db.sql', 'init_checksum_complete');