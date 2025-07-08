-- Migration: Update image statuses from 'pending' to 'without_segmentation'
-- This migration updates the status system to better reflect the actual state of images

BEGIN;

-- Update images table - change 'pending' to 'without_segmentation'
UPDATE images 
SET segmentation_status = 'without_segmentation'
WHERE segmentation_status = 'pending' OR segmentation_status IS NULL;

-- Update default value for new images
ALTER TABLE images 
ALTER COLUMN segmentation_status SET DEFAULT 'without_segmentation';

-- Update segmentation_queue table - change 'pending' to 'queued'
UPDATE segmentation_queue 
SET status = 'queued'
WHERE status = 'pending';

-- Update segmentation_results table - this should remain as is
-- as it tracks the actual segmentation process status

-- Add comment to clarify valid status values
COMMENT ON COLUMN images.segmentation_status IS 'Valid values: without_segmentation, queued, processing, completed, failed';
COMMENT ON COLUMN segmentation_queue.status IS 'Valid values: queued, processing, completed, failed, cancelled';

COMMIT;