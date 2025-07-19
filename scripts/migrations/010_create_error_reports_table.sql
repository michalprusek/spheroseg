-- Migration: Create error_reports table for error monitoring
-- Date: 2025-07-19
-- Description: Creates table to store client-side and server-side error reports

-- Create error_reports table
CREATE TABLE IF NOT EXISTS error_reports (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    stack TEXT,
    source TEXT,
    lineno INTEGER,
    colno INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT NOT NULL,
    url TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    error_type TEXT,
    severity VARCHAR(20) DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_error_reports_timestamp ON error_reports(server_timestamp);
CREATE INDEX idx_error_reports_user_id ON error_reports(user_id);
CREATE INDEX idx_error_reports_severity ON error_reports(severity);
CREATE INDEX idx_error_reports_error_type ON error_reports(error_type);
CREATE INDEX idx_error_reports_url ON error_reports(url);

-- Create a compound index for common queries
CREATE INDEX idx_error_reports_severity_timestamp ON error_reports(severity, server_timestamp DESC);

-- Add comments for documentation
COMMENT ON TABLE error_reports IS 'Stores client-side and server-side error reports for monitoring';
COMMENT ON COLUMN error_reports.message IS 'Error message';
COMMENT ON COLUMN error_reports.stack IS 'Stack trace if available';
COMMENT ON COLUMN error_reports.source IS 'Source file where error occurred';
COMMENT ON COLUMN error_reports.lineno IS 'Line number where error occurred';
COMMENT ON COLUMN error_reports.colno IS 'Column number where error occurred';
COMMENT ON COLUMN error_reports.timestamp IS 'Client-side timestamp when error occurred';
COMMENT ON COLUMN error_reports.server_timestamp IS 'Server-side timestamp when error was received';
COMMENT ON COLUMN error_reports.user_agent IS 'Browser user agent string';
COMMENT ON COLUMN error_reports.url IS 'URL where error occurred';
COMMENT ON COLUMN error_reports.user_id IS 'User ID if authenticated';
COMMENT ON COLUMN error_reports.session_id IS 'Session identifier';
COMMENT ON COLUMN error_reports.error_type IS 'Type of error (e.g., TypeError, ReferenceError)';
COMMENT ON COLUMN error_reports.severity IS 'Error severity level';
COMMENT ON COLUMN error_reports.metadata IS 'Additional metadata as JSON';
COMMENT ON COLUMN error_reports.ip_address IS 'Client IP address';

-- Create cleanup function for old error reports
CREATE OR REPLACE FUNCTION cleanup_old_error_reports(retention_days INTEGER DEFAULT 30) 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM error_reports 
    WHERE server_timestamp < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % old error reports', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_error_reports IS 'Removes error reports older than specified retention days';

-- Create a view for error statistics
CREATE OR REPLACE VIEW error_report_stats AS
SELECT 
    severity,
    error_type,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT url) as unique_pages,
    MIN(server_timestamp) as first_seen,
    MAX(server_timestamp) as last_seen
FROM error_reports
WHERE server_timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY severity, error_type
ORDER BY count DESC;

COMMENT ON VIEW error_report_stats IS 'Statistics for error reports in the last 24 hours';

-- Grant permissions (adjust as needed for your setup)
GRANT SELECT, INSERT ON error_reports TO spheroseg_app;
GRANT USAGE ON SEQUENCE error_reports_id_seq TO spheroseg_app;
GRANT SELECT ON error_report_stats TO spheroseg_app;