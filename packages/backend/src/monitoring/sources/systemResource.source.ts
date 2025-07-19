/**
 * System Resource Monitoring Source
 * 
 * Monitors system-level resources including CPU, memory, disk I/O,
 * and network statistics with minimal performance impact.
 */

import os from 'os';
import fs from 'fs';
import { promisify } from 'util';
import logger from '../../utils/logger';
import { MonitoringSource } from '../unified/performanceCoordinator';
import { PerformanceMetric } from '../optimized/performanceOptimizer';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

interface SystemResourceConfig {
  includeDetailedCpuStats: boolean;
  includeNetworkStats: boolean;
  includeDiskStats: boolean;
  includeContainerStats: boolean;
}

class SystemResourceSource implements MonitoringSource {
  public readonly id = 'system_resource';
  public readonly name = 'System Resource Monitor';
  public readonly priority = 'critical' as const;
  public enabled = true;
  public intervalMs = 30000; // 30 seconds
  public lastCollection?: number;

  private config: SystemResourceConfig;
  private previousCpuStats: any = null;
  private previousNetworkStats: any = null;
  private previousDiskStats: any = null;

  constructor(config: Partial<SystemResourceConfig> = {}) {
    this.config = {
      includeDetailedCpuStats: true,
      includeNetworkStats: true,
      includeDiskStats: true,
      includeContainerStats: true,
      ...config,
    };
  }

  public async collectMetrics(): Promise<PerformanceMetric[]> {
    const metrics: PerformanceMetric[] = [];
    const timestamp = Date.now();

    try {
      // Basic system metrics
      await this.collectBasicMetrics(metrics, timestamp);

      // CPU metrics
      if (this.config.includeDetailedCpuStats) {
        await this.collectCpuMetrics(metrics, timestamp);
      }

      // Memory metrics
      await this.collectMemoryMetrics(metrics, timestamp);

      // Network metrics
      if (this.config.includeNetworkStats) {
        await this.collectNetworkMetrics(metrics, timestamp);
      }

      // Disk metrics
      if (this.config.includeDiskStats) {
        await this.collectDiskMetrics(metrics, timestamp);
      }

      // Container-specific metrics
      if (this.config.includeContainerStats) {
        await this.collectContainerMetrics(metrics, timestamp);
      }

    } catch (error) {
      logger.error('Error collecting system resource metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return at least basic metrics even if detailed collection fails
      metrics.push({
        id: `error_${timestamp}`,
        name: 'collection_error',
        value: 1,
        unit: 'count',
        category: 'system',
        timestamp,
        source: this.id,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    return metrics;
  }

  private async collectBasicMetrics(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    // Load average
    const loadAvg = os.loadavg();
    metrics.push({
      id: `load_avg_1m_${timestamp}`,
      name: 'load_average_1m',
      value: loadAvg[0],
      unit: 'count',
      category: 'system',
      timestamp,
      source: this.id,
    });

    metrics.push({
      id: `load_avg_5m_${timestamp}`,
      name: 'load_average_5m',
      value: loadAvg[1],
      unit: 'count',
      category: 'system',
      timestamp,
      source: this.id,
    });

    // Uptime
    metrics.push({
      id: `uptime_${timestamp}`,
      name: 'system_uptime',
      value: os.uptime(),
      unit: 'ms',
      category: 'system',
      timestamp,
      source: this.id,
    });

    // Process uptime
    metrics.push({
      id: `process_uptime_${timestamp}`,
      name: 'process_uptime',
      value: process.uptime() * 1000,
      unit: 'ms',
      category: 'system',
      timestamp,
      source: this.id,
    });
  }

  private async collectCpuMetrics(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    // CPU count
    const cpuCount = os.cpus().length;
    metrics.push({
      id: `cpu_count_${timestamp}`,
      name: 'cpu_count',
      value: cpuCount,
      unit: 'count',
      category: 'system',
      timestamp,
      source: this.id,
    });

    // Process CPU usage
    const cpuUsage = process.cpuUsage(this.previousCpuStats);
    this.previousCpuStats = process.cpuUsage();

    if (cpuUsage) {
      const totalCpuTime = cpuUsage.user + cpuUsage.system;
      const cpuPercentage = totalCpuTime / 1000 / (this.intervalMs / 1000) / cpuCount * 100;

      metrics.push({
        id: `cpu_usage_${timestamp}`,
        name: 'cpu_usage_percent',
        value: cpuPercentage,
        unit: 'percentage',
        category: 'system',
        timestamp,
        source: this.id,
        metadata: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          total: totalCpuTime,
        },
      });
    }

    // Try to get detailed CPU stats from /proc/stat (Linux only)
    try {
      const cpuStats = await this.getLinuxCpuStats();
      if (cpuStats) {
        Object.entries(cpuStats).forEach(([key, value]) => {
          metrics.push({
            id: `cpu_${key}_${timestamp}`,
            name: `cpu_${key}`,
            value: value as number,
            unit: 'percentage',
            category: 'system',
            timestamp,
            source: this.id,
          });
        });
      }
    } catch (error) {
      // Ignore errors for non-Linux systems
    }
  }

  private async collectMemoryMetrics(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    // Process memory usage
    const processMemory = process.memoryUsage();
    
    Object.entries(processMemory).forEach(([key, value]) => {
      metrics.push({
        id: `process_memory_${key}_${timestamp}`,
        name: `process_memory_${key}`,
        value: value,
        unit: 'bytes',
        category: 'system',
        timestamp,
        source: this.id,
      });
    });

    // Memory usage percentage
    metrics.push({
      id: `memory_usage_percent_${timestamp}`,
      name: 'memory_usage_percent',
      value: (processMemory.heapUsed / processMemory.heapTotal) * 100,
      unit: 'percentage',
      category: 'system',
      timestamp,
      source: this.id,
    });

    // System memory (if available)
    try {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;

      metrics.push({
        id: `system_memory_total_${timestamp}`,
        name: 'system_memory_total',
        value: totalMemory,
        unit: 'bytes',
        category: 'system',
        timestamp,
        source: this.id,
      });

      metrics.push({
        id: `system_memory_used_${timestamp}`,
        name: 'system_memory_used',
        value: usedMemory,
        unit: 'bytes',
        category: 'system',
        timestamp,
        source: this.id,
      });

      metrics.push({
        id: `system_memory_usage_percent_${timestamp}`,
        name: 'system_memory_usage_percent',
        value: (usedMemory / totalMemory) * 100,
        unit: 'percentage',
        category: 'system',
        timestamp,
        source: this.id,
      });
    } catch (error) {
      // Continue if system memory stats are not available
    }
  }

  private async collectNetworkMetrics(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    try {
      const networkStats = await this.getLinuxNetworkStats();
      if (networkStats && this.previousNetworkStats) {
        // Calculate rates
        const timeDiff = (timestamp - (this.lastCollection || timestamp)) / 1000;
        
        Object.entries(networkStats).forEach(([interface_, stats]) => {
          const prevStats = this.previousNetworkStats[interface_];
          if (prevStats && timeDiff > 0) {
            const rxRate = (stats.rx_bytes - prevStats.rx_bytes) / timeDiff;
            const txRate = (stats.tx_bytes - prevStats.tx_bytes) / timeDiff;
            const rxPacketRate = (stats.rx_packets - prevStats.rx_packets) / timeDiff;
            const txPacketRate = (stats.tx_packets - prevStats.tx_packets) / timeDiff;

            metrics.push({
              id: `network_${interface_}_rx_rate_${timestamp}`,
              name: 'network_rx_rate',
              value: rxRate,
              unit: 'bytes',
              category: 'system',
              timestamp,
              source: this.id,
              metadata: { interface: interface_ },
            });

            metrics.push({
              id: `network_${interface_}_tx_rate_${timestamp}`,
              name: 'network_tx_rate',
              value: txRate,
              unit: 'bytes',
              category: 'system',
              timestamp,
              source: this.id,
              metadata: { interface: interface_ },
            });

            metrics.push({
              id: `network_${interface_}_rx_packet_rate_${timestamp}`,
              name: 'network_rx_packet_rate',
              value: rxPacketRate,
              unit: 'count',
              category: 'system',
              timestamp,
              source: this.id,
              metadata: { interface: interface_ },
            });

            metrics.push({
              id: `network_${interface_}_tx_packet_rate_${timestamp}`,
              name: 'network_tx_packet_rate',
              value: txPacketRate,
              unit: 'count',
              category: 'system',
              timestamp,
              source: this.id,
              metadata: { interface: interface_ },
            });
          }
        });
      }
      this.previousNetworkStats = networkStats;
    } catch (error) {
      // Network stats not available on this system
    }
  }

  private async collectDiskMetrics(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    try {
      // Get disk stats for the application directory
      const diskStats = await this.getDiskStats(process.cwd());
      
      Object.entries(diskStats).forEach(([key, value]) => {
        metrics.push({
          id: `disk_${key}_${timestamp}`,
          name: `disk_${key}`,
          value: value as number,
          unit: key.includes('percent') ? 'percentage' : 'bytes',
          category: 'system',
          timestamp,
          source: this.id,
        });
      });

      // Try to get I/O stats (Linux only)
      const ioStats = await this.getLinuxDiskIOStats();
      if (ioStats && this.previousDiskStats) {
        const timeDiff = (timestamp - (this.lastCollection || timestamp)) / 1000;
        
        if (timeDiff > 0) {
          const readRate = (ioStats.read_bytes - this.previousDiskStats.read_bytes) / timeDiff;
          const writeRate = (ioStats.write_bytes - this.previousDiskStats.write_bytes) / timeDiff;

          metrics.push({
            id: `disk_read_rate_${timestamp}`,
            name: 'disk_read_rate',
            value: readRate,
            unit: 'bytes',
            category: 'system',
            timestamp,
            source: this.id,
          });

          metrics.push({
            id: `disk_write_rate_${timestamp}`,
            name: 'disk_write_rate',
            value: writeRate,
            unit: 'bytes',
            category: 'system',
            timestamp,
            source: this.id,
          });
        }
      }
      this.previousDiskStats = ioStats;

    } catch (error) {
      // Disk stats not available
    }
  }

  private async collectContainerMetrics(metrics: PerformanceMetric[], timestamp: number): Promise<void> {
    try {
      // Try to detect if running in container and get container-specific metrics
      const containerStats = await this.getContainerStats();
      
      if (containerStats) {
        Object.entries(containerStats).forEach(([key, value]) => {
          metrics.push({
            id: `container_${key}_${timestamp}`,
            name: `container_${key}`,
            value: value as number,
            unit: key.includes('percent') ? 'percentage' : 'bytes',
            category: 'system',
            timestamp,
            source: this.id,
          });
        });
      }
    } catch (error) {
      // Not running in container or container stats not available
    }
  }

  private async getLinuxCpuStats(): Promise<Record<string, number> | null> {
    try {
      const statData = await readFile('/proc/stat', 'utf8');
      const cpuLine = statData.split('\n')[0];
      const values = cpuLine.split(/\s+/).slice(1).map(Number);
      
      const [user, nice, system, idle, iowait, irq, softirq, steal] = values;
      const total = values.reduce((sum, val) => sum + val, 0);
      
      return {
        user: (user / total) * 100,
        nice: (nice / total) * 100,
        system: (system / total) * 100,
        idle: (idle / total) * 100,
        iowait: (iowait / total) * 100,
        irq: (irq / total) * 100,
        softirq: (softirq / total) * 100,
        steal: (steal / total) * 100,
      };
    } catch (error) {
      return null;
    }
  }

  private async getLinuxNetworkStats(): Promise<Record<string, any> | null> {
    try {
      const netData = await readFile('/proc/net/dev', 'utf8');
      const lines = netData.split('\n').slice(2); // Skip header lines
      const stats: Record<string, any> = {};

      for (const line of lines) {
        if (line.trim()) {
          const parts = line.trim().split(/\s+/);
          const interface_ = parts[0].replace(':', '');
          
          if (interface_ !== 'lo') { // Skip loopback
            stats[interface_] = {
              rx_bytes: parseInt(parts[1]),
              rx_packets: parseInt(parts[2]),
              rx_errors: parseInt(parts[3]),
              tx_bytes: parseInt(parts[9]),
              tx_packets: parseInt(parts[10]),
              tx_errors: parseInt(parts[11]),
            };
          }
        }
      }

      return Object.keys(stats).length > 0 ? stats : null;
    } catch (error) {
      return null;
    }
  }

  private async getDiskStats(path: string): Promise<Record<string, number>> {
    try {
      const stats = await stat(path);
      // This is a basic implementation - could be enhanced with statvfs on Linux
      return {
        total_space: 0, // Would need platform-specific implementation
        free_space: 0,  // Would need platform-specific implementation
        used_space: 0,  // Would need platform-specific implementation
        usage_percent: 0, // Would need platform-specific implementation
      };
    } catch (error) {
      return {};
    }
  }

  private async getLinuxDiskIOStats(): Promise<{ read_bytes: number; write_bytes: number } | null> {
    try {
      const ioData = await readFile(`/proc/${process.pid}/io`, 'utf8');
      const lines = ioData.split('\n');
      
      let readBytes = 0;
      let writeBytes = 0;
      
      for (const line of lines) {
        if (line.startsWith('read_bytes:')) {
          readBytes = parseInt(line.split(':')[1].trim());
        } else if (line.startsWith('write_bytes:')) {
          writeBytes = parseInt(line.split(':')[1].trim());
        }
      }

      return { read_bytes: readBytes, write_bytes: writeBytes };
    } catch (error) {
      return null;
    }
  }

  private async getContainerStats(): Promise<Record<string, number> | null> {
    try {
      // Try to read cgroup memory limit (Docker/container)
      const memoryLimitData = await readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8');
      const memoryLimit = parseInt(memoryLimitData.trim());
      
      const memoryUsageData = await readFile('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8');
      const memoryUsage = parseInt(memoryUsageData.trim());
      
      return {
        memory_limit: memoryLimit,
        memory_usage: memoryUsage,
        memory_usage_percent: (memoryUsage / memoryLimit) * 100,
      };
    } catch (error) {
      // Try cgroup v2
      try {
        const memoryMaxData = await readFile('/sys/fs/cgroup/memory.max', 'utf8');
        const memoryCurrentData = await readFile('/sys/fs/cgroup/memory.current', 'utf8');
        
        const memoryMax = parseInt(memoryMaxData.trim());
        const memoryCurrent = parseInt(memoryCurrentData.trim());
        
        return {
          memory_limit: memoryMax,
          memory_usage: memoryCurrent,
          memory_usage_percent: (memoryCurrent / memoryMax) * 100,
        };
      } catch (error2) {
        return null;
      }
    }
  }
}

export default SystemResourceSource;