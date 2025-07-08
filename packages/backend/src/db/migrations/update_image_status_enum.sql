-- Migration to update image status enum values
-- This migration updates the status columns to use the new status values

-- First, update any existing 'pending' statuses to 'without_segmentation'
UPDATE images 
SET status = 'without_segmentation' 
WHERE status = 'pending';

UPDATE images 
SET segmentation_status = 'without_segmentation' 
WHERE segmentation_status = 'pending';

UPDATE segmentation_results 
SET status = 'without_segmentation' 
WHERE status = 'pending';

-- Update segmentation_queue table as well
UPDATE segmentation_queue 
SET status = 'queued' 
WHERE status = 'pending';

-- Update segmentation_tasks table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'segmentation_tasks') THEN
        UPDATE segmentation_tasks 
        SET status = 'queued' 
        WHERE status = 'pending';
    END IF;
END $$;

-- Add a comment to document the valid status values
COMMENT ON COLUMN images.status IS 'Valid values: queued, processing, completed, failed, saving, without_segmentation';
COMMENT ON COLUMN images.segmentation_status IS 'Valid values: queued, processing, completed, failed, saving, without_segmentation';
COMMENT ON COLUMN segmentation_results.status IS 'Valid values: queued, processing, completed, failed, saving, without_segmentation';
COMMENT ON COLUMN segmentation_queue.status IS 'Valid values: queued, processing, completed, failed, cancelled';