-- Initialize databases for RegularTravelManager
-- This script runs when PostgreSQL container starts

-- Create test database
CREATE DATABASE travel_manager_test OWNER nissim;

-- Connect to development database and enable extensions
\c travel_manager_dev;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Connect to test database and enable extensions  
\c travel_manager_test;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE travel_manager_dev TO nissim;
GRANT ALL PRIVILEGES ON DATABASE travel_manager_test TO nissim;