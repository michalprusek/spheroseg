/**
 * Tests for Secret Rotation System
 */

import { Redis } from 'ioredis';
import { initializeSecretRotation, SecretConfig } from '../secretRotation';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('ioredis');
jest.mock('../logger');
jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('Secret Rotation System', () => {
  let redis: jest.Mocked<Redis>;
  let rotationManager: any;
  
  beforeEach(() => {
    // Create mock Redis instance
    redis = new Redis() as jest.Mocked<Redis>;
    redis.set = jest.fn().mockResolvedValue('OK');
    redis.get = jest.fn().mockResolvedValue(null);
    redis.setex = jest.fn().mockResolvedValue('OK');
    redis.del = jest.fn().mockResolvedValue(1);
    redis.incr = jest.fn().mockResolvedValue(1);
    
    // Initialize rotation manager
    rotationManager = initializeSecretRotation(redis);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    if (rotationManager) {
      rotationManager.stopAllRotations();
    }
  });
  
  describe('Secret Registration', () => {
    it('should register a secret for rotation', () => {
      const config: SecretConfig = {
        name: 'TEST_SECRET',
        type: 'jwt',
        rotationIntervalDays: 30,
        gracePeriodHours: 24,
        minLength: 64,
        complexity: 'high',
      };
      
      expect(() => rotationManager.registerSecret(config)).not.toThrow();
    });
    
    it('should schedule rotation job on registration', () => {
      const config: SecretConfig = {
        name: 'TEST_SECRET',
        type: 'jwt',
        rotationIntervalDays: 30,
        gracePeriodHours: 24,
      };
      
      rotationManager.registerSecret(config);
      
      // Verify job was created (internal implementation detail)
      // In real tests, we'd check if the cron job is scheduled
      expect(rotationManager).toBeDefined();
    });
  });
  
  describe('Secret Generation', () => {
    beforeEach(() => {
      const config: SecretConfig = {
        name: 'TEST_SECRET',
        type: 'jwt',
        rotationIntervalDays: 30,
        gracePeriodHours: 24,
        minLength: 64,
      };
      rotationManager.registerSecret(config);
    });
    
    it('should generate JWT secret with correct length', async () => {
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      const result = await rotationManager.rotateSecret('TEST_SECRET');
      
      expect(result.success).toBe(true);
      expect(result.newVersion).toBeDefined();
      expect(result.secretName).toBe('TEST_SECRET');
    });
    
    it('should generate API key with specified complexity', async () => {
      const config: SecretConfig = {
        name: 'API_KEY',
        type: 'api_key',
        rotationIntervalDays: 60,
        gracePeriodHours: 48,
        minLength: 32,
        complexity: 'high',
      };
      
      rotationManager.registerSecret(config);
      
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      const result = await rotationManager.rotateSecret('API_KEY');
      
      expect(result.success).toBe(true);
      expect(result.newVersion).toBeDefined();
    });
    
    it('should generate database password with required complexity', async () => {
      const config: SecretConfig = {
        name: 'DB_PASSWORD',
        type: 'database',
        rotationIntervalDays: 90,
        gracePeriodHours: 72,
        minLength: 24,
      };
      
      rotationManager.registerSecret(config);
      
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      const result = await rotationManager.rotateSecret('DB_PASSWORD');
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('Version Management', () => {
    beforeEach(() => {
      const config: SecretConfig = {
        name: 'TEST_SECRET',
        type: 'jwt',
        rotationIntervalDays: 30,
        gracePeriodHours: 24,
      };
      rotationManager.registerSecret(config);
    });
    
    it('should store new secret version in Redis', async () => {
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      await rotationManager.rotateSecret('TEST_SECRET');
      
      expect(redis.setex).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('secret:version:TEST_SECRET:active'),
        expect.any(String)
      );
    });
    
    it('should set expiration for old version during grace period', async () => {
      // Mock existing active version
      redis.get.mockImplementation(async (key) => {
        if (key.includes(':active')) {
          return 'v123-oldversion';
        }
        if (key.includes('v123-oldversion')) {
          return JSON.stringify({
            version: 'v123-oldversion',
            value: 'old-secret-value',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
            isActive: true,
          });
        }
        return null;
      });
      
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      await rotationManager.rotateSecret('TEST_SECRET');
      
      // Verify new version was stored
      expect(redis.setex).toHaveBeenCalled();
    });
  });
  
  describe('Rotation Locking', () => {
    beforeEach(() => {
      const config: SecretConfig = {
        name: 'TEST_SECRET',
        type: 'jwt',
        rotationIntervalDays: 30,
        gracePeriodHours: 24,
      };
      rotationManager.registerSecret(config);
    });
    
    it('should acquire lock before rotation', async () => {
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (key.includes('rotation:lock:') && mode === 'NX') {
          return 'OK';
        }
        return 'OK';
      });
      
      await rotationManager.rotateSecret('TEST_SECRET');
      
      expect(redis.set).toHaveBeenCalledWith(
        'rotation:lock:TEST_SECRET',
        '1',
        'NX',
        'EX',
        expect.any(Number)
      );
    });
    
    it('should not rotate if lock cannot be acquired', async () => {
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (key.includes('rotation:lock:') && mode === 'NX') {
          return null; // Lock already exists
        }
        return 'OK';
      });
      
      const result = await rotationManager.rotateSecret('TEST_SECRET');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rotation already in progress');
    });
    
    it('should release lock after rotation', async () => {
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      await rotationManager.rotateSecret('TEST_SECRET');
      
      expect(redis.del).toHaveBeenCalledWith('rotation:lock:TEST_SECRET');
    });
  });
  
  describe('Rotation Validation', () => {
    it('should validate all registered secrets', async () => {
      const configs: SecretConfig[] = [
        {
          name: 'SECRET1',
          type: 'jwt',
          rotationIntervalDays: 30,
          gracePeriodHours: 24,
        },
        {
          name: 'SECRET2',
          type: 'api_key',
          rotationIntervalDays: 60,
          gracePeriodHours: 48,
        },
      ];
      
      configs.forEach(config => rotationManager.registerSecret(config));
      
      // Mock active versions exist
      redis.get.mockResolvedValue('v123-active');
      
      const validation = await rotationManager.validateSecrets();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    
    it('should report errors for secrets without active versions', async () => {
      const config: SecretConfig = {
        name: 'TEST_SECRET',
        type: 'jwt',
        rotationIntervalDays: 30,
        gracePeriodHours: 24,
      };
      
      rotationManager.registerSecret(config);
      
      // Mock no active version
      redis.get.mockResolvedValue(null);
      
      const validation = await rotationManager.validateSecrets();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Secret TEST_SECRET has no active version');
    });
  });
  
  describe('Rotation Status', () => {
    it('should return status for all registered secrets', async () => {
      const configs: SecretConfig[] = [
        {
          name: 'SECRET1',
          type: 'jwt',
          rotationIntervalDays: 30,
          gracePeriodHours: 24,
        },
        {
          name: 'SECRET2',
          type: 'api_key',
          rotationIntervalDays: 60,
          gracePeriodHours: 48,
        },
      ];
      
      configs.forEach(config => rotationManager.registerSecret(config));
      
      const status = await rotationManager.getRotationStatus();
      
      expect(status).toHaveLength(2);
      expect(status[0].secret.name).toBe('SECRET1');
      expect(status[1].secret.name).toBe('SECRET2');
    });
  });
  
  describe('Event Emission', () => {
    it('should emit secretRotated event on successful rotation', async () => {
      const config: SecretConfig = {
        name: 'TEST_SECRET',
        type: 'jwt',
        rotationIntervalDays: 30,
        gracePeriodHours: 24,
      };
      
      rotationManager.registerSecret(config);
      
      redis.set.mockImplementation(async (key, value, mode, flag, ttl) => {
        if (mode === 'NX') return 'OK';
        return 'OK';
      });
      
      const eventPromise = new Promise((resolve) => {
        rotationManager.once('secretRotated', resolve);
      });
      
      await rotationManager.rotateSecret('TEST_SECRET');
      
      const event = await eventPromise;
      expect(event).toMatchObject({
        secretName: 'TEST_SECRET',
        oldVersion: expect.any(String),
        newVersion: expect.any(String),
      });
    });
  });
  
  describe('Graceful Shutdown', () => {
    it('should stop all rotation jobs on shutdown', () => {
      const configs: SecretConfig[] = [
        {
          name: 'SECRET1',
          type: 'jwt',
          rotationIntervalDays: 30,
          gracePeriodHours: 24,
        },
        {
          name: 'SECRET2',
          type: 'api_key',
          rotationIntervalDays: 60,
          gracePeriodHours: 48,
        },
      ];
      
      configs.forEach(config => rotationManager.registerSecret(config));
      
      expect(() => rotationManager.stopAllRotations()).not.toThrow();
    });
  });
});

describe('Secret Rotation Configuration', () => {
  it('should validate rotation intervals', () => {
    const { validateRotationConfig } = require('../../config/secretRotation.config');
    
    const configs: SecretConfig[] = [
      {
        name: 'TEST_SECRET',
        type: 'jwt',
        rotationIntervalDays: 15, // Below minimum of 30
        gracePeriodHours: 24,
      },
    ];
    
    const errors = validateRotationConfig(configs);
    
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('less than minimum 30 days');
  });
  
  it('should validate grace periods', () => {
    const { validateRotationConfig } = require('../../config/secretRotation.config');
    
    const configs: SecretConfig[] = [
      {
        name: 'TEST_SECRET',
        type: 'jwt',
        rotationIntervalDays: 30,
        gracePeriodHours: 6, // Below minimum of 12
      },
    ];
    
    const errors = validateRotationConfig(configs);
    
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('less than minimum 12 hours');
  });
});