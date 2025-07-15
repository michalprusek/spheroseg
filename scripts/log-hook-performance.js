#!/usr/bin/env node

/**
 * Enhanced performance logging script for pre-commit hooks
 * Tracks execution times, success rates, and optimization opportunities
 * Usage: node scripts/log-hook-performance.js <hookType> <totalDuration> <stageDuration> <status> [filesCount] [platform]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PERFORMANCE_LOG_FILE = path.join(__dirname, '..', '.cache', 'hooks-performance.json');
const MAX_LOG_ENTRIES = 100; // Keep last 100 entries

// Ensure cache directory exists
const cacheDir = path.dirname(PERFORMANCE_LOG_FILE);
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

/**
 * Log performance data for a hook execution
 */
function logPerformance(hookType, totalDuration, stageDuration, status, filesCount = 0, platform = 'unknown') {
  try {
    // Read existing log data
    let logData = [];
    if (fs.existsSync(PERFORMANCE_LOG_FILE)) {
      const content = fs.readFileSync(PERFORMANCE_LOG_FILE, 'utf8');
      logData = JSON.parse(content);
    }

    // Create new entry
    const entry = {
      timestamp: new Date().toISOString(),
      hookType,
      totalDuration: parseInt(totalDuration, 10),
      stageDuration: parseInt(stageDuration, 10),
      status,
      filesCount: parseInt(filesCount, 10) || 0,
      platform,
      cacheEfficiency: calculateCacheEfficiency(),
      nodeVersion: process.version,
    };

    // Add to log data
    logData.push(entry);

    // Keep only recent entries
    if (logData.length > MAX_LOG_ENTRIES) {
      logData = logData.slice(-MAX_LOG_ENTRIES);
    }

    // Write back to file
    fs.writeFileSync(PERFORMANCE_LOG_FILE, JSON.stringify(logData, null, 2));

  } catch (error) {
    // Silent fail - don't break the commit process for logging issues
    // Only log to stderr in non-CI environments to avoid noise
    if (!process.env.CI) {
      console.warn('Warning: Failed to log performance data:', error.message);
    }
  }
}

/**
 * Calculate cache efficiency based on directory sizes
 */
function calculateCacheEfficiency() {
  try {
    const cacheDir = path.join(__dirname, '..', '.cache');
    if (!fs.existsSync(cacheDir)) {
      return 0;
    }

    // Simple heuristic: if cache exists and has content, assume some efficiency
    const stats = fs.statSync(cacheDir);
    return stats.isDirectory() ? 1 : 0;
  } catch (error) {
    return 0;
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const [hookType, totalDuration, stageDuration, status, filesCount, platform] = process.argv.slice(2);
  
  if (hookType && totalDuration && stageDuration && status) {
    logPerformance(hookType, totalDuration, stageDuration, status, filesCount, platform);
  } else {
    console.log('Usage: node log-hook-performance.js <hookType> <totalDuration> <stageDuration> <status> [filesCount] [platform]');
    process.exit(1);
  }
}