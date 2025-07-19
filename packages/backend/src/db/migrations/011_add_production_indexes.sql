-- Migration: Add production performance indexes
-- Date: 2025-01-19
-- Purpose: Optimize database performance for production deployment

BEGIN;

-- =============================================
-- Images table indexes
-- =============================================

-- Index for frequently queried status and project combinations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_project_status_created 
ON images(project_id, segmentation_status, created_at DESC);

-- Index for user's images with status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_user_status 
ON images(user_id, segmentation_status) 
WHERE deleted_at IS NULL;

-- Index for batch operations on images
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_project_selected 
ON images(project_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- =============================================
-- Segmentation results indexes
-- =============================================

-- Index for quick segmentation result lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_segmentation_results_image_status 
ON segmentation_results(image_id, status);

-- Index for result data queries (JSONB GIN index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_segmentation_results_data_gin 
ON segmentation_results USING GIN (result_data);

-- =============================================
-- Segmentation tasks indexes
-- =============================================

-- Index for queue processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_segmentation_tasks_queue 
ON segmentation_tasks(status, priority DESC, created_at ASC) 
WHERE status IN ('queued', 'processing');

-- Index for task history lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_segmentation_tasks_image_created 
ON segmentation_tasks(image_id, created_at DESC);

-- =============================================
-- Projects table indexes
-- =============================================

-- Index for user's projects listing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_created 
ON projects(user_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for project statistics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_updated 
ON projects(user_id, updated_at DESC) 
WHERE deleted_at IS NULL;

-- =============================================
-- Cells table indexes
-- =============================================

-- Index for cell queries by image
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cells_image_features 
ON cells(image_id, area DESC, eccentricity);

-- Index for feature-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cells_features 
ON cells(area, perimeter, eccentricity) 
WHERE deleted_at IS NULL;

-- =============================================
-- Users table indexes
-- =============================================

-- Index for authentication queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower 
ON users(LOWER(email)) 
WHERE deleted_at IS NULL;

-- Index for active user queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
ON users(is_active, created_at DESC) 
WHERE deleted_at IS NULL AND is_active = true;

-- =============================================
-- Audit and monitoring indexes
-- =============================================

-- Create audit log table if not exists
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for audit log queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created 
ON audit_logs(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource 
ON audit_logs(resource_type, resource_id, created_at DESC);

-- =============================================
-- Performance monitoring table
-- =============================================

CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_endpoint 
ON performance_metrics(endpoint, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_slow 
ON performance_metrics(response_time_ms DESC, created_at DESC) 
WHERE response_time_ms > 1000;

-- =============================================
-- Update table statistics
-- =============================================

ANALYZE images;
ANALYZE segmentation_results;
ANALYZE segmentation_tasks;
ANALYZE projects;
ANALYZE cells;
ANALYZE users;
ANALYZE audit_logs;
ANALYZE performance_metrics;

COMMIT;

-- Note: CONCURRENTLY allows indexes to be created without locking tables
-- This is safe for production but takes longer to complete