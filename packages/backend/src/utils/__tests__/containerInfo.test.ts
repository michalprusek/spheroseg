/**
 * Tests for container information utilities
 */

import fs from 'fs';
import { getContainerLimits, getEffectiveMemoryLimit } from '../containerInfo';
import logger from '../logger';

jest.mock('fs');
jest.mock('../logger');

describe('Container Info Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CONTAINER_MEMORY_LIMIT_MB;
  });

  describe('getContainerLimits', () => {
    it('should detect Docker environment', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === '/.dockerenv';
      });

      const result = getContainerLimits();
      expect(result.isContainerized).toBe(true);
    });

    it('should detect container from cgroup', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === '/proc/self/cgroup';
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('1:name=systemd:/docker/abc123');

      const result = getContainerLimits();
      expect(result.isContainerized).toBe(true);
    });

    it('should read cgroup v1 memory limit', () => {
      const limitBytes = 536870912; // 512MB
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === '/sys/fs/cgroup/memory/memory.limit_in_bytes';
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(limitBytes.toString());

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBe(limitBytes);
      expect(result.memoryLimitMB).toBe(512);
    });

    it('should ignore unlimited cgroup v1 value', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === '/sys/fs/cgroup/memory/memory.limit_in_bytes';
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('9223372036854775807');

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBeNull();
      expect(result.memoryLimitMB).toBeNull();
    });

    it('should read cgroup v2 memory limit', () => {
      const limitBytes = 1073741824; // 1GB
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        if (path === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return false;
        return path === '/sys/fs/cgroup/memory.max';
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(limitBytes.toString());

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBe(limitBytes);
      expect(result.memoryLimitMB).toBe(1024);
    });

    it('should ignore max value in cgroup v2', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        if (path === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return false;
        return path === '/sys/fs/cgroup/memory.max';
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('max');

      const result = getContainerLimits();
      expect(result.memoryLimitBytes).toBeNull();
      expect(result.memoryLimitMB).toBeNull();
    });

    it('should use environment variable as fallback', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      process.env.CONTAINER_MEMORY_LIMIT_MB = '256';

      const result = getContainerLimits();
      expect(result.memoryLimitMB).toBe(256);
      expect(result.memoryLimitBytes).toBe(256 * 1024 * 1024);
    });

    it('should handle file system errors gracefully', () => {
      (fs.existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = getContainerLimits();
      expect(result.isContainerized).toBe(false);
      expect(result.memoryLimitBytes).toBeNull();
      expect(result.memoryLimitMB).toBeNull();
    });
  });

  describe('getEffectiveMemoryLimit', () => {
    it('should use detected container limit', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === '/sys/fs/cgroup/memory/memory.limit_in_bytes';
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('268435456'); // 256MB

      const limit = getEffectiveMemoryLimit(512);
      expect(limit).toBe(256);
      expect(logger.info).toHaveBeenCalledWith(
        'Using detected container memory limit: 256MB'
      );
    });

    it('should use default limit when no container limit detected', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const limit = getEffectiveMemoryLimit(512);
      expect(limit).toBe(512);
      expect(logger.info).toHaveBeenCalledWith(
        'Using default memory limit: 512MB'
      );
    });

    it('should prefer detected limit over default', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === '/sys/fs/cgroup/memory/memory.limit_in_bytes';
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('1073741824'); // 1GB

      const limit = getEffectiveMemoryLimit(512);
      expect(limit).toBe(1024);
    });
  });
});