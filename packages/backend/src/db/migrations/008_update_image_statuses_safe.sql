-- Migration: Safely update image statuses from 'pending' to 'without_segmentation'
-- This migration includes safety checks and handles edge cases

BEGIN;

-- Check if segmentation_status column exists before updating
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'images' 
    AND column_name = 'segmentation_status'
  ) THEN
    -- First, check for images that might actually be queued
    -- These are images that have entries in segmentation_queue with status 'pending' or 'queued'
    UPDATE images i
    SET segmentation_status = 'queued'
    WHERE i.segmentation_status = 'pending'
    AND EXISTS (
      SELECT 1 
      FROM segmentation_queue sq 
      WHERE sq.image_id = i.id 
      AND sq.status IN ('pending', 'queued')
    );

    -- Update remaining 'pending' images to 'without_segmentation'
    UPDATE images 
    SET segmentation_status = 'without_segmentation'
    WHERE segmentation_status = 'pending' OR segmentation_status IS NULL;

    -- Update default value for new images
    ALTER TABLE images 
    ALTER COLUMN segmentation_status SET DEFAULT 'without_segmentation';
  END IF;
END $$;

-- Check if segmentation_queue table and status column exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'segmentation_queue' 
    AND column_name = 'status'
  ) THEN
    -- Update segmentation_queue table - change 'pending' to 'queued'
    UPDATE segmentation_queue 
    SET status = 'queued'
    WHERE status = 'pending';
  END IF;
END $$;

-- Add comments only if columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'images' 
    AND column_name = 'segmentation_status'
  ) THEN
    COMMENT ON COLUMN images.segmentation_status IS 'Valid values: without_segmentation, queued, processing, completed, failed';
  END IF;

  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'segmentation_queue' 
    AND column_name = 'status'
  ) THEN
    COMMENT ON COLUMN segmentation_queue.status IS 'Valid values: queued, processing, completed, failed, cancelled';
  END IF;
END $$;

-- Log migration results
DO $$
DECLARE
  images_updated INTEGER;
  queue_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO images_updated 
  FROM images 
  WHERE segmentation_status = 'without_segmentation';
  
  SELECT COUNT(*) INTO queue_updated 
  FROM segmentation_queue 
  WHERE status = 'queued';
  
  RAISE NOTICE 'Migration completed: % images updated to without_segmentation, % queue items updated to queued', 
    images_updated, queue_updated;
END $$;

COMMIT;