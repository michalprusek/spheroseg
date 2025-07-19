-- Rollback script for performance indexes
-- This removes the indexes added for performance optimization

BEGIN;

-- Drop composite indexes
DROP INDEX IF EXISTS idx_images_project_status;
DROP INDEX IF EXISTS idx_images_user_created;
DROP INDEX IF EXISTS idx_segmentation_results_image_status;
DROP INDEX IF EXISTS idx_projects_user_created;
DROP INDEX IF EXISTS idx_cells_segmentation_result;

-- Drop single column indexes that were added
DROP INDEX IF EXISTS idx_images_segmentation_status;
DROP INDEX IF EXISTS idx_segmentation_tasks_status;
DROP INDEX IF EXISTS idx_segmentation_queue_status;

-- Log rollback completion
DO $$
BEGIN
    RAISE NOTICE 'Performance indexes rollback completed at %', NOW();
END $$;

COMMIT;