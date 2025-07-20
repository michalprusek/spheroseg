/**
 * Tests for container information utilities
 */

import { jest } from '@jest/globals';

// Mock logger first
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  http: jest.fn(),
  silly: jest.fn(),
};

jest.mock('../logger', () => ({
  __esModule: true,
  default: mockLogger,
  createLogger: jest.fn().mockReturnValue(mockLogger),
}));

// Mock fs module
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

// Mock os module
jest.mock('os', () => ({
  totalmem: jest.fn(() => 8589934592), // 8GB
}));

describe('Container Info Utilities', () => {
  let getContainerLimits: any;
  let getEffectiveMemoryLimit: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env['CONTAINER_MEMORY_LIMIT_MB'];

    // Reset mocks
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Import functions after mocking
    const containerInfo = await import('../containerInfo');
    getContainerLimits = containerInfo.getContainerLimits;
    getEffectiveMemoryLimit = containerInfo.getEffectiveMemoryLimit;
  });

  describe('getContainerLimits', () => {
    it('should detect Docker environment', () => {
      mockExistsSync.mockImplementation((path) => {
        return path === '/.dockerenv';
      });

      const result = getContainerLimits();
      expect(result.isContainerized).toBe(true);
    });

    it('should detect container from cgroup', () => {
      mockExistsSync.mockImplementation((path) => {
        return path === '/proc/self/cgroup';
      });
      mockReadFileSync.mockReturnValue('1:name=systemd:/docker/abc123');

      const result = getContainerLimits();
      expect(result.isContainerized).toBe(true);
    });

    it('should read cgroup v1 memory limit', () => {
      const limitBytes = 536870912; // 512MB
      mockExistsSync.mockImplementation((path) => {
        if (path === '/.dockerenv') return false;
        if (path === '/proc/self/cgroup') return false;
        if (path === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(limitBytes.toString());

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBe(limitBytes);
      expect(result.memoryLimitMB).toBe(512);
    });

    it('should ignore unlimited cgroup v1 value', () => {
      const unlimitedValue = 9223372036854775807;
      mockExistsSync.mockImplementation((path) => {
        return path === '/sys/fs/cgroup/memory/memory.limit_in_bytes';
      });
      mockReadFileSync.mockReturnValue(unlimitedValue.toString());

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBeNull();
      expect(result.memoryLimitMB).toBeNull();
    });

    it('should read cgroup v2 memory limit', () => {
      const limitBytes = 1073741824; // 1GB
      mockExistsSync.mockImplementation((path) => {
        if (path === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return false;
        if (path === '/sys/fs/cgroup/memory.max') return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(limitBytes.toString());

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBe(limitBytes);
      expect(result.memoryLimitMB).toBe(1024);
    });

    it('should ignore max value in cgroup v2', () => {
      mockExistsSync.mockImplementation((path) => {
        return path === '/sys/fs/cgroup/memory.max';
      });
      mockReadFileSync.mockReturnValue('max');

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBeNull();
      expect(result.memoryLimitMB).toBeNull();
    });

    it('should use environment variable as fallback', () => {
      process.env['CONTAINER_MEMORY_LIMIT_MB'] = '2048';
      mockExistsSync.mockReturnValue(false);

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBe(2147483648); // 2GB in bytes
      expect(result.memoryLimitMB).toBe(2048);
    });

    it('should handle file system errors gracefully', () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBeNull();
      expect(result.memoryLimitMB).toBeNull();
      expect(result.isContainerized).toBe(false);
    });
  });

  describe('getEffectiveMemoryLimit', () => {
    it('should use detected container limit', () => {
      mockExistsSync.mockImplementation((path) => {
        return path === '/sys/fs/cgroup/memory/memory.limit_in_bytes';
      });
      mockReadFileSync.mockReturnValue('536870912'); // 512MB

      const result = getEffectiveMemoryLimit();
      expect(result).toBe(512);
    });

    it('should use default limit when no container limit detected', () => {
      mockExistsSync.mockReturnValue(false);

      const result = getEffectiveMemoryLimit();
      expect(result).toBe(512); // Default limit
    });

    it('should prefer detected limit over default', () => {
      mockExistsSync.mockImplementation((path) => {
        return path === '/sys/fs/cgroup/memory/memory.limit_in_bytes';
      });
      mockReadFileSync.mockReturnValue('1073741824'); // 1GB

      const result = getEffectiveMemoryLimit(2048); // 2GB default
      expect(result).toBe(1024); // Should use detected 1GB instead of 2GB default
    });
  });
});