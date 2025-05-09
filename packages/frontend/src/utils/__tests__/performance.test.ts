import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  measurePerformance,
  trackOperationTime,
  debounce,
  throttle,
  memoize,
  PerformanceMonitor
} from '../performance';

describe('Performance Utilities', () => {
  // Store original performance.now to restore after tests
  const originalPerformanceNow = performance.now;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock performance.now
    let currentTime = 0;
    performance.now = vi.fn(() => currentTime);
    
    // Helper to advance time
    global.advanceTime = (ms: number) => {
      currentTime += ms;
      // Run any pending timers
      vi.runOnlyPendingTimers();
    };
  });
  
  afterEach(() => {
    // Restore original performance.now
    performance.now = originalPerformanceNow;
    // Remove helper
    delete global.advanceTime;
  });
  
  describe('measurePerformance', () => {
    it('measures execution time of a function', () => {
      const testFn = vi.fn(() => {
        // Simulate work
        global.advanceTime(100);
      });
      
      const result = measurePerformance(testFn);
      
      expect(testFn).toHaveBeenCalled();
      expect(result.executionTime).toBe(100);
    });
    
    it('passes arguments to the measured function', () => {
      const testFn = vi.fn((a, b) => {
        // Simulate work
        global.advanceTime(100);
        return a + b;
      });
      
      const result = measurePerformance(() => testFn(5, 7));
      
      expect(testFn).toHaveBeenCalledWith(5, 7);
      expect(result.result).toBe(12);
    });
    
    it('handles and reports errors', () => {
      const errorMessage = 'Test error';
      const testFn = vi.fn(() => {
        throw new Error(errorMessage);
      });
      
      // Should not throw
      const result = measurePerformance(testFn);
      
      expect(testFn).toHaveBeenCalled();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(errorMessage);
    });
  });
  
  describe('trackOperationTime', () => {
    it('creates a decorator that tracks execution time', async () => {
      const onComplete = vi.fn();
      
      const trackedFn = trackOperationTime(
        async (a, b) => {
          // Simulate async work
          await new Promise(r => setTimeout(r, 100));
          global.advanceTime(100);
          return a + b;
        },
        'test-operation',
        onComplete
      );
      
      const result = await trackedFn(5, 7);
      
      expect(result).toBe(12);
      expect(onComplete).toHaveBeenCalledWith('test-operation', 100);
    });
    
    it('passes operation name to callback', async () => {
      const onComplete = vi.fn();
      
      const operationName = 'custom-operation';
      const trackedFn = trackOperationTime(
        () => {
          global.advanceTime(50);
        },
        operationName,
        onComplete
      );
      
      await trackedFn();
      
      expect(onComplete).toHaveBeenCalledWith(operationName, 50);
    });
    
    it('handles errors in tracked function', async () => {
      const onComplete = vi.fn();
      const onError = vi.fn();
      
      const trackedFn = trackOperationTime(
        () => {
          global.advanceTime(50);
          throw new Error('Test error');
        },
        'error-operation',
        onComplete,
        onError
      );
      
      // Should propagate error
      await expect(trackedFn()).rejects.toThrow('Test error');
      
      // Should still call onComplete with execution time
      expect(onComplete).toHaveBeenCalledWith('error-operation', 50);
      
      // Should call onError with error
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
  
  describe('debounce', () => {
    it('debounces function calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      
      // Call multiple times
      debounced();
      debounced();
      debounced();
      
      // Function should not be called yet
      expect(fn).not.toHaveBeenCalled();
      
      // Advance time past debounce interval
      global.advanceTime(110);
      
      // Function should be called once
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('cancels previous calls when called again before timeout', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      
      // Initial call
      debounced();
      
      // Advance time but not past debounce interval
      global.advanceTime(50);
      
      // Function should not be called yet
      expect(fn).not.toHaveBeenCalled();
      
      // Call again, which should reset the timer
      debounced();
      
      // Advance time to just past the first timeout
      global.advanceTime(60);
      
      // Function should still not be called
      expect(fn).not.toHaveBeenCalled();
      
      // Advance time past the second timeout
      global.advanceTime(50);
      
      // Function should now be called once
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('passes the most recent arguments to the debounced function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      
      // Call with different arguments
      debounced('first');
      debounced('second');
      debounced('third');
      
      // Advance time past debounce interval
      global.advanceTime(110);
      
      // Function should be called with the last arguments
      expect(fn).toHaveBeenCalledWith('third');
    });
  });
  
  describe('throttle', () => {
    it('throttles function calls', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      
      // First call should execute immediately
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Subsequent calls within throttle period should be ignored
      throttled();
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Advance time past throttle interval
      global.advanceTime(110);
      
      // Next call should execute
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });
    
    it('passes arguments to the throttled function', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      
      // Call with arguments
      throttled('test', 123);
      
      // Function should be called with arguments
      expect(fn).toHaveBeenCalledWith('test', 123);
    });
    
    it('can use leading=false to delay the first execution', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100, { leading: false });
      
      // First call should not execute immediately
      throttled();
      expect(fn).not.toHaveBeenCalled();
      
      // Advance time past throttle interval
      global.advanceTime(110);
      
      // Function should now be called
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('can use trailing=true to execute final call after delay', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100, { trailing: true });
      
      // First call should execute immediately
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Additional calls within throttle period
      throttled('second');
      throttled('third');
      
      // No additional calls yet
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Advance time past throttle interval
      global.advanceTime(110);
      
      // Function should be called again with the last arguments
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('third');
    });
  });
  
  describe('memoize', () => {
    it('caches function results based on arguments', () => {
      const fn = vi.fn((a, b) => a + b);
      const memoized = memoize(fn);
      
      // First call with unique arguments
      const result1 = memoized(1, 2);
      expect(result1).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Second call with same arguments
      const result2 = memoized(1, 2);
      expect(result2).toBe(3);
      // Should use cached result
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Call with different arguments
      const result3 = memoized(2, 3);
      expect(result3).toBe(5);
      // Should call function again
      expect(fn).toHaveBeenCalledTimes(2);
    });
    
    it('uses custom resolver to determine cache key', () => {
      const fn = vi.fn((obj) => obj.value);
      const resolver = (obj) => obj.id;
      
      const memoized = memoize(fn, resolver);
      
      // First call
      const result1 = memoized({ id: 'a', value: 1 });
      expect(result1).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Different object with same ID
      const result2 = memoized({ id: 'a', value: 2 });
      // Should use cached result despite different value
      expect(result2).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Different ID
      const result3 = memoized({ id: 'b', value: 2 });
      expect(result3).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });
    
    it('handles functions with variable arguments', () => {
      const fn = vi.fn((...args) => args.reduce((a, b) => a + b, 0));
      const memoized = memoize(fn);
      
      // Call with different number of arguments
      const result1 = memoized(1, 2);
      const result2 = memoized(1, 2, 3);
      
      expect(result1).toBe(3);
      expect(result2).toBe(6);
      expect(fn).toHaveBeenCalledTimes(2);
      
      // Repeat calls
      const result3 = memoized(1, 2);
      const result4 = memoized(1, 2, 3);
      
      expect(result3).toBe(3);
      expect(result4).toBe(6);
      // Should use cached results
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('PerformanceMonitor', () => {
    it('tracks operation timing', () => {
      const monitor = new PerformanceMonitor();
      
      // Start and end an operation
      monitor.startOperation('test-op');
      global.advanceTime(50);
      monitor.endOperation('test-op');
      
      // Get stats
      const stats = monitor.getStats();
      
      // Should have tracked operation
      expect(stats['test-op']).toBeDefined();
      expect(stats['test-op'].count).toBe(1);
      expect(stats['test-op'].totalTime).toBe(50);
      expect(stats['test-op'].averageTime).toBe(50);
    });
    
    it('tracks multiple operations', () => {
      const monitor = new PerformanceMonitor();
      
      // Track first operation
      monitor.startOperation('op1');
      global.advanceTime(50);
      monitor.endOperation('op1');
      
      // Track second operation
      monitor.startOperation('op2');
      global.advanceTime(100);
      monitor.endOperation('op2');
      
      // Get stats
      const stats = monitor.getStats();
      
      // Should have tracked both operations
      expect(stats['op1']).toBeDefined();
      expect(stats['op2']).toBeDefined();
      
      expect(stats['op1'].count).toBe(1);
      expect(stats['op1'].totalTime).toBe(50);
      
      expect(stats['op2'].count).toBe(1);
      expect(stats['op2'].totalTime).toBe(100);
    });
    
    it('handles repeated operations', () => {
      const monitor = new PerformanceMonitor();
      
      // First execution
      monitor.startOperation('repeat-op');
      global.advanceTime(100);
      monitor.endOperation('repeat-op');
      
      // Second execution
      monitor.startOperation('repeat-op');
      global.advanceTime(50);
      monitor.endOperation('repeat-op');
      
      // Get stats
      const stats = monitor.getStats();
      
      // Should have tracked both executions
      expect(stats['repeat-op'].count).toBe(2);
      expect(stats['repeat-op'].totalTime).toBe(150);
      expect(stats['repeat-op'].averageTime).toBe(75);
      expect(stats['repeat-op'].minTime).toBe(50);
      expect(stats['repeat-op'].maxTime).toBe(100);
    });
    
    it('provides an operation decorator', () => {
      const monitor = new PerformanceMonitor();
      
      // Create decorated function
      const fn = vi.fn((a, b) => {
        global.advanceTime(50);
        return a + b;
      });
      
      const decorated = monitor.trackOperation('test-fn', fn);
      
      // Call decorated function
      const result = decorated(5, 7);
      
      // Should return correct result
      expect(result).toBe(12);
      
      // Should track operation
      const stats = monitor.getStats();
      expect(stats['test-fn'].count).toBe(1);
      expect(stats['test-fn'].totalTime).toBe(50);
    });
    
    it('resets statistics', () => {
      const monitor = new PerformanceMonitor();
      
      // Record some operations
      monitor.startOperation('op1');
      global.advanceTime(50);
      monitor.endOperation('op1');
      
      // Verify stats
      expect(monitor.getStats()['op1']).toBeDefined();
      
      // Reset
      monitor.reset();
      
      // Stats should be empty
      expect(Object.keys(monitor.getStats())).toHaveLength(0);
    });
    
    it('reports statistics', () => {
      const monitor = new PerformanceMonitor();
      
      // Track operations
      monitor.startOperation('op1');
      global.advanceTime(50);
      monitor.endOperation('op1');
      
      monitor.startOperation('op2');
      global.advanceTime(100);
      monitor.endOperation('op2');
      
      // Get formatted report
      const report = monitor.getReport();
      
      // Report should include both operations
      expect(report).toContain('op1');
      expect(report).toContain('op2');
      expect(report).toContain('50');
      expect(report).toContain('100');
    });
  });
});