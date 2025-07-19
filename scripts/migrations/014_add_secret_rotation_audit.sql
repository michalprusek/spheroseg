-- Migration: Add secret rotation audit table
-- Description: Track all secret rotation events for compliance and security auditing

BEGIN;

-- Create enum for rotation status
CREATE TYPE rotation_status AS ENUM ('success', 'failed', 'in_progress');

-- Create secret rotation audit table
CREATE TABLE IF NOT EXISTS secret_rotation_audit (
    id SERIAL PRIMARY KEY,
    secret_name VARCHAR(255) NOT NULL,
    old_version VARCHAR(255),
    new_version VARCHAR(255),
    rotated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    grace_period_ends TIMESTAMP WITH TIME ZONE,
    status rotation_status NOT NULL DEFAULT 'in_progress',
    success BOOLEAN,
    error TEXT,
    rotated_by VARCHAR(255) NOT NULL DEFAULT 'system',
    rotation_type VARCHAR(50) CHECK (rotation_type IN ('scheduled', 'manual', 'emergency')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_secret_rotation_audit_secret_name ON secret_rotation_audit(secret_name);
CREATE INDEX idx_secret_rotation_audit_rotated_at ON secret_rotation_audit(rotated_at DESC);
CREATE INDEX idx_secret_rotation_audit_status ON secret_rotation_audit(status);
CREATE INDEX idx_secret_rotation_audit_rotation_type ON secret_rotation_audit(rotation_type);

-- Create view for latest rotation per secret
CREATE VIEW latest_secret_rotations AS
SELECT DISTINCT ON (secret_name) 
    secret_name,
    new_version AS current_version,
    rotated_at,
    grace_period_ends,
    status,
    rotation_type
FROM secret_rotation_audit
WHERE success = true
ORDER BY secret_name, rotated_at DESC;

-- Create function to get rotation history
CREATE OR REPLACE FUNCTION get_secret_rotation_history(
    p_secret_name VARCHAR(255),
    p_days_back INTEGER DEFAULT 90
)
RETURNS TABLE (
    version VARCHAR(255),
    rotated_at TIMESTAMP WITH TIME ZONE,
    rotation_type VARCHAR(50),
    rotated_by VARCHAR(255),
    status rotation_status,
    error TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        new_version,
        sra.rotated_at,
        sra.rotation_type,
        sra.rotated_by,
        sra.status,
        sra.error
    FROM secret_rotation_audit sra
    WHERE sra.secret_name = p_secret_name
        AND sra.rotated_at >= NOW() - INTERVAL '1 day' * p_days_back
    ORDER BY sra.rotated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if rotation is overdue
CREATE OR REPLACE FUNCTION is_rotation_overdue(
    p_secret_name VARCHAR(255),
    p_rotation_interval_days INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_rotation TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT MAX(rotated_at) INTO v_last_rotation
    FROM secret_rotation_audit
    WHERE secret_name = p_secret_name
        AND success = true;
    
    IF v_last_rotation IS NULL THEN
        RETURN true; -- Never rotated
    END IF;
    
    RETURN (NOW() - v_last_rotation) > INTERVAL '1 day' * p_rotation_interval_days;
END;
$$ LANGUAGE plpgsql;

-- Create notification table for rotation events
CREATE TABLE IF NOT EXISTS secret_rotation_notifications (
    id SERIAL PRIMARY KEY,
    rotation_audit_id INTEGER REFERENCES secret_rotation_audit(id),
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('pre_rotation', 'post_rotation', 'failure', 'reminder')),
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'slack', 'webhook')),
    recipient VARCHAR(255),
    sent_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_secret_rotation_notifications_audit_id ON secret_rotation_notifications(rotation_audit_id);
CREATE INDEX idx_secret_rotation_notifications_sent_at ON secret_rotation_notifications(sent_at);

-- Create table for rotation schedules
CREATE TABLE IF NOT EXISTS secret_rotation_schedules (
    secret_name VARCHAR(255) PRIMARY KEY,
    rotation_interval_days INTEGER NOT NULL,
    grace_period_hours INTEGER NOT NULL,
    last_rotation TIMESTAMP WITH TIME ZONE,
    next_rotation TIMESTAMP WITH TIME ZONE NOT NULL,
    rotation_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE secret_rotation_audit IS 'Audit trail for all secret rotation events';
COMMENT ON TABLE secret_rotation_notifications IS 'Track notifications sent for rotation events';
COMMENT ON TABLE secret_rotation_schedules IS 'Rotation schedules and configuration for each secret';
COMMENT ON VIEW latest_secret_rotations IS 'View showing the latest successful rotation for each secret';

COMMIT;