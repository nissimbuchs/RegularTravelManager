-- Seed Data: 001_initial_seed_data.sql
-- Description: Insert initial sample data for Swiss business context
-- Version: 1.0
-- Date: 2025-08-30

-- Insert sample employees with Swiss addresses
-- Manager: Hans Müller in Zürich
INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, home_postal_code, home_country, home_location, manager_id, is_active)
VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'hans.mueller@company.ch',
    'Hans',
    'Müller',
    'Bahnhofstrasse 123',
    'Zürich',
    '8001',
    'Switzerland',
    ST_GeomFromText('POINT(8.540192 47.376887)', 4326), -- Zürich coordinates
    NULL, -- Manager has no manager
    true
);

-- Employee 1: Anna Schneider in Bern
INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, home_postal_code, home_country, home_location, manager_id, is_active)
VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    'anna.schneider@company.ch',
    'Anna',
    'Schneider',
    'Kramgasse 45',
    'Bern',
    '3011',
    'Switzerland',
    ST_GeomFromText('POINT(7.447447 46.947974)', 4326), -- Bern coordinates
    '550e8400-e29b-41d4-a716-446655440001', -- Reports to Hans
    true
);

-- Employee 2: Marco Rossi in Basel
INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, home_postal_code, home_country, home_location, manager_id, is_active)
VALUES (
    '550e8400-e29b-41d4-a716-446655440003',
    'marco.rossi@company.ch',
    'Marco',
    'Rossi',
    'Freie Strasse 78',
    'Basel',
    '4001',
    'Switzerland',
    ST_GeomFromText('POINT(7.588576 47.559599)', 4326), -- Basel coordinates
    '550e8400-e29b-41d4-a716-446655440001', -- Reports to Hans
    true
);

-- Insert sample projects
-- Project 1: Digital Transformation Initiative
INSERT INTO projects (id, name, description, default_cost_per_km, is_active)
VALUES (
    '660e8400-e29b-41d4-a716-446655440001',
    'Digital Transformation Initiative',
    'Company-wide digital transformation project including system modernization and process optimization',
    0.70, -- 0.70 CHF per kilometer (standard Swiss business rate)
    true
);

-- Project 2: Infrastructure Modernization
INSERT INTO projects (id, name, description, default_cost_per_km, is_active)
VALUES (
    '660e8400-e29b-41d4-a716-446655440002',
    'Infrastructure Modernization',
    'Upgrading IT infrastructure and network systems across all Swiss offices',
    0.75, -- 0.75 CHF per kilometer (higher rate for specialized work)
    true
);

-- Insert sample subprojects with realistic Swiss locations
-- Subproject 1-1: Geneva Office Digital Hub
INSERT INTO subprojects (id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active)
VALUES (
    '770e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440001',
    'Geneva Digital Hub',
    'Rue du Rhône 65',
    'Genève',
    '1204',
    'Switzerland',
    ST_GeomFromText('POINT(6.143158 46.204391)', 4326), -- Geneva coordinates
    0.70,
    true
);

-- Subproject 1-2: Lausanne Development Center
INSERT INTO subprojects (id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active)
VALUES (
    '770e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440001',
    'Lausanne Development Center',
    'Place St-François 12',
    'Lausanne',
    '1003',
    'Switzerland',
    ST_GeomFromText('POINT(6.633597 46.519653)', 4326), -- Lausanne coordinates
    0.70,
    true
);

-- Subproject 2-1: Zürich Data Center
INSERT INTO subprojects (id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active)
VALUES (
    '770e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440002',
    'Zürich Data Center',
    'Limmatquai 92',
    'Zürich',
    '8001',
    'Switzerland',
    ST_GeomFromText('POINT(8.544054 47.370371)', 4326), -- Zürich coordinates
    0.75,
    true
);

-- Subproject 2-2: St. Gallen Regional Office
INSERT INTO subprojects (id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active)
VALUES (
    '770e8400-e29b-41d4-a716-446655440004',
    '660e8400-e29b-41d4-a716-446655440002',
    'St. Gallen Regional Office',
    'Multergasse 25',
    'St. Gallen',
    '9000',
    'Switzerland',
    ST_GeomFromText('POINT(9.376716 47.424057)', 4326), -- St. Gallen coordinates
    0.75,
    true
);

-- Insert sample travel requests to test complete workflow
-- Travel Request 1: Anna to Geneva (long distance, good test case)
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
VALUES (
    '880e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002', -- Anna Schneider
    '550e8400-e29b-41d4-a716-446655440001', -- Hans Müller (manager)
    '660e8400-e29b-41d4-a716-446655440001', -- Digital Transformation Initiative
    '770e8400-e29b-41d4-a716-446655440001', -- Geneva Digital Hub
    3, -- 3 days per week
    'Need to work on-site in Geneva to coordinate with international team for digital transformation project. Remote collaboration has been challenging due to timezone and communication barriers.',
    'pending',
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '550e8400-e29b-41d4-a716-446655440002'),
        (SELECT location FROM subprojects WHERE id = '770e8400-e29b-41d4-a716-446655440001')
    ),
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '550e8400-e29b-41d4-a716-446655440002'),
        (SELECT location FROM subprojects WHERE id = '770e8400-e29b-41d4-a716-446655440001')
    ) * 0.70 * 3, -- distance * cost_per_km * days_per_week
    CURRENT_TIMESTAMP
);

-- Travel Request 2: Marco to St. Gallen (shorter distance)
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
VALUES (
    '880e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003', -- Marco Rossi
    '550e8400-e29b-41d4-a716-446655440001', -- Hans Müller (manager)
    '660e8400-e29b-41d4-a716-446655440002', -- Infrastructure Modernization
    '770e8400-e29b-41d4-a716-446655440004', -- St. Gallen Regional Office
    2, -- 2 days per week
    'Required to oversee infrastructure modernization at St. Gallen office. Physical presence needed for server installations and network configuration that cannot be done remotely.',
    'approved',
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '550e8400-e29b-41d4-a716-446655440003'),
        (SELECT location FROM subprojects WHERE id = '770e8400-e29b-41d4-a716-446655440004')
    ),
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '550e8400-e29b-41d4-a716-446655440003'),
        (SELECT location FROM subprojects WHERE id = '770e8400-e29b-41d4-a716-446655440004')
    ) * 0.75 * 2, -- distance * cost_per_km * days_per_week
    CURRENT_TIMESTAMP - INTERVAL '2 days'
);

-- Update the approved request with processing information
UPDATE travel_requests 
SET 
    processed_at = CURRENT_TIMESTAMP - INTERVAL '1 day',
    processed_by = '550e8400-e29b-41d4-a716-446655440001' -- Processed by Hans
WHERE id = '880e8400-e29b-41d4-a716-446655440002';

-- Insert status history for the approved request
INSERT INTO request_status_history (travel_request_id, previous_status, new_status, comment, changed_by)
VALUES (
    '880e8400-e29b-41d4-a716-446655440002',
    'pending',
    'approved',
    'Approved due to clear business necessity and reasonable travel distance.',
    '550e8400-e29b-41d4-a716-446655440001' -- Hans approved it
);