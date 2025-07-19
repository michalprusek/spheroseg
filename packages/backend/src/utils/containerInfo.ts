/**
 * Container information utilities
 * Detects container limits and environment
 */

import fs from 'fs';
import { totalmem } from 'os';
import logger from './logger';

interface ContainerLimits {
  memoryLimitBytes: number | null;
  memoryLimitMB: number | null;
  isContainerized: boolean;
}

/**
 * Detect if running in a container and get memory limits
 */
export function getContainerLimits(): ContainerLimits {
  const result: ContainerLimits = {
    memoryLimitBytes: null,
    memoryLimitMB: null,
    isContainerized: false,
  };

  // Check if running in Docker/container
  try {
    // Docker creates .dockerenv file
    if (fs.existsSync('/.dockerenv')) {
      result.isContainerized = true;
    }

    // Also check for container-specific cgroup files
    if (fs.existsSync('/proc/self/cgroup')) {
      const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf8');
      if (cgroup.includes('docker') || cgroup.includes('kubepods')) {
        result.isContainerized = true;
      }
    }
  } catch (error) {
    logger.debug('Could not detect container environment:', error);
  }

  // Get memory limits from cgroup v1
  try {
    const cgroupV1Path = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
    if (fs.existsSync(cgroupV1Path)) {
      const limitStr = fs.readFileSync(cgroupV1Path, 'utf8').trim();
      const limitBytes = parseInt(limitStr, 10);

      // Check if limit is not the default "unlimited" value
      if (limitBytes < Number.MAX_SAFE_INTEGER) {
        result.memoryLimitBytes = limitBytes;
        result.memoryLimitMB = Math.floor(limitBytes / (1024 * 1024));
        logger.debug(`Detected cgroup v1 memory limit: ${result.memoryLimitMB}MB`);
        return result;
      }
    }
  } catch (error) {
    logger.debug('Could not read cgroup v1 memory limit:', error);
  }

  // Get memory limits from cgroup v2
  try {
    const cgroupV2Path = '/sys/fs/cgroup/memory.max';
    if (fs.existsSync(cgroupV2Path)) {
      const limitStr = fs.readFileSync(cgroupV2Path, 'utf8').trim();

      if (limitStr !== 'max') {
        const limitBytes = parseInt(limitStr, 10);
        result.memoryLimitBytes = limitBytes;
        result.memoryLimitMB = Math.floor(limitBytes / (1024 * 1024));
        logger.debug(`Detected cgroup v2 memory limit: ${result.memoryLimitMB}MB`);
        return result;
      }
    }
  } catch (error) {
    logger.debug('Could not read cgroup v2 memory limit:', error);
  }

  // Docker Desktop on macOS/Windows may not expose cgroup limits
  // Check for Docker-specific environment variables
  if (process.env["CONTAINER_MEMORY_LIMIT_MB"]) {
    result.memoryLimitMB = parseInt(process.env["CONTAINER_MEMORY_LIMIT_MB"], 10);
    result.memoryLimitBytes = result.memoryLimitMB * 1024 * 1024;
    logger.debug(`Using environment variable memory limit: ${result.memoryLimitMB}MB`);
    return result;
  }

  // If no container limits detected, return null (will fall back to config)
  logger.debug('No container memory limits detected, using configuration defaults');
  return result;
}

/**
 * Get effective memory limit for the application
 */
export function getEffectiveMemoryLimit(defaultLimitMB: number): number {
  const containerLimits = getContainerLimits();

  if (containerLimits.memoryLimitMB) {
    logger.info(`Using detected container memory limit: ${containerLimits.memoryLimitMB}MB`);
    return containerLimits.memoryLimitMB;
  }

  logger.info(`Using default memory limit: ${defaultLimitMB}MB`);
  return defaultLimitMB;
}

/**
 * Get container information including memory usage
 */
export async function getContainerInfo(): Promise<{
  isContainer: boolean;
  memoryLimit: number;
  memoryUsage: number;
  memoryUsagePercentage: number;
}> {
  const containerLimits = getContainerLimits();

  // Get current memory usage
  const memUsage = process.memoryUsage();
  const currentUsage = memUsage.rss; // Resident Set Size

  // Default to OS total memory if not in container
  const memoryLimit = containerLimits.memoryLimitBytes || totalmem();

  return {
    isContainer: containerLimits.isContainerized,
    memoryLimit,
    memoryUsage: currentUsage,
    memoryUsagePercentage: (currentUsage / memoryLimit) * 100,
  };
}
