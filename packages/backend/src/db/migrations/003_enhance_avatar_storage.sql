-- Migration to enhance avatar storage and user preferences
-- This migration adds proper avatar file management and settings storage

-- Create avatar_files table for better file management
CREATE TABLE IF NOT EXISTS avatar_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_avatar UNIQUE (user_id)
);

-- Create user_settings table for persistent settings
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_setting UNIQUE (user_id, setting_key)
);

-- Add logs table for system and user activity logging
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_avatar_files_user_id ON avatar_files(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- Insert default settings for existing users
INSERT INTO user_settings (user_id, setting_key, setting_value, category)
SELECT id, 'theme', '"system"'::jsonb, 'ui'
FROM users
WHERE id NOT IN (SELECT user_id FROM user_settings WHERE setting_key = 'theme');

INSERT INTO user_settings (user_id, setting_key, setting_value, category)
SELECT id, 'language', '"en"'::jsonb, 'ui'
FROM users
WHERE id NOT IN (SELECT user_id FROM user_settings WHERE setting_key = 'language');

-- Update existing user_profiles to use proper theme_preference values
UPDATE user_profiles 
SET theme_preference = 'system' 
WHERE theme_preference IS NULL OR theme_preference = '';

UPDATE user_profiles 
SET preferred_language = 'en' 
WHERE preferred_language IS NULL OR preferred_language = '';