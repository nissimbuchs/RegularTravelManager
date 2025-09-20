-- Migration: 023-create-employee-profile-history
-- Story 5.2: User Profile Management
-- Create audit trail table for profile changes

-- Create profile history table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS employee_profile_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    changed_fields JSONB NOT NULL,
    old_values JSONB,
    new_values JSONB,
    change_reason TEXT,
    changed_by UUID NOT NULL, -- Cognito User ID of person making change
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add ip_address and user_agent columns if they don't exist
ALTER TABLE employee_profile_history
ADD COLUMN IF NOT EXISTS ip_address INET;

ALTER TABLE employee_profile_history
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_profile_history_employee_id ON employee_profile_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_profile_history_changed_by ON employee_profile_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_profile_history_changed_at ON employee_profile_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_history_changed_fields ON employee_profile_history USING GIN (changed_fields);
-- Additional index for performance optimization
CREATE INDEX IF NOT EXISTS idx_profile_history_composite ON employee_profile_history(employee_id, changed_at DESC);

-- Add trigger to automatically log critical field changes
CREATE OR REPLACE FUNCTION log_employee_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields JSONB;
    old_values JSONB;
    new_values JSONB;
BEGIN
    -- Only log if specific fields changed
    IF OLD.first_name IS DISTINCT FROM NEW.first_name OR
       OLD.last_name IS DISTINCT FROM NEW.last_name OR
       OLD.email IS DISTINCT FROM NEW.email OR
       OLD.home_address IS DISTINCT FROM NEW.home_address OR
       OLD.home_city IS DISTINCT FROM NEW.home_city OR
       OLD.home_postal_code IS DISTINCT FROM NEW.home_postal_code OR
       OLD.home_country IS DISTINCT FROM NEW.home_country OR
       OLD.phone_number IS DISTINCT FROM NEW.phone_number OR
       OLD.role IS DISTINCT FROM NEW.role OR
       OLD.status IS DISTINCT FROM NEW.status OR
       OLD.manager_id IS DISTINCT FROM NEW.manager_id THEN

        -- Build changed fields list
        changed_fields = '[]'::jsonb;
        old_values = '{}'::jsonb;
        new_values = '{}'::jsonb;

        IF OLD.first_name IS DISTINCT FROM NEW.first_name THEN
            changed_fields = changed_fields || '"firstName"'::jsonb;
            old_values = old_values || jsonb_build_object('firstName', OLD.first_name);
            new_values = new_values || jsonb_build_object('firstName', NEW.first_name);
        END IF;

        IF OLD.last_name IS DISTINCT FROM NEW.last_name THEN
            changed_fields = changed_fields || '"lastName"'::jsonb;
            old_values = old_values || jsonb_build_object('lastName', OLD.last_name);
            new_values = new_values || jsonb_build_object('lastName', NEW.last_name);
        END IF;

        IF OLD.email IS DISTINCT FROM NEW.email THEN
            changed_fields = changed_fields || '"email"'::jsonb;
            old_values = old_values || jsonb_build_object('email', OLD.email);
            new_values = new_values || jsonb_build_object('email', NEW.email);
        END IF;

        IF OLD.home_address IS DISTINCT FROM NEW.home_address OR
           OLD.home_city IS DISTINCT FROM NEW.home_city OR
           OLD.home_postal_code IS DISTINCT FROM NEW.home_postal_code OR
           OLD.home_country IS DISTINCT FROM NEW.home_country THEN
            changed_fields = changed_fields || '"homeAddress"'::jsonb;
            old_values = old_values || jsonb_build_object('homeAddress', jsonb_build_object(
                'street', OLD.home_address,
                'city', OLD.home_city,
                'postalCode', OLD.home_postal_code,
                'country', OLD.home_country
            ));
            new_values = new_values || jsonb_build_object('homeAddress', jsonb_build_object(
                'street', NEW.home_address,
                'city', NEW.home_city,
                'postalCode', NEW.home_postal_code,
                'country', NEW.home_country
            ));
        END IF;

        IF OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
            changed_fields = changed_fields || '"phoneNumber"'::jsonb;
            old_values = old_values || jsonb_build_object('phoneNumber', OLD.phone_number);
            new_values = new_values || jsonb_build_object('phoneNumber', NEW.phone_number);
        END IF;

        IF OLD.role IS DISTINCT FROM NEW.role THEN
            changed_fields = changed_fields || '"role"'::jsonb;
            old_values = old_values || jsonb_build_object('role', OLD.role);
            new_values = new_values || jsonb_build_object('role', NEW.role);
        END IF;

        IF OLD.status IS DISTINCT FROM NEW.status THEN
            changed_fields = changed_fields || '"status"'::jsonb;
            old_values = old_values || jsonb_build_object('status', OLD.status);
            new_values = new_values || jsonb_build_object('status', NEW.status);
        END IF;

        IF OLD.manager_id IS DISTINCT FROM NEW.manager_id THEN
            changed_fields = changed_fields || '"managerId"'::jsonb;
            old_values = old_values || jsonb_build_object('managerId', OLD.manager_id);
            new_values = new_values || jsonb_build_object('managerId', NEW.manager_id);
        END IF;

        -- Note: Actual insert is done by application to include user context
        -- This trigger is for reference and could be enabled for automatic logging
        -- INSERT INTO employee_profile_history (
        --     employee_id,
        --     changed_fields,
        --     old_values,
        --     new_values,
        --     changed_by,
        --     changed_at
        -- ) VALUES (
        --     NEW.id,
        --     changed_fields,
        --     old_values,
        --     new_values,
        --     NEW.cognito_user_id, -- This would need to be passed differently
        --     CURRENT_TIMESTAMP
        -- );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger is created but not activated - application handles audit logging
-- CREATE TRIGGER trigger_log_employee_changes
-- AFTER UPDATE ON employees
-- FOR EACH ROW
-- EXECUTE FUNCTION log_employee_profile_changes();

-- Add comments for documentation
COMMENT ON TABLE employee_profile_history IS 'Audit trail for employee profile changes';
COMMENT ON COLUMN employee_profile_history.employee_id IS 'Employee whose profile was changed';
COMMENT ON COLUMN employee_profile_history.changed_fields IS 'JSON array of field names that were changed';
COMMENT ON COLUMN employee_profile_history.old_values IS 'JSON object with old field values';
COMMENT ON COLUMN employee_profile_history.new_values IS 'JSON object with new field values';
COMMENT ON COLUMN employee_profile_history.change_reason IS 'Optional reason for the change';
COMMENT ON COLUMN employee_profile_history.changed_by IS 'Cognito User ID of user who made the change';
COMMENT ON COLUMN employee_profile_history.changed_at IS 'Timestamp when change occurred';
COMMENT ON COLUMN employee_profile_history.ip_address IS 'IP address of user making the change';
COMMENT ON COLUMN employee_profile_history.user_agent IS 'Browser user agent of user making the change';