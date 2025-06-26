-- Migration to add avatar storage table for better file management
-- This migration adds proper avatar storage capabilities

-- Create avatar_files table for storing avatar metadata
CREATE TABLE IF NOT EXISTS avatar_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one avatar per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_avatar_files_user_id ON avatar_files(user_id);

-- Add avatar_file_id reference to user_profiles (optional - keeps existing avatar_url)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS avatar_file_id UUID REFERENCES avatar_files(id) ON DELETE SET NULL;

-- Create index for avatar file reference
CREATE INDEX IF NOT EXISTS idx_user_profiles_avatar_file_id ON user_profiles(avatar_file_id);

-- Update trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to avatar_files table
DROP TRIGGER IF EXISTS update_avatar_files_updated_at ON avatar_files;
CREATE TRIGGER update_avatar_files_updated_at
    BEFORE UPDATE ON avatar_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to user_profiles table if not exists
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();