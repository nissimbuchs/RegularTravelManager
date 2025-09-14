-- Migration: Add profile fields to employees table for registration
-- Story: 5.1 User Registration & Email Verification

-- Add columns to existing employees table (backward compatible)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true}',
ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS registration_source VARCHAR(50) DEFAULT 'system',
ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';

-- Create audit trail table for profile changes
CREATE TABLE IF NOT EXISTS employee_profile_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    changed_fields JSONB NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason VARCHAR(255)
);

-- Index for employee profile history lookups
CREATE INDEX IF NOT EXISTS idx_employee_profile_history_employee ON employee_profile_history(employee_id, changed_at);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_employee_profile_history_date ON employee_profile_history(changed_at);

-- Update existing employee records to set email_verified_at for existing users
UPDATE employees 
SET email_verified_at = created_at,
    registration_source = 'system'
WHERE email_verified_at IS NULL;