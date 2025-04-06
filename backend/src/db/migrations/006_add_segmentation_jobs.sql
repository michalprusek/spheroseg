-- Up migration: Adds segmentation_jobs table for ML segmentation pipeline
BEGIN;

CREATE TABLE segmentation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  callback_url VARCHAR(512),
  callback_token VARCHAR(512),
  result_id UUID REFERENCES segmentation_results(id) ON DELETE SET NULL,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segmentation_jobs_project_id ON segmentation_jobs(project_id);
CREATE INDEX idx_segmentation_jobs_file_id ON segmentation_jobs(file_id);
CREATE INDEX idx_segmentation_jobs_status ON segmentation_jobs(status);

INSERT INTO migrations (name) VALUES ('006_add_segmentation_jobs.sql');

COMMIT;

-- Down migration: Removes segmentation_jobs table
BEGIN;

DROP TABLE IF EXISTS segmentation_jobs;

COMMIT;