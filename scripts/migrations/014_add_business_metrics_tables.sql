-- Business Metrics Tables
-- This migration creates tables for storing business metric audit logs

-- Create error_logs table for tracking user errors
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT,
    error_code VARCHAR(20),
    endpoint VARCHAR(255),
    request_id VARCHAR(100),
    stack_trace TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create index for efficient error rate queries
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);

-- Create user_activity_logs table for tracking active users
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create index for efficient active user queries
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at);
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);

-- Create api_request_logs table for tracking API performance
CREATE TABLE IF NOT EXISTS api_request_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_time NUMERIC(10, 2), -- milliseconds
    status_code INTEGER,
    request_size INTEGER,
    response_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create index for efficient API performance queries
CREATE INDEX idx_api_request_logs_created_at ON api_request_logs(created_at);
CREATE INDEX idx_api_request_logs_response_time ON api_request_logs(response_time);
CREATE INDEX idx_api_request_logs_endpoint ON api_request_logs(endpoint);

-- Add accuracy_score column to segmentation_results if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'segmentation_results' 
                   AND column_name = 'accuracy_score') THEN
        ALTER TABLE segmentation_results 
        ADD COLUMN accuracy_score NUMERIC(5, 4); -- 0.0000 to 1.0000
    END IF;
END $$;

-- Add completed_at column to segmentation_results if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'segmentation_results' 
                   AND column_name = 'completed_at') THEN
        ALTER TABLE segmentation_results 
        ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add started_at column to segmentation_results if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'segmentation_results' 
                   AND column_name = 'started_at') THEN
        ALTER TABLE segmentation_results 
        ADD COLUMN started_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create business_metric_alerts table for storing alert history
CREATE TABLE IF NOT EXISTS business_metric_alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(100) UNIQUE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('warning', 'critical')),
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('threshold', 'trend', 'anomaly')),
    message TEXT NOT NULL,
    metric_value NUMERIC,
    threshold_value NUMERIC,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create indexes for alert queries
CREATE INDEX idx_business_metric_alerts_created_at ON business_metric_alerts(created_at);
CREATE INDEX idx_business_metric_alerts_metric_name ON business_metric_alerts(metric_name);
CREATE INDEX idx_business_metric_alerts_severity ON business_metric_alerts(severity);
CREATE INDEX idx_business_metric_alerts_acknowledged ON business_metric_alerts(acknowledged);

-- Create function to clean up old logs (optional, can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS void AS $$
BEGIN
    DELETE FROM error_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;
    DELETE FROM user_activity_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;
    DELETE FROM api_request_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;
    DELETE FROM business_metric_alerts WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep * 3; -- Keep alerts longer
END;
$$ LANGUAGE plpgsql;