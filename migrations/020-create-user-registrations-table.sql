-- Migration: Create user registrations table for email verification tracking
-- Story: 5.1 User Registration & Email Verification

-- Create user registrations table
CREATE TABLE IF NOT EXISTS user_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    verification_token VARCHAR(255) NOT NULL,
    verified_at TIMESTAMP NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Add index for email lookups
    CONSTRAINT user_registrations_email_key UNIQUE (email)
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_user_registrations_token ON user_registrations(verification_token);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_user_registrations_expires ON user_registrations(expires_at);

-- Index for active registrations
CREATE INDEX IF NOT EXISTS idx_user_registrations_active ON user_registrations(email, expires_at) 
WHERE verified_at IS NULL;