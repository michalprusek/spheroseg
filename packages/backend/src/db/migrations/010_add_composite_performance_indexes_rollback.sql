-- Rollback script for 010_add_composite_performance_indexes.sql
-- This script removes the composite indexes added for performance optimization

-- Enable timing
\timing on

-- Log rollback start
DO $$ BEGIN RAISE NOTICE 'Starting composite index rollback at %', NOW(); END $$;

-- Drop composite indexes
DROP INDEX IF EXISTS idx_images_project_created;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_images_project_created'; END $$;

DROP INDEX IF EXISTS idx_segmentation_tasks_status_priority;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_segmentation_tasks_status_priority'; END $$;

DROP INDEX IF EXISTS idx_segmentation_results_image_created;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_segmentation_results_image_created'; END $$;

DROP INDEX IF EXISTS idx_projects_user_created;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_projects_user_created'; END $$;

DROP INDEX IF EXISTS idx_project_shares_user_project;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_project_shares_user_project'; END $$;

DROP INDEX IF EXISTS idx_segmentation_tasks_active;
DO $$ BEGIN RAISE NOTICE 'Dropped partial index idx_segmentation_tasks_active'; END $$;

DROP INDEX IF EXISTS idx_cells_result_area_perimeter;
DO $$ BEGIN RAISE NOTICE 'Dropped index idx_cells_result_area_perimeter'; END $$;

DROP INDEX IF EXISTS idx_images_project_status_count;
DO $$ BEGIN RAISE NOTICE 'Dropped covering index idx_images_project_status_count'; END $$;

-- Log completion
DO $$ BEGIN RAISE NOTICE 'Composite index rollback completed at %', NOW(); END $$;