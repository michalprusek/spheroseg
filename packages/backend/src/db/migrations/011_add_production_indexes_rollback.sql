-- Rollback: Remove production performance indexes
-- Date: 2025-01-19

BEGIN;

-- Drop images table indexes
DROP INDEX IF EXISTS idx_images_project_status_created;
DROP INDEX IF EXISTS idx_images_user_status;
DROP INDEX IF EXISTS idx_images_project_selected;

-- Drop segmentation results indexes
DROP INDEX IF EXISTS idx_segmentation_results_image_status;
DROP INDEX IF EXISTS idx_segmentation_results_data_gin;

-- Drop segmentation tasks indexes
DROP INDEX IF EXISTS idx_segmentation_tasks_queue;
DROP INDEX IF EXISTS idx_segmentation_tasks_image_created;

-- Drop projects table indexes
DROP INDEX IF EXISTS idx_projects_user_created;
DROP INDEX IF EXISTS idx_projects_user_updated;

-- Drop cells table indexes
DROP INDEX IF EXISTS idx_cells_image_features;
DROP INDEX IF EXISTS idx_cells_features;

-- Drop users table indexes
DROP INDEX IF EXISTS idx_users_email_lower;
DROP INDEX IF EXISTS idx_users_active;

-- Drop audit log indexes and table
DROP INDEX IF EXISTS idx_audit_logs_user_created;
DROP INDEX IF EXISTS idx_audit_logs_resource;
DROP TABLE IF EXISTS audit_logs;

-- Drop performance metrics indexes and table
DROP INDEX IF EXISTS idx_performance_metrics_endpoint;
DROP INDEX IF EXISTS idx_performance_metrics_slow;
DROP TABLE IF EXISTS performance_metrics;

COMMIT;