-- Rollback script for 011_add_missing_performance_indexes.sql
-- This script removes the indexes added in the corresponding migration

-- Enable timing to monitor index removal
\timing on

-- Log rollback start
DO $$ BEGIN RAISE NOTICE 'Starting rollback of missing performance indexes at %', NOW(); END $$;

-- Drop indexes in reverse order of creation
DROP INDEX IF EXISTS idx_user_profiles_user_id;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_user_profiles_user_id'; END $$;

DROP INDEX IF EXISTS idx_access_requests_email;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_access_requests_email'; END $$;

DROP INDEX IF EXISTS idx_password_reset_tokens_expires;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_password_reset_tokens_expires'; END $$;

DROP INDEX IF EXISTS idx_refresh_tokens_token_id;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_refresh_tokens_token_id'; END $$;

DROP INDEX IF EXISTS idx_refresh_tokens_user_id;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_refresh_tokens_user_id'; END $$;

DROP INDEX IF EXISTS idx_images_file_size;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_images_file_size'; END $$;

DROP INDEX IF EXISTS idx_images_project_name;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_images_project_name'; END $$;

DROP INDEX IF EXISTS idx_images_name;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_images_name'; END $$;

DROP INDEX IF EXISTS idx_images_storage_filename_pattern;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_images_storage_filename_pattern'; END $$;

DROP INDEX IF EXISTS idx_images_storage_filename;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_images_storage_filename'; END $$;

DROP INDEX IF EXISTS idx_users_storage;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_users_storage'; END $$;

DROP INDEX IF EXISTS idx_users_email;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_users_email'; END $$;

-- Log completion
DO $$ BEGIN RAISE NOTICE 'Rollback of missing performance indexes completed at %', NOW(); END $$;

-- Verify indexes were removed
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname IN (
        'idx_users_email',
        'idx_users_storage',
        'idx_images_storage_filename',
        'idx_images_storage_filename_pattern',
        'idx_images_name',
        'idx_images_project_name',
        'idx_images_file_size',
        'idx_refresh_tokens_user_id',
        'idx_refresh_tokens_token_id',
        'idx_password_reset_tokens_expires',
        'idx_access_requests_email',
        'idx_user_profiles_user_id'
    );
    
    IF remaining_count = 0 THEN
        RAISE NOTICE 'All indexes successfully removed';
    ELSE
        RAISE WARNING '% indexes could not be removed', remaining_count;
    END IF;
END $$;