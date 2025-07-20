/**
 * Error Tracking Configuration
 * 
 * Centralized configuration for error tracking system including
 * retention policies, rate limits, and privacy settings
 */

export interface ErrorTrackingRetentionPolicy {
  errorLogs: {
    days: number;
    maxRecords?: number;
    archiveEnabled: boolean;
    archiveLocation?: string;
  };
  errorPatterns: {
    days: number;
    maxRecords?: number;
    keepUnresolved: boolean;
  };
  errorAlerts: {
    days: number;
    maxRecords?: number;
    keepCritical: boolean;
  };
  errorInsights: {
    days: number;
    maxRecords?: number;
  };
}

export interface ErrorTrackingPrivacyConfig {
  sanitizePII: boolean;
  piiPatterns: string[];
  excludeFields: string[];
  anonymizeUserIds: boolean;
  redactSensitiveData: boolean;
  ipAddressHandling: 'full' | 'partial' | 'hash' | 'remove';
}

export interface ErrorTrackingStorageConfig {
  maxErrorSize: number; // bytes
  maxStackTraceLength: number; // characters
  maxContextSize: number; // bytes
  compressionEnabled: boolean;
  deduplicationWindow: number; // minutes
}

export const ERROR_TRACKING_CONFIG = {
  // Retention policies
  retention: {
    errorLogs: {
      days: parseInt(process.env.ERROR_LOGS_RETENTION_DAYS || '30'),
      maxRecords: parseInt(process.env.ERROR_LOGS_MAX_RECORDS || '1000000'),
      archiveEnabled: process.env.ERROR_LOGS_ARCHIVE_ENABLED === 'true',
      archiveLocation: process.env.ERROR_LOGS_ARCHIVE_PATH || '/archive/errors',
    },
    errorPatterns: {
      days: parseInt(process.env.ERROR_PATTERNS_RETENTION_DAYS || '90'),
      maxRecords: parseInt(process.env.ERROR_PATTERNS_MAX_RECORDS || '10000'),
      keepUnresolved: true,
    },
    errorAlerts: {
      days: parseInt(process.env.ERROR_ALERTS_RETENTION_DAYS || '30'),
      maxRecords: parseInt(process.env.ERROR_ALERTS_MAX_RECORDS || '50000'),
      keepCritical: true,
    },
    errorInsights: {
      days: parseInt(process.env.ERROR_INSIGHTS_RETENTION_DAYS || '60'),
      maxRecords: parseInt(process.env.ERROR_INSIGHTS_MAX_RECORDS || '5000'),
    },
  } as ErrorTrackingRetentionPolicy,
  
  // Privacy configuration
  privacy: {
    sanitizePII: process.env.ERROR_TRACKING_SANITIZE_PII !== 'false',
    piiPatterns: [
      'password', 'token', 'secret', 'key', 'auth',
      'credential', 'ssn', 'credit_card', 'email'
    ],
    excludeFields: [
      'password', 'passwordHash', 'salt', 'token',
      'refreshToken', 'apiKey', 'secretKey', 'privateKey',
      'creditCard', 'cvv', 'ssn', 'bankAccount'
    ],
    anonymizeUserIds: process.env.ERROR_TRACKING_ANONYMIZE_USERS === 'true',
    redactSensitiveData: true,
    ipAddressHandling: (process.env.ERROR_TRACKING_IP_HANDLING || 'partial') as any,
  } as ErrorTrackingPrivacyConfig,
  
  // Storage configuration
  storage: {
    maxErrorSize: parseInt(process.env.ERROR_MAX_SIZE || '10240'), // 10KB
    maxStackTraceLength: parseInt(process.env.ERROR_MAX_STACK_LENGTH || '5000'),
    maxContextSize: parseInt(process.env.ERROR_MAX_CONTEXT_SIZE || '5120'), // 5KB
    compressionEnabled: process.env.ERROR_COMPRESSION_ENABLED !== 'false',
    deduplicationWindow: parseInt(process.env.ERROR_DEDUP_WINDOW || '5'), // 5 minutes
  } as ErrorTrackingStorageConfig,
  
  // Rate limiting
  rateLimits: {
    errorReporting: {
      windowMs: 60000, // 1 minute
      maxRequests: 5,
      blockDuration: 300, // 5 minutes
    },
    apiAccess: {
      windowMs: 60000, // 1 minute
      maxRequests: 30,
      blockDuration: 180, // 3 minutes
    },
  },
  
  // Alert thresholds
  alertThresholds: {
    errorRatePerMinute: parseInt(process.env.ERROR_RATE_THRESHOLD || '10'),
    criticalErrorsPerHour: parseInt(process.env.CRITICAL_ERRORS_THRESHOLD || '5'),
    uniqueErrorsPerHour: parseInt(process.env.UNIQUE_ERRORS_THRESHOLD || '20'),
    errorSpike: {
      threshold: parseInt(process.env.ERROR_SPIKE_THRESHOLD || '200'), // 200% increase
      timeWindow: parseInt(process.env.ERROR_SPIKE_WINDOW || '15'), // 15 minutes
    },
  },
  
  // Feature flags
  features: {
    enableRealTimeAlerts: process.env.ERROR_REALTIME_ALERTS !== 'false',
    enablePatternDetection: process.env.ERROR_PATTERN_DETECTION !== 'false',
    enableCorrelationAnalysis: process.env.ERROR_CORRELATION !== 'false',
    enableAutoResolution: process.env.ERROR_AUTO_RESOLUTION === 'true',
    enableAnomalyDetection: process.env.ERROR_ANOMALY_DETECTION === 'true',
    enablePredictiveAnalysis: process.env.ERROR_PREDICTIVE === 'true',
  },
};

/**
 * Helper function to get retention days for a specific entity
 */
export function getRetentionDays(entity: keyof ErrorTrackingRetentionPolicy): number {
  return ERROR_TRACKING_CONFIG.retention[entity].days;
}

/**
 * Helper function to check if a field should be excluded
 */
export function shouldExcludeField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return ERROR_TRACKING_CONFIG.privacy.excludeFields.some(
    excluded => lowerFieldName.includes(excluded.toLowerCase())
  );
}

/**
 * Helper function to get IP address handling strategy
 */
export function getIPHandlingStrategy(): string {
  return ERROR_TRACKING_CONFIG.privacy.ipAddressHandling;
}

export default ERROR_TRACKING_CONFIG;