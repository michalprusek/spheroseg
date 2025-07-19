import { 
  loadSecret, 
  validateJwtSecret, 
  generateSecret,
  constructDatabaseUrl,
  constructRedisUrl,
  constructRabbitmqUrl 
} from '../secretsLoader';
import fs from 'fs';
import path from 'path';

// Mock fs module
jest.mock('fs');

describe('secretsLoader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadSecret', () => {
    it('should load secret from Docker Secrets file', () => {
      const mockSecret = 'super-secret-value';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockSecret + '\n');

      const result = loadSecret('test_secret', 'TEST_SECRET');
      
      expect(result).toBe(mockSecret);
      expect(fs.existsSync).toHaveBeenCalledWith('/run/secrets/test_secret');
      expect(fs.readFileSync).toHaveBeenCalledWith('/run/secrets/test_secret', 'utf8');
    });

    it('should load secret from environment variable file path', () => {
      const mockSecret = 'env-file-secret';
      process.env.TEST_SECRET_FILE = '/custom/path/secret';
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockSecret);

      const result = loadSecret('test_secret', 'TEST_SECRET');
      
      expect(result).toBe(mockSecret);
      expect(fs.readFileSync).toHaveBeenCalledWith('/custom/path/secret', 'utf8');
    });

    it('should fall back to environment variable', () => {
      const mockSecret = 'env-var-secret';
      process.env.TEST_SECRET = mockSecret;
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = loadSecret('test_secret', 'TEST_SECRET');
      
      expect(result).toBe(mockSecret);
    });

    it('should throw error if required secret not found', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => {
        loadSecret('test_secret', 'TEST_SECRET', true);
      }).toThrow("Required secret 'test_secret' not found");
    });

    it('should return undefined if optional secret not found', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = loadSecret('test_secret', 'TEST_SECRET', false);
      
      expect(result).toBeUndefined();
    });
  });

  describe('validateJwtSecret', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should accept valid JWT secret in production', () => {
      const validSecret = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4';
      
      expect(() => validateJwtSecret(validSecret)).not.toThrow();
    });

    it('should reject short JWT secret in production', () => {
      const shortSecret = 'too-short';
      
      expect(() => validateJwtSecret(shortSecret)).toThrow(
        'JWT secret must be at least 32 characters long in production mode'
      );
    });

    it('should reject weak secrets in production', () => {
      const weakSecret = 'your-secret-key-change-in-production-now';
      
      expect(() => validateJwtSecret(weakSecret)).toThrow(
        'JWT secret contains weak or default values'
      );
    });

    it('should reject low entropy secrets in production', () => {
      const lowEntropySecret = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      
      expect(() => validateJwtSecret(lowEntropySecret)).toThrow(
        'JWT secret has low entropy'
      );
    });

    it('should accept shorter secrets in development', () => {
      process.env.NODE_ENV = 'development';
      const devSecret = '1234567890123456'; // 16 chars
      
      expect(() => validateJwtSecret(devSecret)).not.toThrow();
    });
  });

  describe('generateSecret', () => {
    it('should generate secret of specified length', () => {
      const secret = generateSecret(32);
      
      expect(secret).toHaveLength(32);
      expect(typeof secret).toBe('string');
    });

    it('should generate different secrets each time', () => {
      const secret1 = generateSecret(32);
      const secret2 = generateSecret(32);
      
      expect(secret1).not.toBe(secret2);
    });

    it('should use default length of 64', () => {
      const secret = generateSecret();
      
      expect(secret).toHaveLength(64);
    });
  });

  describe('constructDatabaseUrl', () => {
    it('should construct database URL with password', () => {
      const secrets = { 
        dbPassword: 'secretpass',
        jwtSecret: 'jwt',
        sessionSecret: null,
        dbRootPassword: null,
        redisPassword: null,
        rabbitmqPassword: null,
        emailPassword: null
      };
      const config = {
        user: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        ssl: true
      };

      const url = constructDatabaseUrl(secrets, config);
      
      expect(url).toBe('postgresql://postgres:secretpass@localhost:5432/testdb?ssl=prefer');
    });

    it('should construct database URL without SSL', () => {
      const secrets = { 
        dbPassword: 'pass',
        jwtSecret: 'jwt',
        sessionSecret: null,
        dbRootPassword: null,
        redisPassword: null,
        rabbitmqPassword: null,
        emailPassword: null
      };
      const config = {
        user: 'user',
        host: 'db',
        port: 5432,
        database: 'mydb',
        ssl: false
      };

      const url = constructDatabaseUrl(secrets, config);
      
      expect(url).toBe('postgresql://user:pass@db:5432/mydb');
    });
  });

  describe('constructRedisUrl', () => {
    it('should construct Redis URL with password', () => {
      const secrets = {
        redisPassword: 'redispass',
        jwtSecret: 'jwt',
        sessionSecret: null,
        dbPassword: null,
        dbRootPassword: null,
        rabbitmqPassword: null,
        emailPassword: null
      };
      const config = {
        host: 'redis',
        port: 6379,
        db: 0
      };

      const url = constructRedisUrl(secrets, config);
      
      expect(url).toBe('redis://:redispass@redis:6379/0');
    });

    it('should construct Redis URL without password', () => {
      const secrets = {
        redisPassword: null,
        jwtSecret: 'jwt',
        sessionSecret: null,
        dbPassword: null,
        dbRootPassword: null,
        rabbitmqPassword: null,
        emailPassword: null
      };
      const config = {
        host: 'localhost',
        port: 6379
      };

      const url = constructRedisUrl(secrets, config);
      
      expect(url).toBe('redis://localhost:6379');
    });
  });

  describe('constructRabbitmqUrl', () => {
    it('should construct RabbitMQ URL with password', () => {
      const secrets = {
        rabbitmqPassword: 'mqpass',
        jwtSecret: 'jwt',
        sessionSecret: null,
        dbPassword: null,
        dbRootPassword: null,
        redisPassword: null,
        emailPassword: null
      };
      const config = {
        user: 'admin',
        host: 'rabbitmq',
        port: 5672
      };

      const url = constructRabbitmqUrl(secrets, config);
      
      expect(url).toBe('amqp://admin:mqpass@rabbitmq:5672');
    });

    it('should use default password if not provided', () => {
      const secrets = {
        rabbitmqPassword: null,
        jwtSecret: 'jwt',
        sessionSecret: null,
        dbPassword: null,
        dbRootPassword: null,
        redisPassword: null,
        emailPassword: null
      };
      const config = {
        user: 'guest',
        host: 'localhost',
        port: 5672
      };

      const url = constructRabbitmqUrl(secrets, config);
      
      expect(url).toBe('amqp://guest:guest@localhost:5672');
    });
  });
});