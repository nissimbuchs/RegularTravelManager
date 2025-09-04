-- Comprehensive Sample Data: RegularTravelManager
-- Description: Complete Swiss business sample data for development and testing
-- Version: 1.0
-- Date: 2025-09-04
-- 
-- This script creates comprehensive, realistic sample data including:
-- - Swiss employees with diverse home locations
-- - Manager hierarchy and admin users  
-- - Projects and subprojects with accurate Swiss coordinates
-- - Complete travel request lifecycle examples
-- - Audit trail and status change history
--
-- NOTE: This script assumes a clean database schema created by init-db.sql

-- =============================================================================
-- EMPLOYEE DATA - Swiss business context with realistic names and addresses
-- =============================================================================

-- MANAGERS AND ADMIN USERS
-- Admin User 1: CEO/System Administrator
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'admin1@company.ch',
    'ADM-0001',
    'admin1@company.ch',
    'Hans',
    'Zimmermann',
    'Bahnhofstrasse 1',
    'Zürich',
    '8001',
    'Switzerland',
    ST_GeomFromText('POINT(8.540192 47.376887)', 4326), -- Zürich coordinates
    NULL, -- No manager (CEO)
    true
);

-- Admin User 2: IT Administrator
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'admin2@company.ch',
    'ADM-0002',
    'admin2@company.ch',
    'Maria',
    'Weber',
    'Spiegelgasse 12',
    'Basel',
    '4001',
    'Switzerland',
    ST_GeomFromText('POINT(7.588576 47.559599)', 4326), -- Basel coordinates
    '11111111-1111-1111-1111-111111111111', -- Reports to CEO
    true
);

-- Manager 1: Regional Manager Zurich
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'manager1@company.ch',
    'MGR-0001',
    'manager1@company.ch',
    'Thomas',
    'Müller',
    'Limmatquai 42',
    'Zürich',
    '8001',
    'Switzerland',
    ST_GeomFromText('POINT(8.544054 47.370371)', 4326), -- Zürich coordinates
    '11111111-1111-1111-1111-111111111111', -- Reports to CEO
    true
);

-- Manager 2: Regional Manager Geneva
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'manager2@company.ch',
    'MGR-0002',
    'manager2@company.ch',
    'Sophie',
    'Dubois',
    'Rue du Rhône 15',
    'Genève',
    '1204',
    'Switzerland',
    ST_GeomFromText('POINT(6.143158 46.204391)', 4326), -- Geneva coordinates
    '11111111-1111-1111-1111-111111111111', -- Reports to CEO
    true
);

-- REGULAR EMPLOYEES
-- Employee 1: Software Developer
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    'employee1@company.ch',
    'EMP-0001',
    'employee1@company.ch',
    'Anna',
    'Schneider',
    'Kramgasse 45',
    'Bern',
    '3011',
    'Switzerland',
    ST_GeomFromText('POINT(7.447447 46.947974)', 4326), -- Bern coordinates
    '33333333-3333-3333-3333-333333333333', -- Reports to Manager 1
    true
);

-- Employee 2: Project Coordinator
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '66666666-6666-6666-6666-666666666666',
    'employee2@company.ch',
    'EMP-0002',
    'employee2@company.ch',
    'Marco',
    'Rossi',
    'Via Nassa 28',
    'Lugano',
    '6900',
    'Switzerland',
    ST_GeomFromText('POINT(8.951052 46.003677)', 4326), -- Lugano coordinates
    '44444444-4444-4444-4444-444444444444', -- Reports to Manager 2
    true
);

-- Employee 3: Business Analyst
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '77777777-7777-7777-7777-777777777777',
    'employee3@company.ch',
    'EMP-0003',
    'employee3@company.ch',
    'Lisa',
    'Meier',
    'Kornhausstrasse 18',
    'St. Gallen',
    '9000',
    'Switzerland',
    ST_GeomFromText('POINT(9.376716 47.424057)', 4326), -- St. Gallen coordinates
    '33333333-3333-3333-3333-333333333333', -- Reports to Manager 1
    true
);

-- Employee 4: Marketing Specialist
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '88888888-8888-8888-8888-888888888888',
    'employee4@company.ch',
    'EMP-0004',
    'employee4@company.ch',
    'Pierre',
    'Martin',
    'Avenue de la Gare 33',
    'Lausanne',
    '1003',
    'Switzerland',
    ST_GeomFromText('POINT(6.633597 46.519653)', 4326), -- Lausanne coordinates
    '44444444-4444-4444-4444-444444444444', -- Reports to Manager 2
    true
);

-- Employee 5: Technical Consultant
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '99999999-9999-9999-9999-999999999999',
    'employee5@company.ch',
    'EMP-0005',
    'employee5@company.ch',
    'Julia',
    'Fischer',
    'Marktplatz 7',
    'Basel',
    '4001',
    'Switzerland',
    ST_GeomFromText('POINT(7.590843 47.557421)', 4326), -- Basel coordinates
    '33333333-3333-3333-3333-333333333333', -- Reports to Manager 1
    true
);

-- Employee 6: Sales Representative
INSERT INTO employees (
    id, cognito_user_id, employee_id, email, first_name, last_name,
    home_street, home_city, home_postal_code, home_country, home_location,
    manager_id, is_active
) VALUES (
    '10101010-1010-1010-1010-101010101010',
    'employee6@company.ch',
    'EMP-0006',
    'employee6@company.ch',
    'Michael',
    'Keller',
    'Hauptstrasse 56',
    'Winterthur',
    '8400',
    'Switzerland',
    ST_GeomFromText('POINT(8.724493 47.499836)', 4326), -- Winterthur coordinates
    '44444444-4444-4444-4444-444444444444', -- Reports to Manager 2
    true
);

-- =============================================================================
-- PROJECT DATA - Swiss business projects with realistic locations
-- =============================================================================

-- Project 1: Digital Transformation Initiative
INSERT INTO projects (
    id, name, description, default_cost_per_km, is_active
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Digital Transformation Initiative',
    'Company-wide digital transformation project including system modernization, process optimization, and employee training across all Swiss locations.',
    0.70, -- 0.70 CHF per kilometer (standard Swiss business rate)
    true
);

-- Project 2: Infrastructure Modernization Program
INSERT INTO projects (
    id, name, description, default_cost_per_km, is_active
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Infrastructure Modernization Program',
    'Comprehensive upgrade of IT infrastructure including server modernization, network optimization, and security enhancements across regional offices.',
    0.75, -- 0.75 CHF per kilometer (higher rate for specialized work)
    true
);

-- Project 3: Customer Experience Enhancement
INSERT INTO projects (
    id, name, description, default_cost_per_km, is_active
) VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Customer Experience Enhancement',
    'Multi-phase project to improve customer touchpoints, implement new CRM systems, and enhance service delivery processes.',
    0.65, -- 0.65 CHF per kilometer (standard rate)
    true
);

-- Project 4: Sustainability & Green Office Initiative  
INSERT INTO projects (
    id, name, description, default_cost_per_km, is_active
) VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Sustainability & Green Office Initiative',
    'Environmental sustainability project focusing on carbon footprint reduction, energy efficiency, and sustainable business practices.',
    0.80, -- 0.80 CHF per kilometer (premium rate for sustainability consulting)
    true
);

-- =============================================================================
-- SUBPROJECT DATA - Specific Swiss locations with accurate coordinates
-- =============================================================================

-- Digital Transformation - Geneva Office
INSERT INTO subprojects (
    id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active
) VALUES (
    'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Geneva Digital Hub',
    'Rue du Rhône 65',
    'Genève',
    '1204',
    'Switzerland',
    ST_GeomFromText('POINT(6.143158 46.204391)', 4326), -- Geneva coordinates
    0.70,
    true
);

-- Digital Transformation - Lausanne Development Center
INSERT INTO subprojects (
    id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active
) VALUES (
    'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Lausanne Development Center',
    'Place St-François 12',
    'Lausanne',
    '1003',
    'Switzerland',
    ST_GeomFromText('POINT(6.633597 46.519653)', 4326), -- Lausanne coordinates
    0.70,
    true
);

-- Infrastructure Modernization - Zurich Data Center
INSERT INTO subprojects (
    id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active
) VALUES (
    'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Zürich Data Center',
    'Limmatquai 92',
    'Zürich',
    '8001',
    'Switzerland',
    ST_GeomFromText('POINT(8.544054 47.370371)', 4326), -- Zürich coordinates
    0.75,
    true
);

-- Infrastructure Modernization - St. Gallen Regional Office
INSERT INTO subprojects (
    id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active
) VALUES (
    'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'St. Gallen Regional Office',
    'Kornhausstrasse 25',
    'St. Gallen',
    '9000',
    'Switzerland',
    ST_GeomFromText('POINT(9.376716 47.424057)', 4326), -- St. Gallen coordinates
    0.75,
    true
);

-- Customer Experience - Basel Customer Center
INSERT INTO subprojects (
    id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active
) VALUES (
    'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Basel Customer Center',
    'Freie Strasse 78',
    'Basel',
    '4001',
    'Switzerland',
    ST_GeomFromText('POINT(7.588576 47.559599)', 4326), -- Basel coordinates
    0.65,
    true
);

-- Customer Experience - Lugano Service Point
INSERT INTO subprojects (
    id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active
) VALUES (
    'e6e6e6e6-e6e6-e6e6-e6e6-e6e6e6e6e6e6',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Lugano Service Point',
    'Via Nassa 45',
    'Lugano',
    '6900',
    'Switzerland',
    ST_GeomFromText('POINT(8.951052 46.003677)', 4326), -- Lugano coordinates
    0.65,
    true
);

-- Sustainability - Bern Headquarters
INSERT INTO subprojects (
    id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active
) VALUES (
    'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Bern Headquarters Sustainability Office',
    'Bundesplatz 3',
    'Bern',
    '3003',
    'Switzerland',
    ST_GeomFromText('POINT(7.444608 46.946926)', 4326), -- Bern coordinates
    0.80,
    true
);

-- Sustainability - Winterthur Green Campus
INSERT INTO subprojects (
    id, project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active
) VALUES (
    'e8e8e8e8-e8e8-e8e8-e8e8-e8e8e8e8e8e8',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Winterthur Green Campus',
    'Technikumstrasse 9',
    'Winterthur',
    '8400',
    'Switzerland',
    ST_GeomFromText('POINT(8.724493 47.499836)', 4326), -- Winterthur coordinates
    0.80,
    true
);

-- =============================================================================
-- TRAVEL REQUEST DATA - Complete lifecycle examples
-- =============================================================================

-- Travel Request 1: Anna (Bern) to Geneva Digital Hub - PENDING
INSERT INTO travel_requests (
    id, employee_id, manager_id, project_id, subproject_id,
    days_per_week, justification, status,
    calculated_distance_km, calculated_allowance_chf, submitted_at
) VALUES (
    'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
    '55555555-5555-5555-5555-555555555555', -- Anna Schneider
    '33333333-3333-3333-3333-333333333333', -- Manager 1
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -- Digital Transformation
    'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', -- Geneva Digital Hub
    3, -- 3 days per week
    'Required on-site presence in Geneva for digital transformation project. Need to coordinate with international team and conduct stakeholder meetings that cannot be effectively done remotely due to sensitive nature of discussions.',
    'pending',
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '55555555-5555-5555-5555-555555555555'),
        (SELECT location FROM subprojects WHERE id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1')
    ),
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '55555555-5555-5555-5555-555555555555'),
        (SELECT location FROM subprojects WHERE id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1')
    ) * 0.70 * 3, -- distance * cost_per_km * days_per_week
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
);

-- Travel Request 2: Marco (Lugano) to St. Gallen - APPROVED
INSERT INTO travel_requests (
    id, employee_id, manager_id, project_id, subproject_id,
    days_per_week, justification, status,
    calculated_distance_km, calculated_allowance_chf, submitted_at,
    processed_at, processed_by
) VALUES (
    'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2',
    '66666666-6666-6666-6666-666666666666', -- Marco Rossi
    '44444444-4444-4444-4444-444444444444', -- Manager 2
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- Infrastructure Modernization
    'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4', -- St. Gallen Regional Office
    2, -- 2 days per week
    'Infrastructure modernization at St. Gallen requires hands-on server configuration and network setup. Physical presence essential for hardware installation and security protocol implementation.',
    'approved',
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '66666666-6666-6666-6666-666666666666'),
        (SELECT location FROM subprojects WHERE id = 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4')
    ),
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '66666666-6666-6666-6666-666666666666'),
        (SELECT location FROM subprojects WHERE id = 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4')
    ) * 0.75 * 2, -- distance * cost_per_km * days_per_week
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    '44444444-4444-4444-4444-444444444444' -- Approved by Manager 2
);

-- Travel Request 3: Lisa (St. Gallen) to Basel Customer Center - REJECTED
INSERT INTO travel_requests (
    id, employee_id, manager_id, project_id, subproject_id,
    days_per_week, justification, status,
    calculated_distance_km, calculated_allowance_chf, submitted_at,
    processed_at, processed_by, rejection_reason
) VALUES (
    'f3f3f3f3-f3f3-f3f3-f3f3-f3f3f3f3f3f3',
    '77777777-7777-7777-7777-777777777777', -- Lisa Meier
    '33333333-3333-3333-3333-333333333333', -- Manager 1
    'cccccccc-cccc-cccc-cccc-cccccccccccc', -- Customer Experience Enhancement
    'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', -- Basel Customer Center
    4, -- 4 days per week
    'Customer experience analysis requires extended on-site observation and interviews with Basel customer service team.',
    'rejected',
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '77777777-7777-7777-7777-777777777777'),
        (SELECT location FROM subprojects WHERE id = 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5')
    ),
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '77777777-7777-7777-7777-777777777777'),
        (SELECT location FROM subprojects WHERE id = 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5')
    ) * 0.65 * 4, -- distance * cost_per_km * days_per_week
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    '33333333-3333-3333-3333-333333333333', -- Rejected by Manager 1
    'Request denied due to excessive travel time (4 days/week). Customer analysis can be conducted through remote interviews and data analysis. Consider reducing to 2 days/week maximum.'
);

-- Travel Request 4: Julia (Basel) to Zurich Data Center - APPROVED
INSERT INTO travel_requests (
    id, employee_id, manager_id, project_id, subproject_id,
    days_per_week, justification, status,
    calculated_distance_km, calculated_allowance_chf, submitted_at,
    processed_at, processed_by
) VALUES (
    'f4f4f4f4-f4f4-f4f4-f4f4-f4f4f4f4f4f4',
    '99999999-9999-9999-9999-999999999999', -- Julia Fischer
    '33333333-3333-3333-3333-333333333333', -- Manager 1
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- Infrastructure Modernization
    'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', -- Zürich Data Center
    1, -- 1 day per week
    'Weekly technical consultation required for Zurich data center modernization. Specialized security expertise needed for compliance validation.',
    'approved',
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '99999999-9999-9999-9999-999999999999'),
        (SELECT location FROM subprojects WHERE id = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3')
    ),
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '99999999-9999-9999-9999-999999999999'),
        (SELECT location FROM subprojects WHERE id = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3')
    ) * 0.75 * 1, -- distance * cost_per_km * days_per_week
    CURRENT_TIMESTAMP - INTERVAL '1 week',
    CURRENT_TIMESTAMP - INTERVAL '4 days',
    '33333333-3333-3333-3333-333333333333' -- Approved by Manager 1
);

-- Travel Request 5: Pierre (Lausanne) to Bern Sustainability Office - WITHDRAWN
INSERT INTO travel_requests (
    id, employee_id, manager_id, project_id, subproject_id,
    days_per_week, justification, status,
    calculated_distance_km, calculated_allowance_chf, submitted_at
) VALUES (
    'f5f5f5f5-f5f5-f5f5-f5f5-f5f5f5f5f5f5',
    '88888888-8888-8888-8888-888888888888', -- Pierre Martin
    '44444444-4444-4444-4444-444444444444', -- Manager 2
    'dddddddd-dddd-dddd-dddd-dddddddddddd', -- Sustainability Initiative
    'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7', -- Bern Headquarters
    2, -- 2 days per week
    'Marketing support needed for sustainability initiative launch. On-site collaboration with communications team required for campaign development.',
    'withdrawn',
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '88888888-8888-8888-8888-888888888888'),
        (SELECT location FROM subprojects WHERE id = 'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7')
    ),
    calculate_travel_distance(
        (SELECT home_location FROM employees WHERE id = '88888888-8888-8888-8888-888888888888'),
        (SELECT location FROM subprojects WHERE id = 'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7')
    ) * 0.80 * 2, -- distance * cost_per_km * days_per_week
    CURRENT_TIMESTAMP - INTERVAL '10 days'
);

-- =============================================================================
-- AUDIT TRAIL DATA - Status changes and address history
-- =============================================================================

-- Status History for Approved Request (Marco to St. Gallen)
INSERT INTO request_status_history (
    travel_request_id, previous_status, new_status, comment, changed_by
) VALUES (
    'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2',
    'pending',
    'approved',
    'Approved due to clear business necessity and technical requirements. Infrastructure work requires physical presence.',
    '44444444-4444-4444-4444-444444444444' -- Manager 2
);

-- Status History for Rejected Request (Lisa to Basel)
INSERT INTO request_status_history (
    travel_request_id, previous_status, new_status, comment, changed_by
) VALUES (
    'f3f3f3f3-f3f3-f3f3-f3f3-f3f3f3f3f3f3',
    'pending',
    'rejected',
    'Rejected due to excessive travel frequency. Alternative remote work solutions should be explored.',
    '33333333-3333-3333-3333-333333333333' -- Manager 1
);

-- Status History for Second Approved Request (Julia to Zurich)
INSERT INTO request_status_history (
    travel_request_id, previous_status, new_status, comment, changed_by
) VALUES (
    'f4f4f4f4-f4f4-f4f4-f4f4-f4f4f4f4f4f4',
    'pending',
    'approved',
    'Approved. Security expertise justifies travel. Limited to 1 day per week is reasonable.',
    '33333333-3333-3333-3333-333333333333' -- Manager 1
);

-- Status History for Withdrawn Request (Pierre to Bern)
INSERT INTO request_status_history (
    travel_request_id, previous_status, new_status, comment, changed_by
) VALUES (
    'f5f5f5f5-f5f5-f5f5-f5f5-f5f5f5f5f5f5',
    'pending',
    'withdrawn',
    'Employee withdrew request after finding remote collaboration solutions.',
    '88888888-8888-8888-8888-888888888888' -- Pierre Martin (self-withdrawal)
);

-- Sample Address History - Julia moved from Zurich to Basel
INSERT INTO employee_address_history (
    employee_id, previous_street, previous_city, previous_postal_code, previous_country, previous_location,
    new_street, new_city, new_postal_code, new_country, new_location,
    reason, changed_by
) VALUES (
    '99999999-9999-9999-9999-999999999999', -- Julia Fischer
    'Bahnhofstrasse 12',
    'Zürich',
    '8001',
    'Switzerland',
    ST_GeomFromText('POINT(8.540192 47.376887)', 4326), -- Zurich coordinates
    'Marktplatz 7',
    'Basel',
    '4001',
    'Switzerland',
    ST_GeomFromText('POINT(7.590843 47.557421)', 4326), -- Basel coordinates
    'Employee relocated for personal reasons, address updated for travel calculations',
    '22222222-2222-2222-2222-222222222222' -- Admin User 2 (IT Admin)
);

-- =============================================================================
-- DATA VERIFICATION QUERIES
-- =============================================================================

-- Verify employee hierarchy
-- SELECT e1.first_name || ' ' || e1.last_name as employee,
--        e2.first_name || ' ' || e2.last_name as manager
-- FROM employees e1 
-- LEFT JOIN employees e2 ON e1.manager_id = e2.id
-- ORDER BY e2.first_name, e1.first_name;

-- Verify travel request calculations  
-- SELECT tr.id, 
--        e.first_name || ' ' || e.last_name as employee,
--        p.name as project,
--        sp.name as subproject,
--        tr.calculated_distance_km,
--        tr.calculated_allowance_chf,
--        tr.status
-- FROM travel_requests tr
-- JOIN employees e ON tr.employee_id = e.id
-- JOIN projects p ON tr.project_id = p.id  
-- JOIN subprojects sp ON tr.subproject_id = sp.id;

-- Verify geographic coverage
-- SELECT DISTINCT home_city FROM employees ORDER BY home_city;
-- SELECT DISTINCT city FROM subprojects ORDER BY city;

COMMIT;