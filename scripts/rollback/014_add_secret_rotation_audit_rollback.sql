-- Rollback: Remove secret rotation audit tables
-- WARNING: This will delete all rotation history and audit data

BEGIN;

-- Drop views
DROP VIEW IF EXISTS latest_secret_rotations;

-- Drop functions
DROP FUNCTION IF EXISTS get_secret_rotation_history(VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS is_rotation_overdue(VARCHAR, INTEGER);

-- Drop tables
DROP TABLE IF EXISTS secret_rotation_notifications;
DROP TABLE IF EXISTS secret_rotation_schedules;
DROP TABLE IF EXISTS secret_rotation_audit;

-- Drop enum type
DROP TYPE IF EXISTS rotation_status;

COMMIT;