-- Basic schema for Cell Segmentation Hub

CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- For uuid_generate_v4()

-- Users table for authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table for additional user information
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE, -- Optional username
    full_name VARCHAR(100),
    title VARCHAR(100),
    organization VARCHAR(100),
    bio TEXT,
    location VARCHAR(100),
    avatar_url VARCHAR(255),
    preferred_language VARCHAR(10),
    preferred_theme VARCHAR(10), -- Add preferred_theme column (e.g., 'light', 'dark', 'system')
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Image status enum type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'image_status') THEN
        CREATE TYPE image_status AS ENUM ('pending', 'processing', 'completed', 'failed');
    END IF;
END$$;

-- Images table
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id), -- Denormalized for easier access/filtering?
    name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(512) NOT NULL, -- Path to the image file (e.g., local path or S3 key)
    thumbnail_path VARCHAR(512),       -- Path to the thumbnail file
    width INTEGER,
    height INTEGER,
    metadata JSONB,                  -- Store original image metadata (optional)
    status image_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Segmentation results table (might be combined with images if 1:1)
-- If storing results separately allows for multiple segmentation versions/runs per image
CREATE TABLE segmentation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID UNIQUE NOT NULL REFERENCES images(id) ON DELETE CASCADE, -- Use UNIQUE if only one result per image
    result_data JSONB, -- Store segmentation polygons/masks as JSON
    parameters JSONB, -- Store parameters used for segmentation (optional)
    status image_status DEFAULT 'pending', -- Status of the segmentation task itself
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Access requests table
CREATE TABLE access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to user if they exist
    email VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    organization VARCHAR(100),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- e.g., pending, approved, rejected
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to update updated_at on relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE
ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE
ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE
ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_images_updated_at BEFORE UPDATE
ON images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segmentation_results_updated_at BEFORE UPDATE
ON segmentation_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_access_requests_updated_at BEFORE UPDATE
ON access_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_images_project_id ON images(project_id);
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_segmentation_results_image_id ON segmentation_results(image_id);
CREATE INDEX idx_access_requests_email ON access_requests(email);
CREATE INDEX idx_access_requests_status ON access_requests(status); 