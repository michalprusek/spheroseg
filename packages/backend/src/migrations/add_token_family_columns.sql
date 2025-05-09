-- Migration: Add new columns to refresh_tokens table for enhanced JWT security
-- This migration adds family ID, device ID, and other tracking columns to the refresh_tokens table

BEGIN;

-- Check if refresh_tokens table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
    ) THEN
        -- Create refresh_tokens table if it doesn't exist
        CREATE TABLE refresh_tokens (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL,
            token_id VARCHAR(255) NOT NULL UNIQUE,
            is_revoked BOOLEAN DEFAULT false,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END
$$;

-- Add new columns if they don't exist
DO $$
BEGIN
    -- Add family_id column for token family tracking
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens' 
        AND column_name = 'family_id'
    ) THEN
        ALTER TABLE refresh_tokens ADD COLUMN family_id VARCHAR(255);
    END IF;

    -- Add device_id column for device tracking
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens' 
        AND column_name = 'device_id'
    ) THEN
        ALTER TABLE refresh_tokens ADD COLUMN device_id VARCHAR(255);
    END IF;

    -- Add user_agent column for browser identification
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens' 
        AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE refresh_tokens ADD COLUMN user_agent VARCHAR(255);
    END IF;

    -- Add ip_address column for IP tracking
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens' 
        AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE refresh_tokens ADD COLUMN ip_address VARCHAR(45); -- IPv6 can be up to 45 chars
    END IF;
END
$$;

-- Update existing tokens to have a family_id if it's null
-- Generate a different family ID for each user for better security
UPDATE refresh_tokens
SET 
    family_id = encode(digest('family_' || user_id::text || id::text, 'sha256'), 'hex'),
    device_id = encode(digest('device_' || user_id::text || id::text, 'sha256'), 'hex')
WHERE 
    family_id IS NULL;

-- Create index on token_id for faster lookups
CREATE INDEX IF NOT EXISTS refresh_tokens_token_id_idx ON refresh_tokens(token_id);

-- Create index on user_id for faster user-based operations
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);

-- Create index on family_id for token family operations
CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx ON refresh_tokens(family_id);

-- Create index on expires_at for cleanup operations
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);

COMMIT;