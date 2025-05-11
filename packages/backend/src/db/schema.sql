-- Schema for SpherosegDB

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  password_hash VARCHAR(255),
  is_approved BOOLEAN DEFAULT TRUE,
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT DEFAULT 10737418240, -- 10GB default
  last_login TIMESTAMP WITH TIME ZONE NULL
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE,
  full_name VARCHAR(100),
  title VARCHAR(100),
  organization VARCHAR(100),
  bio TEXT,
  location VARCHAR(100),
  avatar_url VARCHAR(255),
  preferred_language VARCHAR(10),
  theme_preference VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  public BOOLEAN DEFAULT FALSE
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),                          -- For descriptive image name from service
  storage_filename VARCHAR(255) NOT NULL,     -- Previously 'filename', for actual file name on disk
  original_filename VARCHAR(255),
  storage_path VARCHAR(255) NOT NULL,         -- Previously 'file_path', for consistency with service
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  format VARCHAR(20),
  thumbnail_path VARCHAR(255),
  metadata JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  segmentation_status VARCHAR(50) DEFAULT 'pending', -- Added as used by tutorialProjectService
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Segmentations table
CREATE TABLE IF NOT EXISTS segmentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255),
  model_type VARCHAR(50) DEFAULT 'resunet',
  model_version VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  polygons JSONB,
  mask_path VARCHAR(255),
  metadata JSONB
);

-- Segmentation results table
CREATE TABLE IF NOT EXISTS segmentation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  result_data JSONB,
  parameters JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (image_id)
);

-- Project shares table
CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(20) NOT NULL DEFAULT 'view', -- view, edit, admin
  invitation_token VARCHAR(255),
  invitation_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- Segmentation queue table
CREATE TABLE IF NOT EXISTS segmentation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  model_type VARCHAR(50) DEFAULT 'resunet',
  model_version VARCHAR(50),
  metadata JSONB
);

-- Project duplication tasks table
CREATE TABLE IF NOT EXISTS project_duplication_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  progress FLOAT DEFAULT 0,
  options JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_segmentations_image_id ON segmentations(image_id);
CREATE INDEX IF NOT EXISTS idx_segmentations_project_id ON segmentations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_user_id ON project_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_queue_image_id ON segmentation_queue(image_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_queue_status ON segmentation_queue(status);

-- Refresh tokens table (from migrations/refresh_tokens.sql)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id VARCHAR(255) NOT NULL UNIQUE,
  family_id VARCHAR(255) NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(255) NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create indexes for refresh_tokens (from migrations/refresh_tokens.sql)
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_id_idx ON refresh_tokens(token_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);
