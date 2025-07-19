-- Rollback script for session management changes
-- This removes Redis session management related changes

BEGIN;

-- Remove session tracking columns if they were added
ALTER TABLE users 
DROP COLUMN IF EXISTS last_session_id,
DROP COLUMN IF EXISTS session_count,
DROP COLUMN IF EXISTS last_active_at;

-- Drop session-related indexes
DROP INDEX IF EXISTS idx_users_last_active;
DROP INDEX IF EXISTS idx_users_session_id;

-- Remove session management table if created
DROP TABLE IF EXISTS user_session_history CASCADE;

-- Restore any session-related constraints that were removed
-- (Add any constraint restoration here if needed)

-- Log rollback completion
DO $$
BEGIN
    RAISE NOTICE 'Session management rollback completed at %', NOW();
END $$;

COMMIT;