-- Add performance indexes for frequently queried columns
-- This migration adds indexes to improve query performance

-- Enable timing to monitor index creation
\timing on

-- Log index creation start
DO $$ BEGIN RAISE NOTICE 'Starting performance index creation at %', NOW(); END $$;

-- Images table indexes
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
DO $$ BEGIN RAISE NOTICE 'Created index idx_images_user_id'; END $$;

CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id);
DO $$ BEGIN RAISE NOTICE 'Created index idx_images_project_id'; END $$;

CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
DO $$ BEGIN RAISE NOTICE 'Created index idx_images_created_at'; END $$;

CREATE INDEX IF NOT EXISTS idx_images_segmentation_status ON images(segmentation_status);
DO $$ BEGIN RAISE NOTICE 'Created index idx_images_segmentation_status'; END $$;

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_images_project_status ON images(project_id, segmentation_status);

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Segmentation results table indexes
CREATE INDEX IF NOT EXISTS idx_segmentation_results_image_id ON segmentation_results(image_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_results_status ON segmentation_results(status);
CREATE INDEX IF NOT EXISTS idx_segmentation_results_created_at ON segmentation_results(created_at DESC);

-- Composite index for status checks
CREATE INDEX IF NOT EXISTS idx_segmentation_results_image_status ON segmentation_results(image_id, status);

-- Cells table indexes (for faster feature queries)
CREATE INDEX IF NOT EXISTS idx_cells_segmentation_result_id ON cells(segmentation_result_id);
CREATE INDEX IF NOT EXISTS idx_cells_area ON cells(area);
CREATE INDEX IF NOT EXISTS idx_cells_perimeter ON cells(perimeter);

-- Segmentation queue indexes
CREATE INDEX IF NOT EXISTS idx_segmentation_queue_status ON segmentation_queue(status);
CREATE INDEX IF NOT EXISTS idx_segmentation_queue_created_at ON segmentation_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_segmentation_queue_priority_status ON segmentation_queue(priority DESC, status, created_at);

-- Project shares indexes
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_with_user_id ON project_shares(shared_with_user_id);

-- Add partial indexes for active records
CREATE INDEX IF NOT EXISTS idx_images_active_segmentation ON images(id, project_id) 
WHERE segmentation_status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_segmentation_queue_pending ON segmentation_queue(id, image_id) 
WHERE status IN ('queued', 'processing');

-- Analyze tables to update statistics
DO $$ BEGIN RAISE NOTICE 'Analyzing tables to update statistics...'; END $$;
ANALYZE images;
ANALYZE projects;
ANALYZE segmentation_results;
ANALYZE cells;
ANALYZE segmentation_queue;
ANALYZE project_shares;

-- Log completion
DO $$ BEGIN RAISE NOTICE 'Performance index creation completed at %', NOW(); END $$;

-- Check index usage (for monitoring)
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename IN ('images', 'projects', 'segmentation_results', 'cells', 'segmentation_queue', 'project_shares');
    
    RAISE NOTICE 'Total indexes on performance-critical tables: %', index_count;
END $$;