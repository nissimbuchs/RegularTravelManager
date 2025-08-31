-- Migration: Distance and Allowance Calculation Functions
-- Story 2.3: Distance and Allowance Calculation Engine

-- Enable PostGIS extension for geographic calculations
CREATE EXTENSION IF NOT EXISTS postgis;

-- Distance calculation function
-- Calculates straight-line distance between two geographic points
-- Returns distance in kilometers with 3 decimal places precision
CREATE OR REPLACE FUNCTION calculate_travel_distance(
    employee_location GEOMETRY,
    project_location GEOMETRY
) RETURNS DECIMAL(10,3) AS $$
DECLARE
    distance_meters DECIMAL;
BEGIN
    -- Validate input coordinates
    IF employee_location IS NULL OR project_location IS NULL THEN
        RAISE EXCEPTION 'Coordinates cannot be null for distance calculation';
    END IF;
    
    -- Ensure coordinates are in WGS84 (SRID 4326)
    IF ST_SRID(employee_location) != 4326 OR ST_SRID(project_location) != 4326 THEN
        RAISE EXCEPTION 'Coordinates must be in WGS84 coordinate system (SRID 4326)';
    END IF;
    
    -- Calculate distance using geography type for accurate results
    distance_meters := ST_Distance(
        employee_location::geography, 
        project_location::geography
    );
    
    -- Convert to kilometers and round to 3 decimal places
    RETURN ROUND(distance_meters / 1000.0, 3);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Distance calculation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Daily allowance calculation function
-- Calculates travel allowance based on distance and cost rate
-- Returns CHF amount with 2 decimal places precision
CREATE OR REPLACE FUNCTION calculate_daily_allowance(
    distance_km DECIMAL(10,3),
    cost_per_km DECIMAL(10,2)
) RETURNS DECIMAL(12,2) AS $$
DECLARE
    allowance_amount DECIMAL(12,2);
BEGIN
    -- Validate inputs
    IF distance_km IS NULL OR cost_per_km IS NULL THEN
        RAISE EXCEPTION 'Distance and cost rate cannot be null for allowance calculation';
    END IF;
    
    IF distance_km < 0 OR cost_per_km <= 0 THEN
        RAISE EXCEPTION 'Distance must be non-negative and cost rate must be positive';
    END IF;
    
    -- Calculate allowance: distance × rate
    allowance_amount := distance_km * cost_per_km;
    
    -- Round to 2 decimal places for CHF currency
    RETURN ROUND(allowance_amount, 2);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Allowance calculation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Complete travel cost calculation function
-- Combines distance and allowance calculation for a travel request
CREATE OR REPLACE FUNCTION calculate_travel_cost(
    employee_home_location GEOMETRY,
    subproject_location GEOMETRY,
    cost_per_km DECIMAL(10,2)
) RETURNS TABLE(
    distance_km DECIMAL(10,3),
    daily_allowance_chf DECIMAL(12,2)
) AS $$
DECLARE
    calculated_distance DECIMAL(10,3);
    calculated_allowance DECIMAL(12,2);
BEGIN
    -- Calculate distance
    calculated_distance := calculate_travel_distance(
        employee_home_location, 
        subproject_location
    );
    
    -- Calculate allowance
    calculated_allowance := calculate_daily_allowance(
        calculated_distance, 
        cost_per_km
    );
    
    -- Return results
    distance_km := calculated_distance;
    daily_allowance_chf := calculated_allowance;
    RETURN NEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Travel cost calculation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create calculation audit trail table
CREATE TABLE calculation_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calculation_type VARCHAR(50) NOT NULL, -- 'distance', 'allowance', 'travel_cost'
    employee_id UUID NOT NULL REFERENCES employees(id),
    subproject_id UUID REFERENCES subprojects(id),
    
    -- Input coordinates and parameters
    employee_location GEOMETRY(POINT, 4326),
    subproject_location GEOMETRY(POINT, 4326),
    cost_per_km DECIMAL(10,2),
    
    -- Calculation results
    distance_km DECIMAL(10,3),
    daily_allowance_chf DECIMAL(12,2),
    
    -- Metadata
    calculation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    calculation_version VARCHAR(20) DEFAULT '1.0',
    request_context JSONB, -- Store request ID, user context, etc.
    
    -- Constraints
    CONSTRAINT valid_calculation_type CHECK (calculation_type IN ('distance', 'allowance', 'travel_cost')),
    CONSTRAINT positive_distance CHECK (distance_km >= 0),
    CONSTRAINT positive_allowance CHECK (daily_allowance_chf >= 0),
    CONSTRAINT positive_cost_rate CHECK (cost_per_km > 0)
);

-- Create indexes for performance
CREATE INDEX idx_calculation_audit_employee_subproject ON calculation_audit(employee_id, subproject_id);
CREATE INDEX idx_calculation_audit_timestamp ON calculation_audit(calculation_timestamp);
CREATE INDEX idx_calculation_audit_type ON calculation_audit(calculation_type);

-- Calculation cache table for performance
CREATE TABLE calculation_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(64) UNIQUE NOT NULL, -- Hash of employee_location + subproject_location
    employee_location GEOMETRY(POINT, 4326) NOT NULL,
    subproject_location GEOMETRY(POINT, 4326) NOT NULL,
    distance_km DECIMAL(10,3) NOT NULL,
    
    -- Cache metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    
    -- TTL for cache invalidation (24 hours default)
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    
    CONSTRAINT positive_cached_distance CHECK (distance_km >= 0)
);

-- Create indexes for cache performance
CREATE INDEX idx_calculation_cache_key ON calculation_cache(cache_key);
CREATE INDEX idx_calculation_cache_expires ON calculation_cache(expires_at);

-- Function to get or calculate distance with caching
CREATE OR REPLACE FUNCTION get_cached_distance(
    employee_location GEOMETRY,
    subproject_location GEOMETRY
) RETURNS DECIMAL(10,3) AS $$
DECLARE
    cache_key VARCHAR(64);
    cached_distance DECIMAL(10,3);
    calculated_distance DECIMAL(10,3);
BEGIN
    -- Generate cache key from coordinates
    cache_key := MD5(
        ST_AsText(employee_location) || '|' || ST_AsText(subproject_location)
    );
    
    -- Try to get from cache
    SELECT distance_km INTO cached_distance
    FROM calculation_cache
    WHERE cache_key = get_cached_distance.cache_key
      AND expires_at > CURRENT_TIMESTAMP;
    
    IF FOUND THEN
        -- Update access statistics
        UPDATE calculation_cache
        SET last_accessed = CURRENT_TIMESTAMP,
            access_count = access_count + 1
        WHERE cache_key = get_cached_distance.cache_key;
        
        RETURN cached_distance;
    ELSE
        -- Calculate new distance
        calculated_distance := calculate_travel_distance(
            employee_location, 
            subproject_location
        );
        
        -- Store in cache (upsert)
        INSERT INTO calculation_cache (
            cache_key, 
            employee_location, 
            subproject_location, 
            distance_km
        ) VALUES (
            get_cached_distance.cache_key,
            employee_location,
            subproject_location,
            calculated_distance
        )
        ON CONFLICT (cache_key) DO UPDATE SET
            distance_km = EXCLUDED.distance_km,
            last_accessed = CURRENT_TIMESTAMP,
            access_count = calculation_cache.access_count + 1,
            expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours';
        
        RETURN calculated_distance;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- If caching fails, return direct calculation
        RETURN calculate_travel_distance(employee_location, subproject_location);
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate cache when addresses change
CREATE OR REPLACE FUNCTION invalidate_distance_cache(
    location_to_invalidate GEOMETRY
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Remove cache entries containing the changed location
    DELETE FROM calculation_cache
    WHERE ST_Equals(employee_location, location_to_invalidate)
       OR ST_Equals(subproject_location, location_to_invalidate);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired cache entries function
CREATE OR REPLACE FUNCTION cleanup_expired_cache() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM calculation_cache
    WHERE expires_at <= CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;