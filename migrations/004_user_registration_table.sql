-- Migration 004: Create user_registrations table for Story 5.1 - User Registration
-- This table stores email verification tokens for the registration process

CREATE TABLE user_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  verification_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_user_registrations_email ON user_registrations(email);
CREATE INDEX idx_user_registrations_token ON user_registrations(verification_token);
CREATE INDEX idx_user_registrations_expires ON user_registrations(expires_at);

-- Add comments for documentation
COMMENT ON TABLE user_registrations IS 'Stores email verification tokens for user registration process (Story 5.1)';
COMMENT ON COLUMN user_registrations.email IS 'Email address being verified';
COMMENT ON COLUMN user_registrations.verification_token IS 'Unique token sent via email for verification';
COMMENT ON COLUMN user_registrations.expires_at IS 'When the verification token expires (24 hours)';
COMMENT ON COLUMN user_registrations.verified_at IS 'When the email was verified (NULL if not verified)';