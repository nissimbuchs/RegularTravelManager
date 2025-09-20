-- Migration: Add role-based access control system
-- Story: 5.3 Administrator User Management

-- Add role column to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'employee'
CHECK (role IN ('employee', 'manager', 'administrator'));

-- Update existing records based on current manager assignments and admin patterns
-- Set administrators (users with admin email patterns or admin in employee_id)
UPDATE employees
SET role = 'administrator'
WHERE (
  email ILIKE '%admin%' OR
  employee_id LIKE 'ADM-%' OR
  email IN ('admin1@company.ch', 'admin2@company.ch')
) AND role = 'employee';

-- Set managers (users who have direct reports or manager patterns)
UPDATE employees
SET role = 'manager'
WHERE (
  id IN (
    SELECT DISTINCT manager_id
    FROM employees
    WHERE manager_id IS NOT NULL
  ) OR
  employee_id LIKE 'MGR-%' OR
  email IN ('manager1@company.ch', 'manager2@company.ch')
) AND role = 'employee';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);

-- Create index for manager hierarchy queries
CREATE INDEX IF NOT EXISTS idx_employees_manager_hierarchy ON employees(manager_id, id) WHERE manager_id IS NOT NULL;

-- Add role change tracking to profile history
-- This enhances the existing employee_profile_history table
COMMENT ON COLUMN employee_profile_history.changed_fields IS 'JSON array of changed field names including role changes';

-- Create a view for user roles and permissions (for frontend use)
CREATE OR REPLACE VIEW user_roles_view AS
SELECT
  e.id,
  e.cognito_user_id,
  e.email,
  e.first_name,
  e.last_name,
  e.employee_id,
  COALESCE(e.role, 'employee') as role,
  e.is_active,
  e.manager_id,
  m.first_name || ' ' || m.last_name as manager_name,
  COALESCE(m.role, 'employee') as manager_role,
  (
    SELECT COUNT(*)
    FROM employees dr
    WHERE dr.manager_id = e.id AND dr.is_active = true
  ) as direct_reports_count,
  e.created_at,
  e.updated_at
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id
WHERE e.deleted_at IS NULL;

-- Grant appropriate permissions on the view
-- GRANT SELECT ON user_roles_view TO app_role; -- Uncomment when roles are set up

-- Create function to check role hierarchy
CREATE OR REPLACE FUNCTION check_role_hierarchy(
  user_role VARCHAR(20),
  target_role VARCHAR(20)
) RETURNS BOOLEAN AS $$
BEGIN
  -- Administrators can manage all roles
  IF user_role = 'administrator' THEN
    RETURN TRUE;
  END IF;

  -- Managers can manage employees but not other managers or admins
  IF user_role = 'manager' AND target_role = 'employee' THEN
    RETURN TRUE;
  END IF;

  -- Employees cannot manage other users
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate manager assignment
CREATE OR REPLACE FUNCTION validate_manager_assignment(
  employee_id UUID,
  new_manager_id UUID
) RETURNS TABLE(
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  loop_detected BOOLEAN := FALSE;
BEGIN
  -- Check for self-assignment
  IF employee_id = new_manager_id THEN
    RETURN QUERY SELECT FALSE, 'Employee cannot be their own manager';
    RETURN;
  END IF;

  -- Check for circular hierarchy using recursive CTE
  WITH RECURSIVE manager_path AS (
    SELECT new_manager_id as current_id, 1 as depth

    UNION ALL

    SELECT e.manager_id, mp.depth + 1
    FROM employees e
    JOIN manager_path mp ON e.id = mp.current_id
    WHERE e.manager_id IS NOT NULL AND mp.depth < 10
  )
  SELECT EXISTS(
    SELECT 1 FROM manager_path WHERE current_id = employee_id
  ) INTO loop_detected;

  IF loop_detected THEN
    RETURN QUERY SELECT FALSE, 'Manager assignment would create circular hierarchy';
    RETURN;
  END IF;

  -- Check if proposed manager exists and is active
  IF NOT EXISTS(
    SELECT 1 FROM employees
    WHERE id = new_manager_id AND is_active = true
  ) THEN
    RETURN QUERY SELECT FALSE, 'Proposed manager does not exist or is inactive';
    RETURN;
  END IF;

  -- All validations passed
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;