-- Rollback Migration: Remove Bull Queue Tracking Tables
-- Description: Removes tables and modifications made for Bull queue tracking
-- Author: System
-- Date: 2025-07-14

BEGIN;

-- Drop trigger and function for updated_at
DROP TRIGGER IF EXISTS update_queue_jobs_updated_at_trigger ON queue_jobs;
DROP FUNCTION IF EXISTS update_queue_jobs_updated_at();

-- Drop function for calculating metrics
DROP FUNCTION IF EXISTS calculate_queue_metrics(DATE, INTEGER);

-- Remove foreign key constraint from segmentation_tasks
ALTER TABLE segmentation_tasks
  DROP CONSTRAINT IF EXISTS fk_segmentation_tasks_queue_job_id;

-- Drop indexes on segmentation_tasks
DROP INDEX IF EXISTS idx_segmentation_tasks_queue_job_id;

-- Remove columns from segmentation_tasks
ALTER TABLE segmentation_tasks 
  DROP COLUMN IF EXISTS queue_job_id,
  DROP COLUMN IF EXISTS processing_time_ms;

-- Drop queue_metrics table
DROP TABLE IF EXISTS queue_metrics CASCADE;

-- Drop queue_jobs table
DROP TABLE IF EXISTS queue_jobs CASCADE;

COMMIT;