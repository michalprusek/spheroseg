-- User accounts schema for SpheroSeg

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_approved BOOLEAN DEFAULT FALSE,
    storage_limit_bytes BIGINT DEFAULT 10737418240, -- 10GB default
    storage_used_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    title VARCHAR(255),
    organization VARCHAR(255),
    bio TEXT,
    location VARCHAR(255),
    avatar_url VARCHAR(255),
    preferred_language VARCHAR(10) DEFAULT 'en',
    theme_preference VARCHAR(20) DEFAULT 'system',
    institution VARCHAR(255),
    website VARCHAR(255),
    twitter VARCHAR(255),
    github VARCHAR(255),
    linkedin VARCHAR(255),
    orcid VARCHAR(255),
    research_interests TEXT,
    notification_email BOOLEAN DEFAULT TRUE,
    notification_project_updates BOOLEAN DEFAULT TRUE,
    notification_system BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_profiles_user_id_key UNIQUE (user_id)
);

-- Create password_reset_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create access_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255),
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);

-- Create default admin user if it doesn't exist
-- Password: admin123 (hashed)
INSERT INTO users (email, password_hash, name, role, is_approved)
VALUES 
('admin@spheroseg.com', '$2b$10$3Gvs3ERddAbiIKZFk5bZKeW9RG9qknNqA4VCl2zlYI8y51.5TUnG6', 'Administrator', 'admin', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Create test user if it doesn't exist
-- Password: password123 (hashed)
INSERT INTO users (email, password_hash, name, role, is_approved)
VALUES 
('test@example.com', '$2b$10$vC.VsZmLV3zYBCQGOvAZEeh1vgP8CSHrBzdEEQ.wAQTnfGDtRWNuW', 'Test User', 'user', TRUE)
ON CONFLICT (email) DO NOTHING;