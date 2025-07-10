/**
 * Tests for container information utilities
 */

jest.mock('../logger');

// Manual mocks for fs module
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  mkdirSync: jest.fn(),
}));

import { getContainerLimits, getEffectiveMemoryLimit } from '../containerInfo';
import logger from '../logger';

describe('Container Info Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CONTAINER_MEMORY_LIMIT_MB;
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
      mockExistsSync.mockImplementation((path) => {
        if (path === '/.dockerenv') return false;
        if (path === '/proc/self/cgroup') return false;
        if (path === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return true;
        return false;
      });
      mockReadFileSync.mockReturnValue('9223372036854775807');

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBeNull();
      expect(result.memoryLimitMB).toBeNull();
    });

    it('should read cgroup v2 memory limit', () => {
      const limitBytes = 1073741824; // 1GB
      mockExistsSync.mockImplementation((path) => {
        if (path === '/.dockerenv') return false;
        if (path === '/proc/self/cgroup') return false;
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
        if (path === '/.dockerenv') return false;
        if (path === '/proc/self/cgroup') return false;
        if (path === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return false;
        if (path === '/sys/fs/cgroup/memory.max') return true;
        return false;
      });
      mockReadFileSync.mockReturnValue('max');

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBeNull();
      expect(result.memoryLimitMB).toBeNull();
    });

    it('should use environment variable as fallback', () => {
      mockExistsSync.mockReturnValue(false);
      process.env.CONTAINER_MEMORY_LIMIT_MB = '256';

      const result = getContainerLimits();
      expect(result.memoryLimitMB).toBe(256);
      expect(result.memoryLimitBytes).toBe(256 * 1024 * 1024);
    });

    it('should handle file system errors gracefully', () => {
      let callCount = 0;
      mockExistsSync.mockImplementation(() => {
        callCount++;
        // Only throw error on first call to avoid infinite loop
        if (callCount === 1) {
          throw new Error('Permission denied');
        }
        return false;
      });

      const result = getContainerLimits();
      expect(result.isContainerized).toBe(false);
      expect(result.memoryLimitBytes).toBeNull();
      expect(result.memoryLimitMB).toBeNull();
    });
  });

  describe('getEffectiveMemoryLimit', () => {
    it('should use detected container limit', () => {
      mockExistsSync.mockImplementation((path) => {
        if (path === '/.dockerenv') return false;
        if (path === '/proc/self/cgroup') return false;
        if (path === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return true;
        return false;
      });
      mockReadFileSync.mockReturnValue('268435456'); // 256MB

      const limit = getEffectiveMemoryLimit(512);
      expect(limit).toBe(256);
      expect(logger.info).toHaveBeenCalledWith('Using detected container memory limit: 256MB');
    });

    it('should use default limit when no container limit detected', () => {
      mockExistsSync.mockReturnValue(false);

      const limit = getEffectiveMemoryLimit(512);
      expect(limit).toBe(512);
      expect(logger.info).toHaveBeenCalledWith('Using default memory limit: 512MB');
    });

    it('should prefer detected limit over default', () => {
      mockExistsSync.mockImplementation((path) => {
        if (path === '/.dockerenv') return false;
        if (path === '/proc/self/cgroup') return false;
        if (path === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return true;
        return false;
      });
      mockReadFileSync.mockReturnValue('1073741824'); // 1GB

      const limit = getEffectiveMemoryLimit(512);
      expect(limit).toBe(1024);
    });
  });
});
