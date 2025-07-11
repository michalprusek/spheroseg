-- Additional composite indexes for performance optimization
-- This migration adds composite indexes that were identified during performance profiling

-- Enable timing to monitor index creation
\timing on

-- Log index creation start
DO $$ BEGIN RAISE NOTICE 'Starting additional composite index creation at %', NOW(); END $$;

-- Composite index for sorted project image queries
CREATE INDEX IF NOT EXISTS idx_images_project_created ON images(project_id, created_at DESC);
DO $$ BEGIN RAISE NOTICE 'Created index idx_images_project_created for sorted project image queries'; END $$;

-- Composite index for segmentation task queue processing
CREATE INDEX IF NOT EXISTS idx_segmentation_tasks_status_priority ON segmentation_tasks(status, priority DESC, created_at ASC)
WHERE status IN ('queued', 'processing');
DO $$ BEGIN RAISE NOTICE 'Created index idx_segmentation_tasks_status_priority for queue processing'; END $$;

-- Composite index for segmentation results by image
CREATE INDEX IF NOT EXISTS idx_segmentation_results_image_created ON segmentation_results(image_id, created_at DESC);
DO $$ BEGIN RAISE NOTICE 'Created index idx_segmentation_results_image_created for result queries'; END $$;

-- Composite index for user project queries with pagination
CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);
DO $$ BEGIN RAISE NOTICE 'Created index idx_projects_user_created for user project pagination'; END $$;

-- Composite index for project share queries
CREATE INDEX IF NOT EXISTS idx_project_shares_user_project ON project_shares(user_id, project_id);
DO $$ BEGIN RAISE NOTICE 'Created index idx_project_shares_user_project for share permission checks'; END $$;

-- Partial index for active segmentation tasks
CREATE INDEX IF NOT EXISTS idx_segmentation_tasks_active ON segmentation_tasks(image_id, created_at)
WHERE status IN ('queued', 'processing');
DO $$ BEGIN RAISE NOTICE 'Created partial index idx_segmentation_tasks_active for active task monitoring'; END $$;

-- Composite index for cells by result and features
CREATE INDEX IF NOT EXISTS idx_cells_result_area_perimeter ON cells(segmentation_result_id, area, perimeter);
DO $$ BEGIN RAISE NOTICE 'Created index idx_cells_result_area_perimeter for cell feature queries'; END $$;

-- Index for efficient COUNT queries on images per project
CREATE INDEX IF NOT EXISTS idx_images_project_status_count ON images(project_id, segmentation_status)
INCLUDE (id);
DO $$ BEGIN RAISE NOTICE 'Created covering index idx_images_project_status_count for count queries'; END $$;

-- Analyze tables to update statistics
DO $$ BEGIN RAISE NOTICE 'Analyzing tables to update statistics...'; END $$;
ANALYZE images;
ANALYZE segmentation_tasks;
ANALYZE segmentation_results;
ANALYZE cells;
ANALYZE projects;
ANALYZE project_shares;

-- Log completion
DO $$ BEGIN RAISE NOTICE 'Additional composite index creation completed at %', NOW(); END $$;

-- Display new indexes
DO $$
DECLARE
    index_info RECORD;
BEGIN
    RAISE NOTICE 'New composite indexes created:';
    FOR index_info IN
        SELECT indexname, tablename, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname IN (
            'idx_images_project_created',
            'idx_segmentation_tasks_status_priority',
            'idx_segmentation_results_image_created',
            'idx_projects_user_created',
            'idx_project_shares_user_project',
            'idx_segmentation_tasks_active',
            'idx_cells_result_area_perimeter',
            'idx_images_project_status_count'
        )
    LOOP
        RAISE NOTICE '  - % on %', index_info.indexname, index_info.tablename;
    END LOOP;
END $$;