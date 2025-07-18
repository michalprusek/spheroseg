/**
 * Tests for hook performance monitoring
 */

const fs = require('fs');
const path = require('path');
const HookPerformanceMonitor = require('../hook-performance-monitor.js');

// Mock filesystem operations
jest.mock('fs');

describe('HookPerformanceMonitor', () => {
  let monitor;
  let mockFS;

  beforeEach(() => {
    monitor = new HookPerformanceMonitor('test-hook');
    mockFS = require('fs');
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock basic fs operations
    mockFS.existsSync = jest.fn();
    mockFS.mkdirSync = jest.fn();
    mockFS.writeFileSync = jest.fn();
    mockFS.readdirSync = jest.fn();
    mockFS.statSync = jest.fn();
    mockFS.unlinkSync = jest.fn();
  });

  describe('Constructor', () => {
    it('should initialize with hook name and start time', () => {
      expect(monitor.hookName).toBe('test-hook');
      expect(monitor.startTime).toBeGreaterThan(0);
      expect(monitor.stats.commands).toEqual([]);
      expect(monitor.stats.startMemory).toBeDefined();
      expect(monitor.stats.startCpu).toBeDefined();
    });
  });

  describe('trackCommand', () => {
    it('should track successful command execution', () => {
      monitor.trackCommand('eslint', 1500, true);
      
      expect(monitor.stats.commands).toHaveLength(1);
      expect(monitor.stats.commands[0]).toMatchObject({
        command: 'eslint',
        duration: 1500,
        success: true
      });
      expect(monitor.stats.commands[0].timestamp).toBeDefined();
    });

    it('should track failed command execution', () => {
      monitor.trackCommand('prettier', 800, false);
      
      expect(monitor.stats.commands).toHaveLength(1);
      expect(monitor.stats.commands[0]).toMatchObject({
        command: 'prettier',
        duration: 800,
        success: false
      });
    });

    it('should default to successful execution', () => {
      monitor.trackCommand('test-command', 1000);
      
      expect(monitor.stats.commands[0].success).toBe(true);
    });
  });

  describe('generateReport', () => {
    beforeEach(() => {
      // Mock performance to have consistent timing
      monitor.startTime = 1000;
      jest.spyOn(performance, 'now').mockReturnValue(3000); // 2 seconds later
      
      // Add some test commands
      monitor.trackCommand('lint-staged', 1500, true);
      monitor.trackCommand('eslint', 800, false);
    });

    afterEach(() => {
      performance.now.mockRestore();
    });

    it('should generate comprehensive performance report', () => {
      const report = monitor.generateReport();
      
      expect(report).toMatchObject({
        hook: 'test-hook',
        performance: {
          totalDuration: 2000,
          totalCommands: 2,
          successfulCommands: 1,
          failedCommands: 1
        }
      });
      
      expect(report.timestamp).toBeDefined();
      expect(report.performance.commands).toHaveLength(2);
      expect(report.resources.memory).toBeDefined();
      expect(report.resources.cpu).toBeDefined();
    });

    it('should calculate memory deltas correctly', () => {
      // Mock memory usage
      const startMemory = { heapUsed: 1000000, rss: 2000000 };
      const endMemory = { heapUsed: 1500000, rss: 2200000 };
      
      monitor.stats.startMemory = startMemory;
      jest.spyOn(process, 'memoryUsage').mockReturnValue(endMemory);
      
      const report = monitor.generateReport();
      
      expect(report.resources.memory.deltaHeap).toBe(500000);
      expect(report.resources.memory.deltaRss).toBe(200000);
      expect(report.resources.memory.peak).toBe(Math.max(startMemory.heapUsed, endMemory.heapUsed));
      
      process.memoryUsage.mockRestore();
    });
  });

  describe('saveReport', () => {
    beforeEach(() => {
      mockFS.existsSync.mockReturnValue(false);
    });

    it('should create reports directory if it does not exist', () => {
      const report = { test: 'data' };
      monitor.saveReport(report);
      
      expect(mockFS.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.git/hook-reports'),
        { recursive: true }
      );
    });

    it('should save report to JSON file', () => {
      const report = { test: 'data', timestamp: '2023-01-01T00:00:00.000Z' };
      monitor.saveReport(report);
      
      expect(mockFS.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/test-hook-\d+\.json$/),
        JSON.stringify(report, null, 2)
      );
    });

    it('should handle save errors gracefully', () => {
      mockFS.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      monitor.saveReport({ test: 'data' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not save performance report: Permission denied')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('cleanupOldReports', () => {
    it('should keep only the 10 most recent reports', () => {
      const mockFiles = Array.from({ length: 15 }, (_, i) => `test-hook-${i}.json`);
      const mockStats = mockFiles.map((file, i) => ({
        name: file,
        path: `/path/to/${file}`,
        mtime: new Date(2023, 0, i + 1) // Incremental dates
      }));
      
      mockFS.readdirSync.mockReturnValue(mockFiles);
      mockFS.statSync.mockImplementation((filePath) => {
        const fileName = path.basename(filePath);
        return { mtime: mockStats.find(s => s.name === fileName).mtime };
      });
      
      monitor.cleanupOldReports('/path/to/reports');
      
      // Should delete 5 oldest files (15 - 10 = 5)
      expect(mockFS.unlinkSync).toHaveBeenCalledTimes(5);
    });

    it('should handle cleanup errors gracefully', () => {
      mockFS.readdirSync.mockImplementation(() => {
        throw new Error('Directory not found');
      });
      
      // Should not throw error
      expect(() => {
        monitor.cleanupOldReports('/path/to/reports');
      }).not.toThrow();
    });
  });

  describe('getAggregatedStats', () => {
    beforeEach(() => {
      const mockReports = [
        { timestamp: '2023-01-01T00:00:00.000Z', performance: { totalDuration: 1000, failedCommands: 0 }, resources: { memory: { deltaHeap: 100000 } } },
        { timestamp: '2023-01-02T00:00:00.000Z', performance: { totalDuration: 1500, failedCommands: 1 }, resources: { memory: { deltaHeap: 150000 } } },
        { timestamp: '2023-01-03T00:00:00.000Z', performance: { totalDuration: 800, failedCommands: 0 }, resources: { memory: { deltaHeap: 80000 } } },
      ];
      
      mockFS.existsSync.mockReturnValue(true);
      mockFS.readdirSync.mockReturnValue(['test-hook-1.json', 'test-hook-2.json', 'test-hook-3.json']);
      mockFS.readFileSync.mockImplementation((filePath) => {
        const fileName = path.basename(filePath);
        const index = parseInt(fileName.match(/(\d+)/)[1]) - 1;
        return JSON.stringify(mockReports[index]);
      });
    });

    it('should calculate aggregated statistics', () => {
      const stats = HookPerformanceMonitor.getAggregatedStats('test-hook', 7);
      
      expect(stats).toMatchObject({
        totalRuns: 3,
        averageDuration: 1100, // (1000 + 1500 + 800) / 3
        minDuration: 800,
        maxDuration: 1500,
        averageMemoryDelta: 110000, // (100000 + 150000 + 80000) / 3
        successRate: 2/3 // 2 successful out of 3
      });
    });

    it('should filter reports by date range', () => {
      // Mock current date to be 2023-01-05
      const originalDate = Date;
      global.Date = class extends Date {
        constructor() {
          return new originalDate('2023-01-05T00:00:00.000Z');
        }
        static setDate = originalDate.setDate;
      };
      
      const stats = HookPerformanceMonitor.getAggregatedStats('test-hook', 2); // Last 2 days
      
      expect(stats.totalRuns).toBe(2); // Should exclude 2023-01-01
      
      global.Date = originalDate;
    });

    it('should return null when no reports directory exists', () => {
      mockFS.existsSync.mockReturnValue(false);
      
      const stats = HookPerformanceMonitor.getAggregatedStats('test-hook', 7);
      
      expect(stats).toBeNull();
    });

    it('should return null when no reports are found', () => {
      mockFS.readdirSync.mockReturnValue([]);
      
      const stats = HookPerformanceMonitor.getAggregatedStats('test-hook', 7);
      
      expect(stats).toBeNull();
    });

    it('should handle corrupted report files gracefully', () => {
      mockFS.readdirSync.mockReturnValue(['test-hook-1.json', 'corrupted.json']);
      mockFS.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('corrupted')) {
          return 'invalid json';
        }
        return JSON.stringify({ 
          timestamp: '2023-01-01T00:00:00.000Z', 
          performance: { totalDuration: 1000, failedCommands: 0 }, 
          resources: { memory: { deltaHeap: 100000 } } 
        });
      });
      
      const stats = HookPerformanceMonitor.getAggregatedStats('test-hook', 7);
      
      expect(stats.totalRuns).toBe(1); // Should skip corrupted file
    });
  });

  describe('logSummary', () => {
    beforeEach(() => {
      monitor.trackCommand('lint-staged', 1500, true);
      monitor.trackCommand('slow-command', 2000, true);
    });

    it('should log performance summary to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const saveReportSpy = jest.spyOn(monitor, 'saveReport').mockImplementation();
      
      monitor.logSummary();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Hook Performance Summary'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Duration:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Memory Delta:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CPU:'));
      
      expect(saveReportSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      saveReportSpy.mockRestore();
    });

    it('should highlight slow commands', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      monitor.logSummary();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Slow commands'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('slow-command: 2.00s'));
      
      consoleSpy.mockRestore();
    });
  });
});