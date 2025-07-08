-- Rollback script for 009_add_performance_indexes.sql
-- Removes all performance indexes added in the migration

-- Drop Images table indexes
DROP INDEX IF EXISTS idx_images_user_id;
DROP INDEX IF EXISTS idx_images_project_id;
DROP INDEX IF EXISTS idx_images_created_at;
DROP INDEX IF EXISTS idx_images_segmentation_status;
DROP INDEX IF EXISTS idx_images_project_status;

-- Drop Projects table indexes
DROP INDEX IF EXISTS idx_projects_user_id;
DROP INDEX IF EXISTS idx_projects_created_at;
DROP INDEX IF EXISTS idx_projects_updated_at;

-- Drop Segmentation results table indexes
DROP INDEX IF EXISTS idx_segmentation_results_image_id;
DROP INDEX IF EXISTS idx_segmentation_results_status;
DROP INDEX IF EXISTS idx_segmentation_results_created_at;
DROP INDEX IF EXISTS idx_segmentation_results_image_status;

-- Drop Cells table indexes
DROP INDEX IF EXISTS idx_cells_segmentation_result_id;
DROP INDEX IF EXISTS idx_cells_area;
DROP INDEX IF EXISTS idx_cells_perimeter;

-- Drop Segmentation queue indexes
DROP INDEX IF EXISTS idx_segmentation_queue_status;
DROP INDEX IF EXISTS idx_segmentation_queue_created_at;
DROP INDEX IF EXISTS idx_segmentation_queue_priority_status;

-- Drop Project shares indexes
DROP INDEX IF EXISTS idx_project_shares_project_id;
DROP INDEX IF EXISTS idx_project_shares_shared_with_user_id;

-- Drop partial indexes
DROP INDEX IF EXISTS idx_images_active_segmentation;
DROP INDEX IF EXISTS idx_segmentation_queue_pending;