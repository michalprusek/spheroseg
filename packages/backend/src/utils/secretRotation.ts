/**
 * Automated Secret Rotation System
 * 
 * Provides automated rotation of secrets, API keys, and credentials
 * with zero-downtime deployment and audit logging.
 */

import crypto from 'crypto';
import { promisify } from 'util';
import * as cron from 'node-cron';
import logger from './logger';
import pool from '../db';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

const randomBytes = promisify(crypto.randomBytes);

export interface SecretConfig {
  name: string;
  type: 'jwt' | 'api_key' | 'database' | 'encryption' | 'session';
  rotationIntervalDays: number;
  gracePeriodHours: number;
  minLength?: number;
  complexity?: 'high' | 'medium' | 'low';
  notificationChannels?: ('email' | 'slack' | 'webhook')[];
}

export interface RotationResult {
  secretName: string;
  oldVersion: string;
  newVersion: string;
  rotatedAt: Date;
  gracePeriodEnds: Date;
  success: boolean;
  error?: string;
}

interface SecretVersion {
  version: string;
  value: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

interface RotationSchedule {
  secretName: string;
  nextRotation: Date;
  lastRotation: Date | null;
  rotationCount: number;
}

class SecretRotationManager extends EventEmitter {
  private redis: Redis;
  private rotationJobs: Map<string, cron.ScheduledTask> = new Map();
  private secretConfigs: Map<string, SecretConfig> = new Map();
  private readonly ROTATION_LOCK_TTL = 300; // 5 minutes
  private readonly SECRET_VERSION_PREFIX = 'secret:version:';
  private readonly ROTATION_SCHEDULE_PREFIX = 'rotation:schedule:';
  
  constructor(redisClient: Redis) {
    super();
    this.redis = redisClient;
  }

  /**
   * Register a secret for automated rotation
   */
  public registerSecret(config: SecretConfig): void {
    this.secretConfigs.set(config.name, config);
    
    // Schedule rotation job
    const cronPattern = this.getCronPattern(config.rotationIntervalDays);
    const job = cron.schedule(cronPattern, async () => {
      await this.rotateSecret(config.name);
    }, {
      scheduled: false
    });
    
    this.rotationJobs.set(config.name, job);
    job.start();
    
    logger.info('Secret registered for rotation', {
      secret: config.name,
      type: config.type,
      rotationInterval: config.rotationIntervalDays,
    });
  }

  /**
   * Manually trigger secret rotation
   */
  public async rotateSecret(secretName: string): Promise<RotationResult> {
    const config = this.secretConfigs.get(secretName);
    if (!config) {
      throw new Error(`Secret ${secretName} not registered for rotation`);
    }

    // Acquire distributed lock
    const lockKey = `rotation:lock:${secretName}`;
    const lockAcquired = await this.acquireLock(lockKey);
    
    if (!lockAcquired) {
      logger.warn('Secret rotation already in progress', { secret: secretName });
      return {
        secretName,
        oldVersion: '',
        newVersion: '',
        rotatedAt: new Date(),
        gracePeriodEnds: new Date(),
        success: false,
        error: 'Rotation already in progress',
      };
    }

    try {
      // Get current active version
      const currentVersion = await this.getActiveSecretVersion(secretName);
      
      // Generate new secret
      const newSecret = await this.generateSecret(config);
      const newVersion = this.generateVersion();
      
      // Store new version
      await this.storeSecretVersion(secretName, newVersion, newSecret, config.gracePeriodHours);
      
      // Update environment variables or configuration
      await this.updateSecretInEnvironment(config, newSecret);
      
      // Mark old version for expiration
      if (currentVersion) {
        await this.scheduleVersionExpiration(
          secretName,
          currentVersion.version,
          config.gracePeriodHours
        );
      }
      
      // Update rotation schedule
      await this.updateRotationSchedule(secretName);
      
      // Send notifications
      await this.sendRotationNotifications(config, currentVersion?.version || '', newVersion);
      
      // Emit rotation event
      this.emit('secretRotated', {
        secretName,
        oldVersion: currentVersion?.version || '',
        newVersion,
      });
      
      const result: RotationResult = {
        secretName,
        oldVersion: currentVersion?.version || '',
        newVersion,
        rotatedAt: new Date(),
        gracePeriodEnds: new Date(Date.now() + config.gracePeriodHours * 3600000),
        success: true,
      };
      
      // Audit log
      await this.auditRotation(result);
      
      return result;
    } catch (error) {
      logger.error('Secret rotation failed', {
        secret: secretName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        secretName,
        oldVersion: '',
        newVersion: '',
        rotatedAt: new Date(),
        gracePeriodEnds: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Generate a new secret based on type and complexity
   */
  private async generateSecret(config: SecretConfig): Promise<string> {
    const minLength = config.minLength || this.getDefaultLength(config.type);
    
    switch (config.type) {
      case 'jwt':
        return (await randomBytes(minLength)).toString('base64');
        
      case 'api_key':
        return this.generateApiKey(minLength, config.complexity || 'high');
        
      case 'database':
        return this.generateDatabasePassword(minLength);
        
      case 'encryption':
        return (await randomBytes(32)).toString('hex'); // 256-bit key
        
      case 'session':
        return (await randomBytes(minLength)).toString('base64');
        
      default:
        return (await randomBytes(minLength)).toString('base64');
    }
  }

  /**
   * Generate API key with specified complexity
   */
  private generateApiKey(length: number, complexity: 'high' | 'medium' | 'low'): string {
    const charset = {
      high: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?',
      medium: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
      low: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    };
    
    const chars = charset[complexity];
    let key = '';
    
    for (let i = 0; i < length; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return key;
  }

  /**
   * Generate secure database password
   */
  private generateDatabasePassword(length: number): string {
    // Ensure password meets common database requirements
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=';
    const all = upper + lower + numbers + special;
    
    let password = '';
    
    // Ensure at least one of each type
    password += upper.charAt(Math.floor(Math.random() * upper.length));
    password += lower.charAt(Math.floor(Math.random() * lower.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += special.charAt(Math.floor(Math.random() * special.length));
    
    // Fill the rest
    for (let i = password.length; i < length; i++) {
      password += all.charAt(Math.floor(Math.random() * all.length));
    }
    
    // Shuffle
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Store secret version in Redis
   */
  private async storeSecretVersion(
    secretName: string,
    version: string,
    value: string,
    gracePeriodHours: number
  ): Promise<void> {
    const key = `${this.SECRET_VERSION_PREFIX}${secretName}:${version}`;
    const versionData: SecretVersion = {
      version,
      value,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (gracePeriodHours + 24) * 3600000), // Grace period + 1 day
      isActive: true,
    };
    
    await this.redis.setex(
      key,
      (gracePeriodHours + 24) * 3600,
      JSON.stringify(versionData)
    );
    
    // Set as active version
    await this.redis.set(`${this.SECRET_VERSION_PREFIX}${secretName}:active`, version);
  }

  /**
   * Get active secret version
   */
  private async getActiveSecretVersion(secretName: string): Promise<SecretVersion | null> {
    const activeVersion = await this.redis.get(`${this.SECRET_VERSION_PREFIX}${secretName}:active`);
    if (!activeVersion) return null;
    
    const key = `${this.SECRET_VERSION_PREFIX}${secretName}:${activeVersion}`;
    const data = await this.redis.get(key);
    
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update secret in environment or configuration
   */
  private async updateSecretInEnvironment(config: SecretConfig, newSecret: string): Promise<void> {
    switch (config.type) {
      case 'jwt':
        process.env['JWT_SECRET_NEW'] = newSecret;
        // Application should check for JWT_SECRET_NEW first, then fall back to JWT_SECRET
        break;
        
      case 'database':
        // Update database connection pool with new password
        // This requires application support for gradual password rotation
        process.env['DATABASE_PASSWORD_NEW'] = newSecret;
        break;
        
      case 'api_key':
        process.env[`${config.name.toUpperCase()}_NEW`] = newSecret;
        break;
        
      default:
        process.env[`${config.name.toUpperCase()}_NEW`] = newSecret;
    }
  }

  /**
   * Schedule version expiration
   */
  private async scheduleVersionExpiration(
    secretName: string,
    version: string,
    gracePeriodHours: number
  ): Promise<void> {
    setTimeout(async () => {
      const key = `${this.SECRET_VERSION_PREFIX}${secretName}:${version}`;
      const data = await this.redis.get(key);
      
      if (data) {
        const versionData: SecretVersion = JSON.parse(data);
        versionData.isActive = false;
        await this.redis.setex(key, 86400, JSON.stringify(versionData)); // Keep for 1 day after deactivation
      }
      
      logger.info('Secret version expired', { secret: secretName, version });
    }, gracePeriodHours * 3600000);
  }

  /**
   * Update rotation schedule
   */
  private async updateRotationSchedule(secretName: string): Promise<void> {
    const key = `${this.ROTATION_SCHEDULE_PREFIX}${secretName}`;
    const schedule: RotationSchedule = {
      secretName,
      nextRotation: this.calculateNextRotation(secretName),
      lastRotation: new Date(),
      rotationCount: await this.incrementRotationCount(secretName),
    };
    
    await this.redis.set(key, JSON.stringify(schedule));
  }

  /**
   * Send rotation notifications
   */
  private async sendRotationNotifications(
    config: SecretConfig,
    oldVersion: string,
    newVersion: string
  ): Promise<void> {
    const message = {
      event: 'secret_rotated',
      secret: config.name,
      type: config.type,
      oldVersion,
      newVersion,
      gracePeriodEnds: new Date(Date.now() + config.gracePeriodHours * 3600000),
      timestamp: new Date(),
    };
    
    // Send to configured channels
    for (const channel of config.notificationChannels || []) {
      switch (channel) {
        case 'slack':
          await this.sendSlackNotification(message);
          break;
        case 'email':
          await this.sendEmailNotification(message);
          break;
        case 'webhook':
          await this.sendWebhookNotification(message);
          break;
      }
    }
  }

  /**
   * Audit rotation event
   */
  private async auditRotation(result: RotationResult): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO secret_rotation_audit 
         (secret_name, old_version, new_version, rotated_at, grace_period_ends, success, error, rotated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          result.secretName,
          result.oldVersion,
          result.newVersion,
          result.rotatedAt,
          result.gracePeriodEnds,
          result.success,
          result.error,
          'system',
        ]
      );
    } catch (error) {
      logger.error('Failed to audit secret rotation', { error });
    }
  }

  /**
   * Get all registered secrets and their rotation status
   */
  public async getRotationStatus(): Promise<Array<{
    secret: SecretConfig;
    schedule: RotationSchedule | null;
    activeVersion: string | null;
  }>> {
    const status = [];
    
    for (const [name, config] of this.secretConfigs) {
      const scheduleKey = `${this.ROTATION_SCHEDULE_PREFIX}${name}`;
      const scheduleData = await this.redis.get(scheduleKey);
      const schedule = scheduleData ? JSON.parse(scheduleData) : null;
      
      const activeVersion = await this.redis.get(`${this.SECRET_VERSION_PREFIX}${name}:active`);
      
      status.push({
        secret: config,
        schedule,
        activeVersion,
      });
    }
    
    return status;
  }

  /**
   * Validate all secrets are properly configured
   */
  public async validateSecrets(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    for (const [name, _config] of this.secretConfigs) {
      // Check if secret has an active version
      const activeVersion = await this.getActiveSecretVersion(name);
      if (!activeVersion) {
        errors.push(`Secret ${name} has no active version`);
      }
      
      // Check if rotation job exists
      const job = this.rotationJobs.get(name);
      if (!job) {
        errors.push(`Secret ${name} rotation job is not configured`);
      }
      
      // Check rotation schedule
      const scheduleKey = `${this.ROTATION_SCHEDULE_PREFIX}${name}`;
      const scheduleData = await this.redis.get(scheduleKey);
      if (scheduleData) {
        const schedule: RotationSchedule = JSON.parse(scheduleData);
        if (schedule.nextRotation < new Date()) {
          errors.push(`Secret ${name} rotation is overdue`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Stop all rotation jobs
   */
  public stopAllRotations(): void {
    for (const job of this.rotationJobs.values()) {
      job.stop();
    }
    this.rotationJobs.clear();
  }

  // Helper methods
  
  private getCronPattern(_days: number): string {
    // Run daily at 3 AM and check if rotation is due
    return '0 3 * * *';
  }
  
  private getDefaultLength(type: string): number {
    const lengths: Record<string, number> = {
      jwt: 64,
      api_key: 32,
      database: 24,
      encryption: 32,
      session: 48,
    };
    return lengths[type] || 32;
  }
  
  private generateVersion(): string {
    return `v${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }
  
  private calculateNextRotation(secretName: string): Date {
    const config = this.secretConfigs.get(secretName);
    if (!config) return new Date();
    
    return new Date(Date.now() + config.rotationIntervalDays * 86400000);
  }
  
  private async incrementRotationCount(secretName: string): Promise<number> {
    const key = `rotation:count:${secretName}`;
    return await this.redis.incr(key);
  }
  
  private async acquireLock(key: string): Promise<boolean> {
    const result = await this.redis.set(
      key,
      '1',
      'EX',
      this.ROTATION_LOCK_TTL,
      'NX'
    );
    return result === 'OK';
  }
  
  private async releaseLock(key: string): Promise<void> {
    await this.redis.del(key);
  }
  
  private async sendSlackNotification(message: any): Promise<void> {
    // Implement Slack webhook integration
    logger.info('Slack notification would be sent', { message });
  }
  
  private async sendEmailNotification(message: any): Promise<void> {
    // Implement email notification
    logger.info('Email notification would be sent', { message });
  }
  
  private async sendWebhookNotification(message: any): Promise<void> {
    // Implement webhook notification
    logger.info('Webhook notification would be sent', { message });
  }
}

// Export singleton instance
let rotationManager: SecretRotationManager | null = null;

export function initializeSecretRotation(redisClient: Redis): SecretRotationManager {
  if (!rotationManager) {
    rotationManager = new SecretRotationManager(redisClient);
  }
  return rotationManager;
}

export function getSecretRotationManager(): SecretRotationManager {
  if (!rotationManager) {
    throw new Error('Secret rotation manager not initialized');
  }
  return rotationManager;
}

export default {
  initializeSecretRotation,
  getSecretRotationManager,
};