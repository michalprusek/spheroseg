/**
 * Secret Rotation Startup Module
 * 
 * Initializes automated secret rotation on application startup
 */

import { Redis } from 'ioredis';
import { initializeSecretRotation } from '../utils/secretRotation';
import { getValidatedRotationConfig } from '../config/secretRotation.config';
import logger from '../utils/logger';

export async function initializeSecretRotationOnStartup(redisClient: Redis): Promise<void> {
  try {
    logger.info('Initializing secret rotation system...');
    
    // Initialize rotation manager
    const rotationManager = initializeSecretRotation(redisClient);
    
    // Register all secrets from configuration
    const configs = getValidatedRotationConfig();
    
    for (const config of configs) {
      rotationManager.registerSecret(config);
      logger.info(`Registered secret for rotation: ${config.name}`, {
        type: config.type,
        rotationInterval: config.rotationIntervalDays,
      });
    }
    
    // Validate all secrets on startup
    const validation = await rotationManager.validateSecrets();
    
    if (!validation.valid) {
      logger.error('Secret rotation validation failed', { errors: validation.errors });
      
      // In production, this should be a critical error
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error(`Secret rotation validation failed: ${validation.errors.join(', ')}`);
      }
    } else {
      logger.info('Secret rotation system initialized successfully', {
        secretCount: configs.length,
      });
    }
    
    // Set up graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('Stopping secret rotation jobs...');
      rotationManager.stopAllRotations();
    });
    
    process.on('SIGINT', () => {
      logger.info('Stopping secret rotation jobs...');
      rotationManager.stopAllRotations();
    });
    
  } catch (error) {
    logger.error('Failed to initialize secret rotation', { error });
    
    // In production, this should prevent startup
    if (process.env['NODE_ENV'] === 'production') {
      throw error;
    }
  }
}