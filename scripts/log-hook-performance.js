#!/usr/bin/env node

/**
 * Simple CLI script to log hook performance data
 * Usage: node scripts/log-hook-performance.js <hookName> <totalDuration> [commandDuration]
 */

const HookPerformanceMonitor = require('./hook-performance-monitor.js');

const [, , hookName, totalDuration, commandDuration] = process.argv;

if (!hookName || !totalDuration) {
  console.error('Usage: node scripts/log-hook-performance.js <hookName> <totalDuration> [commandDuration]');
  process.exit(1);
}

try {
  // Create a mock monitor for logging
  const monitor = new HookPerformanceMonitor(hookName);
  
  // Add the main command
  if (commandDuration) {
    monitor.trackCommand('lint-staged', parseInt(commandDuration), true);
  }
  
  // Override the total duration calculation
  monitor.startTime = performance.now() - parseInt(totalDuration);
  
  // Generate and save the report
  const report = monitor.generateReport();
  monitor.saveReport(report);
  
  // Log aggregated stats if available
  const aggregated = HookPerformanceMonitor.getAggregatedStats(hookName, 7);
  if (aggregated && aggregated.totalRuns > 1) {
    const current = parseInt(totalDuration);
    const avg = Math.round(aggregated.averageDuration);
    const deviation = ((current - avg) / avg * 100).toFixed(1);
    
    console.log(`📊 7-day average: ${avg}ms (current: ${deviation > 0 ? '+' : ''}${deviation}% vs avg)`);
  }
} catch (error) {
  // Silent fail - don't break hooks
  console.warn(`Warning: Performance logging failed: ${error.message}`);
}