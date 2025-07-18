#!/usr/bin/env node

/**
 * Performance monitoring wrapper for git hooks
 * Tracks execution time and resource usage of pre-commit checks
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class HookPerformanceMonitor {
  constructor(hookName) {
    this.hookName = hookName;
    this.startTime = performance.now();
    this.stats = {
      startMemory: process.memoryUsage(),
      startCpu: process.cpuUsage(),
      commands: []
    };
  }

  /**
   * Track command execution
   */
  trackCommand(command, duration, success = true) {
    this.stats.commands.push({
      command,
      duration,
      success,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(this.stats.startCpu);

    const report = {
      hook: this.hookName,
      timestamp: new Date().toISOString(),
      performance: {
        totalDuration: Math.round(totalDuration),
        commands: this.stats.commands,
        totalCommands: this.stats.commands.length,
        successfulCommands: this.stats.commands.filter(c => c.success).length,
        failedCommands: this.stats.commands.filter(c => !c.success).length
      },
      resources: {
        memory: {
          initial: this.stats.startMemory,
          final: endMemory,
          peak: Math.max(
            this.stats.startMemory.heapUsed,
            endMemory.heapUsed
          ),
          deltaHeap: endMemory.heapUsed - this.stats.startMemory.heapUsed,
          deltaRss: endMemory.rss - this.stats.startMemory.rss
        },
        cpu: {
          user: Math.round(endCpu.user / 1000), // microseconds to milliseconds
          system: Math.round(endCpu.system / 1000)
        }
      }
    };

    return report;
  }

  /**
   * Log performance summary
   */
  logSummary() {
    const report = this.generateReport();
    
    console.log(`\n⏱️  Hook Performance Summary:`);
    console.log(`  Duration: ${(report.performance.totalDuration / 1000).toFixed(2)}s`);
    console.log(`  Commands: ${report.performance.totalCommands} (${report.performance.successfulCommands} ✅, ${report.performance.failedCommands} ❌)`);
    console.log(`  Memory Delta: ${(report.resources.memory.deltaHeap / 1024 / 1024).toFixed(1)}MB heap, ${(report.resources.memory.deltaRss / 1024 / 1024).toFixed(1)}MB RSS`);
    console.log(`  CPU: ${report.resources.cpu.user}ms user, ${report.resources.cpu.system}ms system`);

    // Log slow commands
    const slowCommands = report.performance.commands.filter(c => c.duration > 1000);
    if (slowCommands.length > 0) {
      console.log(`\n⚠️  Slow commands (>1s):`);
      slowCommands.forEach(cmd => {
        console.log(`    ${cmd.command}: ${(cmd.duration / 1000).toFixed(2)}s`);
      });
    }

    // Save detailed report for analysis
    this.saveReport(report);
  }

  /**
   * Save detailed performance report
   */
  saveReport(report) {
    try {
      const reportsDir = path.join(__dirname, '..', '.git', 'hook-reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const reportFile = path.join(
        reportsDir,
        `${this.hookName}-${Date.now()}.json`
      );

      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      
      // Keep only the last 10 reports to avoid clutter
      this.cleanupOldReports(reportsDir);
    } catch (error) {
      // Silent fail - don't break hooks if reporting fails
      console.warn(`Warning: Could not save performance report: ${error.message}`);
    }
  }

  /**
   * Clean up old performance reports
   */
  cleanupOldReports(reportsDir) {
    try {
      const files = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith(this.hookName) && f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(reportsDir, f),
          mtime: fs.statSync(path.join(reportsDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Keep only the 10 most recent reports
      files.slice(10).forEach(file => {
        fs.unlinkSync(file.path);
      });
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Get aggregated performance stats
   */
  static getAggregatedStats(hookName, days = 7) {
    try {
      const reportsDir = path.join(__dirname, '..', '.git', 'hook-reports');
      if (!fs.existsSync(reportsDir)) {
        return null;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const reports = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith(hookName) && f.endsWith('.json'))
        .map(f => {
          try {
            const content = fs.readFileSync(path.join(reportsDir, f), 'utf8');
            return JSON.parse(content);
          } catch {
            return null;
          }
        })
        .filter(r => r && new Date(r.timestamp) > cutoffDate);

      if (reports.length === 0) {
        return null;
      }

      const durations = reports.map(r => r.performance.totalDuration);
      const memoryDeltas = reports.map(r => r.resources.memory.deltaHeap);

      return {
        totalRuns: reports.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        averageMemoryDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
        successRate: reports.filter(r => r.performance.failedCommands === 0).length / reports.length
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = HookPerformanceMonitor;