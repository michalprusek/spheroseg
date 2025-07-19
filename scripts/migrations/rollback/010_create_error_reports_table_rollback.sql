-- Rollback Migration: Remove error_reports table
-- Date: 2025-07-19
-- Description: Removes error_reports table and related objects

-- Drop the view first
DROP VIEW IF EXISTS error_report_stats;

-- Drop the cleanup function
DROP FUNCTION IF EXISTS cleanup_old_error_reports(INTEGER);

-- Drop indexes (will be dropped automatically with table, but being explicit)
DROP INDEX IF EXISTS idx_error_reports_timestamp;
DROP INDEX IF EXISTS idx_error_reports_user_id;
DROP INDEX IF EXISTS idx_error_reports_severity;
DROP INDEX IF EXISTS idx_error_reports_error_type;
DROP INDEX IF EXISTS idx_error_reports_url;
DROP INDEX IF EXISTS idx_error_reports_severity_timestamp;

-- Drop the table
DROP TABLE IF EXISTS error_reports;

-- Note: This will permanently delete all error report data
-- Make sure to backup if needed before running this rollback