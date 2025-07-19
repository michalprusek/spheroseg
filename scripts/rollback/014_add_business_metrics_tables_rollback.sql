-- Rollback for Business Metrics Tables
-- This script removes all changes made by 014_add_business_metrics_tables.sql

-- Drop the cleanup function
DROP FUNCTION IF EXISTS cleanup_old_logs(INTEGER);

-- Drop business metric alerts table
DROP TABLE IF EXISTS business_metric_alerts CASCADE;

-- Drop API request logs table
DROP TABLE IF EXISTS api_request_logs CASCADE;

-- Drop user activity logs table
DROP TABLE IF EXISTS user_activity_logs CASCADE;

-- Drop error logs table
DROP TABLE IF EXISTS error_logs CASCADE;

-- Remove added columns from segmentation_results
-- Note: This is a destructive operation - data in these columns will be lost
ALTER TABLE segmentation_results 
DROP COLUMN IF EXISTS accuracy_score,
DROP COLUMN IF EXISTS completed_at,
DROP COLUMN IF EXISTS started_at;