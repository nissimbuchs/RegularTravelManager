-- Migration: 002_add_cognito_fields.sql
-- Description: Add Cognito authentication fields to employees table
-- Version: 1.1
-- Date: 2025-08-30

-- Add Cognito authentication fields to employees table
ALTER TABLE employees 
ADD COLUMN cognito_user_id VARCHAR(255) UNIQUE,
ADD COLUMN employee_id VARCHAR(50) UNIQUE;

-- Update existing records with placeholder values (will be updated when users are synced)
WITH numbered_employees AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM employees
)
UPDATE employees 
SET 
  cognito_user_id = 'pending-' || employees.id::text,
  employee_id = 'EMP-' || LPAD(numbered_employees.row_num::text, 4, '0')
FROM numbered_employees
WHERE employees.id = numbered_employees.id;

-- Make fields required after populating with placeholder values
ALTER TABLE employees 
ALTER COLUMN cognito_user_id SET NOT NULL,
ALTER COLUMN employee_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX idx_employees_cognito_user_id ON employees(cognito_user_id);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);

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
    SELECT COALESCE(MAX(SUBSTRING(employee_id FROM 'EMP-([0-9]+)')::INTEGER), 0) + 1
    INTO next_employee_number
    FROM employees
    WHERE employee_id ~ '^EMP-[0-9]+$';
    
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