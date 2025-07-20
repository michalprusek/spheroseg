-- Migration: Create Error Tracking Tables
-- Description: Create tables for the enhanced error tracking and alerting system
-- Date: 2025-07-19

-- Error logs table for tracking all application errors
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  fingerprint VARCHAR(32) NOT NULL,
  code VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category VARCHAR(50) NOT NULL CHECK (category IN ('authentication', 'validation', 'permission', 'business', 'external', 'system')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  request_id VARCHAR(100),
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  ip_address INET,
  user_agent TEXT,
  request_duration INTEGER, -- milliseconds
  memory_usage BIGINT, -- bytes
  cpu_usage DECIMAL(5,2), -- percentage
  context JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT
);

-- Indexes for error_logs
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON error_logs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_code ON error_logs(code);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint ON error_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_error_logs_status_code ON error_logs(status_code);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint_created ON error_logs(fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity_created ON error_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved_created ON error_logs(resolved, created_at DESC) WHERE resolved = FALSE;

-- Error patterns table for tracking recurring error patterns
CREATE TABLE IF NOT EXISTS error_patterns (
  id SERIAL PRIMARY KEY,
  fingerprint VARCHAR(32) UNIQUE NOT NULL,
  error_code VARCHAR(100) NOT NULL,
  message_pattern TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  unique_users INTEGER DEFAULT 0,
  affected_endpoints TEXT[],
  avg_response_time DECIMAL(10,2),
  avg_memory_usage BIGINT,
  trend_direction VARCHAR(20) CHECK (trend_direction IN ('increasing', 'decreasing', 'stable')),
  trend_percentage DECIMAL(5,2),
  anomaly_score DECIMAL(5,2) DEFAULT 0,
  priority_score INTEGER DEFAULT 0,
  impact_score DECIMAL(5,2) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for error_patterns
CREATE INDEX IF NOT EXISTS idx_error_patterns_fingerprint ON error_patterns(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_patterns_last_seen ON error_patterns(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_error_patterns_occurrence_count ON error_patterns(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_error_patterns_priority_score ON error_patterns(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_error_patterns_category ON error_patterns(category);
CREATE INDEX IF NOT EXISTS idx_error_patterns_impact_score ON error_patterns(impact_score DESC);

-- Error alerts table for tracking alert notifications
CREATE TABLE IF NOT EXISTS error_alerts (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(50) UNIQUE NOT NULL,
  error_pattern_id INTEGER REFERENCES error_patterns(id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('threshold', 'pattern', 'anomaly', 'trend', 'spike')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  threshold_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  time_window INTEGER, -- minutes
  affected_users INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  channels_notified TEXT[], -- email, slack, webhook, etc.
  notification_status VARCHAR(20) DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'failed', 'retrying')),
  notification_attempts INTEGER DEFAULT 0,
  last_notification_attempt TIMESTAMP WITH TIME ZONE,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledgment_notes TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  auto_resolved BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for error_alerts
CREATE INDEX IF NOT EXISTS idx_error_alerts_alert_id ON error_alerts(alert_id);
CREATE INDEX IF NOT EXISTS idx_error_alerts_pattern_id ON error_alerts(error_pattern_id);
CREATE INDEX IF NOT EXISTS idx_error_alerts_created_at ON error_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_alerts_severity ON error_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_error_alerts_acknowledged ON error_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_error_alerts_resolved ON error_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_error_alerts_notification_status ON error_alerts(notification_status);

-- Composite indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_error_alerts_active ON error_alerts(acknowledged, resolved, created_at DESC) 
  WHERE acknowledged = FALSE AND resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_error_alerts_pending_notifications ON error_alerts(notification_status, created_at DESC) 
  WHERE notification_status IN ('pending', 'failed', 'retrying');

-- Error insights table for storing analysis results and recommendations
CREATE TABLE IF NOT EXISTS error_insights (
  id SERIAL PRIMARY KEY,
  insight_id VARCHAR(50) UNIQUE NOT NULL,
  insight_type VARCHAR(30) NOT NULL CHECK (insight_type IN ('correlation', 'root_cause', 'recommendation', 'trend_analysis', 'impact_assessment')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  impact_level VARCHAR(20) CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  related_patterns TEXT[], -- Array of fingerprints
  affected_endpoints TEXT[],
  affected_users INTEGER DEFAULT 0,
  time_range_start TIMESTAMP WITH TIME ZONE,
  time_range_end TIMESTAMP WITH TIME ZONE,
  recommendations JSONB,
  metrics JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for error_insights
CREATE INDEX IF NOT EXISTS idx_error_insights_insight_id ON error_insights(insight_id);
CREATE INDEX IF NOT EXISTS idx_error_insights_type ON error_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_error_insights_impact_level ON error_insights(impact_level);
CREATE INDEX IF NOT EXISTS idx_error_insights_confidence ON error_insights(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_error_insights_created_at ON error_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_insights_expires_at ON error_insights(expires_at);

-- Create trigger to update updated_at timestamp on error_patterns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_error_patterns_updated_at 
  BEFORE UPDATE ON error_patterns 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_error_alerts_updated_at 
  BEFORE UPDATE ON error_alerts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries

-- View for active error summary
CREATE OR REPLACE VIEW active_error_summary AS
SELECT 
  ep.fingerprint,
  ep.error_code,
  ep.category,
  ep.occurrence_count,
  ep.unique_users,
  ep.last_seen,
  ep.trend_direction,
  ep.priority_score,
  ep.impact_score,
  COUNT(ea.id) FILTER (WHERE ea.acknowledged = FALSE AND ea.resolved = FALSE) as active_alerts,
  MAX(ea.severity) as highest_alert_severity
FROM error_patterns ep
LEFT JOIN error_alerts ea ON ep.id = ea.error_pattern_id
WHERE ep.last_seen > NOW() - INTERVAL '24 hours'
GROUP BY ep.id, ep.fingerprint, ep.error_code, ep.category, ep.occurrence_count, 
         ep.unique_users, ep.last_seen, ep.trend_direction, ep.priority_score, ep.impact_score
ORDER BY ep.priority_score DESC, ep.last_seen DESC;

-- View for error trend analysis
CREATE OR REPLACE VIEW error_trend_analysis AS
SELECT 
  DATE_TRUNC('hour', el.created_at) as hour,
  el.category,
  el.severity,
  COUNT(*) as error_count,
  COUNT(DISTINCT el.user_id) as affected_users,
  COUNT(DISTINCT el.fingerprint) as unique_patterns,
  AVG(el.request_duration) as avg_response_time,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY el.request_duration) as p95_response_time
FROM error_logs el
WHERE el.created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', el.created_at), el.category, el.severity
ORDER BY hour DESC, error_count DESC;

-- View for user error impact
CREATE OR REPLACE VIEW user_error_impact AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(el.id) as total_errors,
  COUNT(DISTINCT el.fingerprint) as unique_error_types,
  MAX(el.created_at) as last_error,
  COUNT(el.id) FILTER (WHERE el.severity IN ('high', 'critical')) as critical_errors,
  COUNT(el.id) FILTER (WHERE el.created_at > NOW() - INTERVAL '24 hours') as recent_errors
FROM users u
LEFT JOIN error_logs el ON u.id = el.user_id
WHERE el.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email
HAVING COUNT(el.id) > 0
ORDER BY total_errors DESC, critical_errors DESC;

-- Add comments for documentation
COMMENT ON TABLE error_logs IS 'Stores individual error occurrences with full context and metadata';
COMMENT ON TABLE error_patterns IS 'Aggregated patterns of similar errors for trend analysis and alerting';
COMMENT ON TABLE error_alerts IS 'Alert notifications generated based on error patterns and thresholds';
COMMENT ON TABLE error_insights IS 'AI-generated insights and recommendations for error resolution';

COMMENT ON COLUMN error_logs.fingerprint IS 'MD5 hash used to group similar errors together';
COMMENT ON COLUMN error_logs.severity IS 'Business impact severity level of the error';
COMMENT ON COLUMN error_logs.category IS 'Functional category classification of the error';
COMMENT ON COLUMN error_patterns.anomaly_score IS 'Statistical anomaly detection score (0-100)';
COMMENT ON COLUMN error_patterns.priority_score IS 'Calculated priority score for handling order';
COMMENT ON COLUMN error_patterns.impact_score IS 'Business impact score based on affected users and frequency';