-- Additional performance indexes for missing query optimizations
-- This migration adds indexes identified through query performance analysis

-- Enable timing to monitor index creation
\timing on

-- Log index creation start
DO $$ BEGIN RAISE NOTICE 'Starting missing performance index creation at %', NOW(); END $$;

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
DO $$ BEGIN RAISE NOTICE 'Created index idx_users_email for authentication queries'; END $$;

-- Covering index for storage queries to avoid table lookups
CREATE INDEX IF NOT EXISTS idx_users_storage ON users(id) INCLUDE (storage_limit_bytes, storage_used_bytes);
DO $$ BEGIN RAISE NOTICE 'Created covering index idx_users_storage for storage calculations'; END $$;

-- Images table indexes for search operations
CREATE INDEX IF NOT EXISTS idx_images_storage_filename ON images(storage_filename);
DO $$ BEGIN RAISE NOTICE 'Created index idx_images_storage_filename for file lookups'; END $$;

-- Special index for LIKE pattern matching on storage_filename
CREATE INDEX IF NOT EXISTS idx_images_storage_filename_pattern ON images(storage_filename text_pattern_ops);
DO $$ BEGIN RAISE NOTICE 'Created pattern index idx_images_storage_filename_pattern for LIKE queries'; END $$;

CREATE INDEX IF NOT EXISTS idx_images_name ON images(name);
DO $$ BEGIN RAISE NOTICE 'Created index idx_images_name for name searches'; END $$;

-- Composite index for project-specific name lookups
CREATE INDEX IF NOT EXISTS idx_images_project_name ON images(project_id, name);
DO $$ BEGIN RAISE NOTICE 'Created composite index idx_images_project_name for unique name checks'; END $$;

-- Index for file size aggregations
CREATE INDEX IF NOT EXISTS idx_images_file_size ON images(project_id, file_size);
DO $$ BEGIN RAISE NOTICE 'Created index idx_images_file_size for storage calculations'; END $$;

-- Refresh tokens indexes
-- Partial index for active tokens only (reduces index size)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id) 
WHERE is_revoked = false;
DO $$ BEGIN RAISE NOTICE 'Created partial index idx_refresh_tokens_user_id for active token lookups'; END $$;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_id ON refresh_tokens(token_id);
DO $$ BEGIN RAISE NOTICE 'Created index idx_refresh_tokens_token_id for token revocation'; END $$;

-- Password reset tokens index
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at) 
WHERE expires_at > NOW();
DO $$ BEGIN RAISE NOTICE 'Created partial index idx_password_reset_tokens_expires for valid tokens'; END $$;

-- Access requests index
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
DO $$ BEGIN RAISE NOTICE 'Created index idx_access_requests_email for duplicate checks'; END $$;

-- User profiles index
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
DO $$ BEGIN RAISE NOTICE 'Created index idx_user_profiles_user_id for profile lookups'; END $$;

-- Analyze tables to update statistics
DO $$ BEGIN RAISE NOTICE 'Analyzing tables to update statistics...'; END $$;
ANALYZE users;
ANALYZE images;
ANALYZE refresh_tokens;
ANALYZE password_reset_tokens;
ANALYZE access_requests;
ANALYZE user_profiles;

-- Log completion
DO $$ BEGIN RAISE NOTICE 'Missing performance index creation completed at %', NOW(); END $$;

-- Display new indexes with sizes
DO $$
DECLARE
    index_info RECORD;
    total_size BIGINT := 0;
BEGIN
    RAISE NOTICE 'New performance indexes created:';
    FOR index_info IN
        SELECT 
            indexname,
            tablename,
            pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
            pg_relation_size(indexname::regclass) as raw_size
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
        )
        ORDER BY raw_size DESC
    LOOP
        RAISE NOTICE '  - % on % (size: %)', index_info.indexname, index_info.tablename, index_info.index_size;
        total_size := total_size + index_info.raw_size;
    END LOOP;
    RAISE NOTICE 'Total size of new indexes: %', pg_size_pretty(total_size);
END $$;

-- Performance impact estimation
DO $$
DECLARE
    table_info RECORD;
BEGIN
    RAISE NOTICE 'Table statistics for indexed columns:';
    FOR table_info IN
        SELECT 
            tablename,
            n_live_tup as row_count,
            pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size
        FROM pg_stat_user_tables
        WHERE tablename IN ('users', 'images', 'refresh_tokens', 'password_reset_tokens', 'access_requests', 'user_profiles')
        ORDER BY n_live_tup DESC
    LOOP
        RAISE NOTICE '  - %: % rows, %', table_info.tablename, table_info.row_count, table_info.table_size;
    END LOOP;
END $$;