-- Up migration: Creates initial schema
BEGIN;

-- Create migrations table to track which migrations have been run
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  run_on TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Files table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  path VARCHAR(512) NOT NULL,
  size BIGINT NOT NULL,
  mime_type VARCHAR(255),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_files_project_id ON files(project_id);
CREATE INDEX idx_files_user_id ON files(user_id);

-- Insert initial admin user (password: admin123)
INSERT INTO users (email, password_hash, name)
VALUES ('admin@example.com', '$2a$10$xJwL5v5zLSTG7V7UQ3zZ.eqj6O0w9b1m9d0jJZ8X3Jv6Jk8Yb5X2', 'Admin User');

-- Record this migration
INSERT INTO migrations (name) VALUES ('001_initial_schema.sql');

COMMIT;

-- Down migration: Drops all tables
BEGIN;

DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS migrations;

COMMIT;