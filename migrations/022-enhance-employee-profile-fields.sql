-- Migration: 022-enhance-employee-profile-fields
-- Story 5.2: User Profile Management
-- Add additional profile fields for enhanced user management

-- Add phone number field if not exists
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);

-- Add notification preferences as JSONB
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "requestUpdates": true, "weeklyDigest": false, "maintenanceAlerts": true}'::jsonb;

-- Add privacy settings as JSONB
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"profileVisibility": "team", "allowAnalytics": true, "shareLocationData": true, "allowManagerAccess": true, "dataRetentionConsent": true}'::jsonb;

-- Add profile update tracking fields
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Add home country field with default value
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS home_country VARCHAR(100) DEFAULT 'Switzerland';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employees_phone_number ON employees(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_profile_updated_at ON employees(profile_updated_at) WHERE profile_updated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_email_verified_at ON employees(email_verified_at) WHERE email_verified_at IS NOT NULL;

-- Add check constraints for phone number format (Swiss phone numbers)
ALTER TABLE employees
ADD CONSTRAINT IF NOT EXISTS chk_phone_format
CHECK (phone_number IS NULL OR phone_number ~ '^\+?[0-9\s\-\(\)]+$');

-- Add comment descriptions
COMMENT ON COLUMN employees.phone_number IS 'User contact phone number (optional)';
COMMENT ON COLUMN employees.notification_preferences IS 'JSON object containing user notification preferences';
COMMENT ON COLUMN employees.privacy_settings IS 'JSON object containing user privacy settings';
COMMENT ON COLUMN employees.profile_updated_at IS 'Last time user updated their profile';
COMMENT ON COLUMN employees.email_verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN employees.last_login_at IS 'Last successful login timestamp';
COMMENT ON COLUMN employees.home_country IS 'Country of home address (default: Switzerland)';