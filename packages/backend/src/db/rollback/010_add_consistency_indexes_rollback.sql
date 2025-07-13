-- Rollback: Remove consistency check indexes
-- Created: 2025-07-12

-- Remove indexes in reverse order
DROP INDEX IF EXISTS idx_segmentation_tasks_image;
DROP INDEX IF EXISTS idx_segmentation_tasks_status;
DROP INDEX IF EXISTS idx_segmentation_queue_image;
DROP INDEX IF EXISTS idx_segmentation_queue_status;
DROP INDEX IF EXISTS idx_images_processing;
DROP INDEX IF EXISTS idx_images_queued;
DROP INDEX IF EXISTS idx_images_null_status;
DROP INDEX IF EXISTS idx_images_status_created;
DROP INDEX IF EXISTS idx_images_project_created;
DROP INDEX IF EXISTS idx_images_project_status;