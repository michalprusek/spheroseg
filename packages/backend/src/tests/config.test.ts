// Mock fs module to prevent directory creation
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

// Import config after mocking fs
import config from '../config';

describe('Configuration', () => {
  it('should load configuration values', () => {
    // Test server configuration
    expect(config.server).toBeDefined();
    expect(config.server.port).toBeGreaterThan(0);
    expect(config.server.host).toBeDefined();
    expect(Array.isArray(config.server.corsOrigins)).toBe(true);

    // Test database configuration
    expect(config.db).toBeDefined();
    expect(config.db.host).toBeDefined();
    expect(config.db.port).toBeGreaterThan(0);
    expect(config.db.database).toBeDefined();
    expect(config.db.user).toBeDefined();

    // Test authentication configuration
    expect(config.auth).toBeDefined();
    expect(config.auth.jwtSecret).toBeDefined();
    expect(config.auth.jwtExpiresIn).toBeDefined();
    expect(config.auth.saltRounds).toBeGreaterThan(0);

    // Test storage configuration
    expect(config.storage).toBeDefined();
    expect(config.storage.uploadDir).toBeDefined();
    expect(config.storage.maxFileSize).toBeGreaterThan(0);

    // Test segmentation configuration
    expect(config.segmentation).toBeDefined();
    expect(config.segmentation.maxConcurrentTasks).toBeGreaterThan(0);
    expect(config.segmentation.checkpointPath).toBeDefined();

    // Test logging configuration
    expect(config.logging).toBeDefined();
    expect(config.logging.level).toBeDefined();
    expect(typeof config.logging.logToFile).toBe('boolean');
    expect(config.logging.logDir).toBeDefined();
  });

  it('should have correct environment flags', () => {
    // Test environment flags
    expect(typeof config.isDevelopment).toBe('boolean');
    expect(typeof config.isProduction).toBe('boolean');
    expect(typeof config.isTest).toBe('boolean');

    // In test environment
    expect(config.env).toBe('test');
    expect(config.isTest).toBe(true);
    expect(config.isProduction).toBe(false);
  });
});
