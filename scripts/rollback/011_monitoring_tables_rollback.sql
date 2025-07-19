-- Rollback script for monitoring tables
-- This removes the monitoring tables and related objects

BEGIN;

-- Drop triggers first
DROP TRIGGER IF EXISTS update_api_metrics_updated_at ON api_metrics;
DROP TRIGGER IF EXISTS update_error_logs_updated_at ON error_logs;
DROP TRIGGER IF EXISTS update_performance_metrics_updated_at ON performance_metrics;

-- Drop indexes
DROP INDEX IF EXISTS idx_api_metrics_endpoint_method;
DROP INDEX IF EXISTS idx_api_metrics_timestamp;
DROP INDEX IF EXISTS idx_api_metrics_user;
DROP INDEX IF EXISTS idx_error_logs_timestamp;
DROP INDEX IF EXISTS idx_error_logs_code;
DROP INDEX IF EXISTS idx_error_logs_user;
DROP INDEX IF EXISTS idx_performance_metrics_timestamp;
DROP INDEX IF EXISTS idx_performance_metrics_metric_type;

-- Drop tables
DROP TABLE IF EXISTS api_metrics CASCADE;
DROP TABLE IF EXISTS error_logs CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Log rollback completion
DO $$
BEGIN
    RAISE NOTICE 'Monitoring tables rollback completed at %', NOW();
END $$;

COMMIT;