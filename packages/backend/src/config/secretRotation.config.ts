/**
 * Secret Rotation Configuration
 * 
 * Defines rotation policies for all application secrets
 */

import { SecretConfig } from '../utils/secretRotation';

export const secretRotationConfig: SecretConfig[] = [
  {
    name: 'JWT_SECRET',
    type: 'jwt',
    rotationIntervalDays: parseInt(process.env['JWT_ROTATION_DAYS'] || '30', 10),
    gracePeriodHours: parseInt(process.env['JWT_GRACE_PERIOD_HOURS'] || '24', 10),
    minLength: 64,
    complexity: 'high',
    notificationChannels: ['email', 'slack'],
  },
  {
    name: 'JWT_REFRESH_SECRET',
    type: 'jwt',
    rotationIntervalDays: parseInt(process.env['JWT_REFRESH_ROTATION_DAYS'] || '90', 10),
    gracePeriodHours: parseInt(process.env['JWT_REFRESH_GRACE_PERIOD_HOURS'] || '48', 10),
    minLength: 64,
    complexity: 'high',
    notificationChannels: ['email', 'slack'],
  },
  {
    name: 'SESSION_SECRET',
    type: 'session',
    rotationIntervalDays: parseInt(process.env['SESSION_ROTATION_DAYS'] || '30', 10),
    gracePeriodHours: parseInt(process.env['SESSION_GRACE_PERIOD_HOURS'] || '24', 10),
    minLength: 48,
    complexity: 'high',
    notificationChannels: ['email'],
  },
  {
    name: 'DATABASE_PASSWORD',
    type: 'database',
    rotationIntervalDays: parseInt(process.env['DB_PASSWORD_ROTATION_DAYS'] || '90', 10),
    gracePeriodHours: parseInt(process.env['DB_PASSWORD_GRACE_PERIOD_HOURS'] || '72', 10),
    minLength: 24,
    complexity: 'high',
    notificationChannels: ['email', 'slack', 'webhook'],
  },
  {
    name: 'ENCRYPTION_KEY',
    type: 'encryption',
    rotationIntervalDays: parseInt(process.env['ENCRYPTION_KEY_ROTATION_DAYS'] || '180', 10),
    gracePeriodHours: parseInt(process.env['ENCRYPTION_KEY_GRACE_PERIOD_HOURS'] || '168', 10), // 1 week
    minLength: 32,
    complexity: 'high',
    notificationChannels: ['email', 'slack'],
  },
  {
    name: 'API_KEY_INTERNAL',
    type: 'api_key',
    rotationIntervalDays: parseInt(process.env['API_KEY_ROTATION_DAYS'] || '60', 10),
    gracePeriodHours: parseInt(process.env['API_KEY_GRACE_PERIOD_HOURS'] || '48', 10),
    minLength: 32,
    complexity: 'medium',
    notificationChannels: ['email'],
  },
];

// Rotation policies
export const rotationPolicies = {
  // Minimum rotation intervals (days) by secret type
  minimumIntervals: {
    jwt: 30,
    api_key: 30,
    database: 60,
    encryption: 90,
    session: 30,
  },
  
  // Maximum rotation intervals (days) by secret type
  maximumIntervals: {
    jwt: 90,
    api_key: 180,
    database: 365,
    encryption: 365,
    session: 90,
  },
  
  // Minimum grace periods (hours) by secret type
  minimumGracePeriods: {
    jwt: 12,
    api_key: 24,
    database: 48,
    encryption: 72,
    session: 12,
  },
  
  // Emergency rotation trigger conditions
  emergencyRotationTriggers: {
    suspiciousActivity: true,
    securityBreach: true,
    employeeDeparture: true,
    compromisedSecret: true,
    auditFailure: true,
  },
  
  // Notification settings
  notifications: {
    preRotationWarningHours: 48, // Warn 48 hours before rotation
    postRotationReminderHours: 24, // Remind to update systems 24 hours after
    escalationAfterHours: 72, // Escalate if not acknowledged after 72 hours
  },
};

// Validate configuration
export function validateRotationConfig(configs: SecretConfig[]): string[] {
  const errors: string[] = [];
  
  for (const config of configs) {
    const minInterval = rotationPolicies.minimumIntervals[config.type];
    const maxInterval = rotationPolicies.maximumIntervals[config.type];
    const minGrace = rotationPolicies.minimumGracePeriods[config.type];
    
    if (config.rotationIntervalDays < minInterval) {
      errors.push(
        `${config.name}: Rotation interval ${config.rotationIntervalDays} days is less than minimum ${minInterval} days for type ${config.type}`
      );
    }
    
    if (config.rotationIntervalDays > maxInterval) {
      errors.push(
        `${config.name}: Rotation interval ${config.rotationIntervalDays} days exceeds maximum ${maxInterval} days for type ${config.type}`
      );
    }
    
    if (config.gracePeriodHours < minGrace) {
      errors.push(
        `${config.name}: Grace period ${config.gracePeriodHours} hours is less than minimum ${minGrace} hours for type ${config.type}`
      );
    }
  }
  
  return errors;
}

// Get rotation configuration with validation
export function getValidatedRotationConfig(): SecretConfig[] {
  const errors = validateRotationConfig(secretRotationConfig);
  
  if (errors.length > 0) {
    throw new Error(`Invalid rotation configuration:\n${errors.join('\n')}`);
  }
  
  return secretRotationConfig;
}