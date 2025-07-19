-- Migration: Add missing performance indexes
-- Date: 2025-01-19
-- Purpose: Add indexes for specific query patterns identified in code analysis

BEGIN;

-- =============================================
-- Project shares table additional indexes
-- =============================================

-- Index for checking active shares (without invitation token)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_shares_active
ON project_shares(project_id, user_id) 
WHERE invitation_token IS NULL;

-- Index for permission lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_shares_permission
ON project_shares(user_id, permission) 
WHERE invitation_token IS NULL;

-- =============================================
-- Images table additional indexes
-- =============================================

-- Composite index for user stats queries (images count by status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_project_status_composite
ON images(project_id, segmentation_status, status)
WHERE deleted_at IS NULL;

-- Index for file size calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_project_filesize
ON images(project_id, file_size)
WHERE deleted_at IS NULL;

-- Index for date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_created_date
ON images(created_at, project_id)
WHERE deleted_at IS NULL;

-- =============================================
-- Projects table additional indexes
-- =============================================

-- Index for title uniqueness checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_title
ON projects(user_id, title)
WHERE deleted_at IS NULL;

-- Index for date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_daterange
ON projects(user_id, created_at, updated_at)
WHERE deleted_at IS NULL;

-- =============================================
-- Segmentation queue table indexes
-- =============================================

-- Index for queue status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_segmentation_queue_status_priority
ON segmentation_queue(status, priority DESC, created_at ASC)
WHERE status IN ('queued', 'processing');

-- Index for image-based lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_segmentation_queue_image
ON segmentation_queue(image_id, status);

-- =============================================
-- User profiles table indexes
-- =============================================

-- Index for profile lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_user
ON user_profiles(user_id)
WHERE deleted_at IS NULL;

-- Index for username lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_username
ON user_profiles(LOWER(username))
WHERE deleted_at IS NULL;

-- =============================================
-- Avatar files table indexes
-- =============================================

-- Index for avatar lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatar_files_user
ON avatar_files(user_id);

-- =============================================
-- User settings table indexes
-- =============================================

-- Index for settings lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_user_key
ON user_settings(user_id, setting_key);

-- Index for category-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_category
ON user_settings(user_id, category);

-- =============================================
-- Access tokens table indexes
-- =============================================

-- Index for token validation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_tokens_user_expiry
ON access_tokens(user_id, expires_at)
WHERE expires_at > CURRENT_TIMESTAMP;

-- Index for token cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_tokens_expired
ON access_tokens(expires_at)
WHERE expires_at <= CURRENT_TIMESTAMP;

-- =============================================
-- Refresh tokens table indexes
-- =============================================

-- Index for refresh token lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_token_family
ON refresh_tokens(token_family, is_active)
WHERE is_active = true;

-- Index for user's active tokens
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_user_active
ON refresh_tokens(user_id, is_active, expires_at)
WHERE is_active = true;

-- =============================================
-- Logs table indexes (if exists)
-- =============================================

-- Check if logs table exists before creating indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'logs') THEN
        -- Index for log queries by level and timestamp
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_level_timestamp
        ON logs(level, timestamp DESC);
        
        -- Index for source-based queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_source_timestamp
        ON logs(source, timestamp DESC);
        
        -- Index for text search in logs
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_message_gin
        ON logs USING GIN (to_tsvector('english', message));
    END IF;
END $$;

-- =============================================
-- Update table statistics
-- =============================================

ANALYZE project_shares;
ANALYZE images;
ANALYZE projects;
ANALYZE segmentation_queue;
ANALYZE user_profiles;
ANALYZE avatar_files;
ANALYZE user_settings;
ANALYZE access_tokens;
ANALYZE refresh_tokens;

-- Analyze logs table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'logs') THEN
        ANALYZE logs;
    END IF;
END $$;

COMMIT;

-- Note: This migration adds indexes for specific query patterns found in the codebase
-- All indexes are created CONCURRENTLY to avoid blocking production operations