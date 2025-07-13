-- Migration: Add indexes for database consistency checks and performance
-- Created: 2025-07-12
-- Purpose: Optimize queries used in consistency checks and image operations

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_images_project_status 
ON images(project_id, segmentation_status);

CREATE INDEX IF NOT EXISTS idx_images_project_created 
ON images(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_images_status_created 
ON images(segmentation_status, created_at DESC);

-- Index for finding images without status
CREATE INDEX IF NOT EXISTS idx_images_null_status 
ON images(project_id) 
WHERE segmentation_status IS NULL;

-- Index for queued images
CREATE INDEX IF NOT EXISTS idx_images_queued 
ON images(project_id, created_at DESC) 
WHERE segmentation_status = 'queued';

-- Index for processing images
CREATE INDEX IF NOT EXISTS idx_images_processing 
ON images(project_id, updated_at DESC) 
WHERE segmentation_status = 'processing';

-- Index for segmentation queue
CREATE INDEX IF NOT EXISTS idx_segmentation_queue_status 
ON segmentation_queue(status, created_at);

CREATE INDEX IF NOT EXISTS idx_segmentation_queue_image 
ON segmentation_queue(image_id, status);

-- Index for segmentation tasks
CREATE INDEX IF NOT EXISTS idx_segmentation_tasks_status 
ON segmentation_tasks(task_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_segmentation_tasks_image 
ON segmentation_tasks(image_id, task_status);

-- Analyze tables to update statistics
ANALYZE images;
ANALYZE segmentation_queue;
ANALYZE segmentation_tasks;