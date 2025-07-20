-- Rollback: Drop Error Tracking Tables
-- Description: Rollback script for error tracking and alerting system tables
-- Date: 2025-07-19

-- Drop views first (dependent objects)
DROP VIEW IF EXISTS user_error_impact;
DROP VIEW IF EXISTS error_trend_analysis;
DROP VIEW IF EXISTS active_error_summary;

-- Drop triggers
DROP TRIGGER IF EXISTS update_error_alerts_updated_at ON error_alerts;
DROP TRIGGER IF EXISTS update_error_patterns_updated_at ON error_patterns;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in dependency order
DROP TABLE IF EXISTS error_insights;
DROP TABLE IF EXISTS error_alerts;
DROP TABLE IF EXISTS error_patterns;
DROP TABLE IF EXISTS error_logs;

-- Drop indexes explicitly (in case they weren't dropped with tables)
-- error_logs indexes
DROP INDEX IF EXISTS idx_error_logs_fingerprint;
DROP INDEX IF EXISTS idx_error_logs_created_at;
DROP INDEX IF EXISTS idx_error_logs_severity;
DROP INDEX IF EXISTS idx_error_logs_category;
DROP INDEX IF EXISTS idx_error_logs_code;
DROP INDEX IF EXISTS idx_error_logs_user_id;
DROP INDEX IF EXISTS idx_error_logs_resolved;
DROP INDEX IF EXISTS idx_error_logs_endpoint;
DROP INDEX IF EXISTS idx_error_logs_status_code;
DROP INDEX IF EXISTS idx_error_logs_fingerprint_created;
DROP INDEX IF EXISTS idx_error_logs_severity_created;
DROP INDEX IF EXISTS idx_error_logs_unresolved_created;

-- error_patterns indexes
DROP INDEX IF EXISTS idx_error_patterns_fingerprint;
DROP INDEX IF EXISTS idx_error_patterns_last_seen;
DROP INDEX IF EXISTS idx_error_patterns_occurrence_count;
DROP INDEX IF EXISTS idx_error_patterns_priority_score;
DROP INDEX IF EXISTS idx_error_patterns_category;
DROP INDEX IF EXISTS idx_error_patterns_impact_score;

-- error_alerts indexes
DROP INDEX IF EXISTS idx_error_alerts_alert_id;
DROP INDEX IF EXISTS idx_error_alerts_pattern_id;
DROP INDEX IF EXISTS idx_error_alerts_created_at;
DROP INDEX IF EXISTS idx_error_alerts_severity;
DROP INDEX IF EXISTS idx_error_alerts_acknowledged;
DROP INDEX IF EXISTS idx_error_alerts_resolved;
DROP INDEX IF EXISTS idx_error_alerts_notification_status;
DROP INDEX IF EXISTS idx_error_alerts_active;
DROP INDEX IF EXISTS idx_error_alerts_pending_notifications;

-- error_insights indexes
DROP INDEX IF EXISTS idx_error_insights_insight_id;
DROP INDEX IF EXISTS idx_error_insights_type;
DROP INDEX IF EXISTS idx_error_insights_impact_level;
DROP INDEX IF EXISTS idx_error_insights_confidence;
DROP INDEX IF EXISTS idx_error_insights_created_at;
DROP INDEX IF EXISTS idx_error_insights_expires_at;