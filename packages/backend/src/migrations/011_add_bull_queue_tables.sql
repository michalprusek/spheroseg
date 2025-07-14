-- Migration: Add Bull Queue Tracking Tables
-- Description: Creates tables to track Bull queue jobs and their status in the database
-- Author: System
-- Date: 2025-07-14

BEGIN;

-- Create queue_jobs table for tracking Bull queue jobs
CREATE TABLE IF NOT EXISTS queue_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  priority INTEGER DEFAULT 1,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_queue_jobs_status ON queue_jobs(status);
CREATE INDEX idx_queue_jobs_user_id ON queue_jobs(user_id);
CREATE INDEX idx_queue_jobs_created_at ON queue_jobs(created_at);
CREATE INDEX idx_queue_jobs_task_id ON queue_jobs(task_id);
CREATE INDEX idx_queue_jobs_image_id ON queue_jobs(image_id);

-- Create a composite index for status queries with ordering
CREATE INDEX idx_queue_jobs_status_priority_created 
  ON queue_jobs(status, priority DESC, created_at);

-- Add column to segmentation_tasks to link with queue jobs
ALTER TABLE segmentation_tasks 
  ADD COLUMN IF NOT EXISTS queue_job_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Create foreign key constraint
ALTER TABLE segmentation_tasks
  ADD CONSTRAINT fk_segmentation_tasks_queue_job_id
  FOREIGN KEY (queue_job_id) 
  REFERENCES queue_jobs(job_id)
  ON DELETE SET NULL;

-- Create index on the new column
CREATE INDEX idx_segmentation_tasks_queue_job_id 
  ON segmentation_tasks(queue_job_id);

-- Create queue_metrics table for monitoring
CREATE TABLE IF NOT EXISTS queue_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
  total_jobs INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  failed_jobs INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER,
  max_processing_time_ms INTEGER,
  min_processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(metric_date, hour)
);

-- Create index for efficient metric queries
CREATE INDEX idx_queue_metrics_date ON queue_metrics(metric_date);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_queue_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_queue_jobs_updated_at_trigger
  BEFORE UPDATE ON queue_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_queue_jobs_updated_at();

-- Create function to calculate queue metrics
CREATE OR REPLACE FUNCTION calculate_queue_metrics(
  p_date DATE DEFAULT CURRENT_DATE,
  p_hour INTEGER DEFAULT EXTRACT(HOUR FROM NOW())
)
RETURNS void AS $$
DECLARE
  v_total_jobs INTEGER;
  v_completed_jobs INTEGER;
  v_failed_jobs INTEGER;
  v_avg_time INTEGER;
  v_max_time INTEGER;
  v_min_time INTEGER;
BEGIN
  -- Calculate metrics for the specified date and hour
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)) * 1000)::INTEGER,
    MAX(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)) * 1000)::INTEGER,
    MIN(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)) * 1000)::INTEGER
  INTO 
    v_total_jobs, v_completed_jobs, v_failed_jobs,
    v_avg_time, v_max_time, v_min_time
  FROM queue_jobs
  WHERE DATE(created_at) = p_date
    AND EXTRACT(HOUR FROM created_at) = p_hour
    AND processing_completed_at IS NOT NULL;

  -- Insert or update metrics
  INSERT INTO queue_metrics (
    metric_date, hour, total_jobs, completed_jobs, failed_jobs,
    avg_processing_time_ms, max_processing_time_ms, min_processing_time_ms
  )
  VALUES (
    p_date, p_hour, v_total_jobs, v_completed_jobs, v_failed_jobs,
    v_avg_time, v_max_time, v_min_time
  )
  ON CONFLICT (metric_date, hour) DO UPDATE SET
    total_jobs = EXCLUDED.total_jobs,
    completed_jobs = EXCLUDED.completed_jobs,
    failed_jobs = EXCLUDED.failed_jobs,
    avg_processing_time_ms = EXCLUDED.avg_processing_time_ms,
    max_processing_time_ms = EXCLUDED.max_processing_time_ms,
    min_processing_time_ms = EXCLUDED.min_processing_time_ms;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust user as needed)
GRANT SELECT, INSERT, UPDATE ON queue_jobs TO PUBLIC;
GRANT SELECT ON queue_metrics TO PUBLIC;
GRANT USAGE ON SEQUENCE queue_jobs_id_seq TO PUBLIC;
GRANT USAGE ON SEQUENCE queue_metrics_id_seq TO PUBLIC;

COMMIT;