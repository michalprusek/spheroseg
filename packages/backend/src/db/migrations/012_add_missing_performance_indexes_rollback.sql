-- Rollback Migration: Remove missing performance indexes
-- Date: 2025-01-19

BEGIN;

-- Drop project shares indexes
DROP INDEX IF EXISTS idx_project_shares_active;
DROP INDEX IF EXISTS idx_project_shares_permission;

-- Drop images indexes
DROP INDEX IF EXISTS idx_images_project_status_composite;
DROP INDEX IF EXISTS idx_images_project_filesize;
DROP INDEX IF EXISTS idx_images_created_date;

-- Drop projects indexes
DROP INDEX IF EXISTS idx_projects_user_title;
DROP INDEX IF EXISTS idx_projects_user_daterange;

-- Drop segmentation queue indexes
DROP INDEX IF EXISTS idx_segmentation_queue_status_priority;
DROP INDEX IF EXISTS idx_segmentation_queue_image;

-- Drop user profiles indexes
DROP INDEX IF EXISTS idx_user_profiles_user;
DROP INDEX IF EXISTS idx_user_profiles_username;

-- Drop avatar files indexes
DROP INDEX IF EXISTS idx_avatar_files_user;

-- Drop user settings indexes
DROP INDEX IF EXISTS idx_user_settings_user_key;
DROP INDEX IF EXISTS idx_user_settings_category;

-- Drop access tokens indexes
DROP INDEX IF EXISTS idx_access_tokens_user_expiry;
DROP INDEX IF EXISTS idx_access_tokens_expired;

-- Drop refresh tokens indexes
DROP INDEX IF EXISTS idx_refresh_tokens_token_family;
DROP INDEX IF EXISTS idx_refresh_tokens_user_active;

-- Drop logs indexes if they exist
DROP INDEX IF EXISTS idx_logs_level_timestamp;
DROP INDEX IF EXISTS idx_logs_source_timestamp;
DROP INDEX IF EXISTS idx_logs_message_gin;

COMMIT;