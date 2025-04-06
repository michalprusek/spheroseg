-- Up migration: Adds segmentation-related tables
BEGIN;

-- Create segmentation_results table
CREATE TABLE segmentation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  mask_path VARCHAR(512) NOT NULL,
  contour_path VARCHAR(512),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for faster segmentation results lookup
CREATE INDEX idx_segmentation_results_file_id ON segmentation_results(file_id);

-- Create segmentation_metrics table for storing evaluation metrics
CREATE TABLE segmentation_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segmentation_id UUID NOT NULL REFERENCES segmentation_results(id) ON DELETE CASCADE,
  iou FLOAT,
  dice FLOAT,
  precision FLOAT,
  recall FLOAT,
  additional_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for faster metrics lookup
CREATE INDEX idx_segmentation_metrics_segmentation_id ON segmentation_metrics(segmentation_id);

-- Create segmentation_annotations table for manual annotations
CREATE TABLE segmentation_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  annotation_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for faster annotation lookup
CREATE INDEX idx_segmentation_annotations_file_id ON segmentation_annotations(file_id);
CREATE INDEX idx_segmentation_annotations_user_id ON segmentation_annotations(user_id);

-- Add segmentation status to files table
ALTER TABLE files
ADD COLUMN IF NOT EXISTS segmentation_status VARCHAR(50) DEFAULT 'pending';

-- Record this migration
INSERT INTO migrations (name) VALUES ('004_add_segmentation_tables.sql');

COMMIT;

-- Down migration: Removes added schema
BEGIN;

DROP TABLE IF EXISTS segmentation_metrics;
DROP TABLE IF EXISTS segmentation_annotations;
DROP TABLE IF EXISTS segmentation_results;
ALTER TABLE files DROP COLUMN IF EXISTS segmentation_status;

COMMIT;
