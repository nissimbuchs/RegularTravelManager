-- Migration: Create comprehensive user deletion cleanup function
-- Story: 5.3 Administrator User Management

-- Create comprehensive user deletion function as specified in story documentation
CREATE OR REPLACE FUNCTION admin_delete_user(
  user_id UUID,
  admin_id UUID,
  deletion_reason TEXT
) RETURNS TABLE(
  cleanup_summary JSONB
) AS $$
DECLARE
  request_count INTEGER;
  audit_count INTEGER;
  direct_reports_count INTEGER;
  cleanup_result JSONB;
BEGIN
  -- Count associated records
  SELECT COUNT(*) INTO request_count FROM travel_requests WHERE employee_id = user_id;
  SELECT COUNT(*) INTO audit_count FROM employee_profile_history WHERE employee_id = user_id;

  -- Archive travel requests (don't delete for audit purposes)
  UPDATE travel_requests
  SET status = 'archived',
      archived_at = CURRENT_TIMESTAMP,
      archived_by = admin_id
  WHERE employee_id = user_id AND status != 'approved';

  -- Reassign approved requests to system account for historical reference
  UPDATE travel_requests
  SET employee_note = CONCAT('Original employee deleted: ', COALESCE(employee_note, '')),
      archived_by = admin_id
  WHERE employee_id = user_id AND status = 'approved';

  -- Archive profile history (preserve for compliance)
  UPDATE employee_profile_history
  SET archived_at = CURRENT_TIMESTAMP
  WHERE employee_id = user_id;

  -- Update manager relationships for direct reports
  UPDATE employees
  SET manager_id = NULL,
      profile_updated_at = CURRENT_TIMESTAMP
  WHERE manager_id = user_id;

  -- Get count of affected direct reports
  GET DIAGNOSTICS direct_reports_count = ROW_COUNT;

  -- Soft delete employee record (preserve for audit)
  UPDATE employees
  SET is_active = FALSE,
      deleted_at = CURRENT_TIMESTAMP,
      deleted_by = admin_id,
      deletion_reason = deletion_reason
  WHERE id = user_id;

  -- Create cleanup summary
  SELECT jsonb_build_object(
    'user_id', user_id,
    'travel_requests_archived', request_count,
    'audit_records_preserved', audit_count,
    'direct_reports_updated', direct_reports_count,
    'deleted_at', CURRENT_TIMESTAMP
  ) INTO cleanup_result;

  RETURN QUERY SELECT cleanup_result;
END;
$$ LANGUAGE plpgsql;

-- Add columns for soft deletion tracking
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by UUID,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Add columns for travel request archiving
ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS archived_by UUID;

-- Add column for employee profile history archiving
ALTER TABLE employee_profile_history
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Create indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_employees_deleted_at ON employees(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_travel_requests_archived ON travel_requests(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_history_archived ON employee_profile_history(archived_at) WHERE archived_at IS NOT NULL;

-- Create index for admin user status filtering
CREATE INDEX IF NOT EXISTS idx_employees_admin_status ON employees(is_active, deleted_at);