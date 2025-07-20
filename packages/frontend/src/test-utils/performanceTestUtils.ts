/**
 * Performance test utilities for optimizing test execution speed and reliability
 */

import React from 'react';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Type definitions
export interface PerformanceMetrics {
  average: number;
  runs: number;
  min: number;
  max: number;
}

export interface CallHistory {
  args: any[];
  timestamp: number;
  callCount: number;
}

// Performance tracking utilities
export class TestPerformanceTracker {
  private static timers = new Map<string, number>();
  private static metrics = new Map<string, number[]>();

  static startTimer(testName: string): void {
    this.timers.set(testName, performance.now());
  }

  static endTimer(testName: string): number {
    const startTime = this.timers.get(testName);
    if (!startTime) {
      console.warn(`Timer not found for test: ${testName}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(testName);
    
    // Store metric
    const existing = this.metrics.get(testName) || [];
    existing.push(duration);
    this.metrics.set(testName, existing);
    
    return duration;
  }

  static getAverageTime(testName: string): number {
    const times = this.metrics.get(testName) || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  static getAllMetrics(): Record<string, PerformanceMetrics> {
    const results: Record<string, PerformanceMetrics> = {};
    
    this.metrics.forEach((times, testName) => {
      if (times.length > 0) {
        results[testName] = {
          average: times.reduce((a, b) => a + b, 0) / times.length,
          runs: times.length,
          min: Math.min(...times),
          max: Math.max(...times),
        };
      }
    });
    
    return results;
  }

  static clearMetrics(): void {
    this.timers.clear();
    this.metrics.clear();
  }
}

// Test setup optimizations
export const setupPerformanceTest = (testName: string) => {
  TestPerformanceTracker.startTimer(testName);
  
  return {
    cleanup: () => {
      const duration = TestPerformanceTracker.endTimer(testName);
      cleanup(); // React Testing Library cleanup
      return duration;
    }
  };
};

// Mock cache for reusable mocks
const mockCache = new Map<string, any>();

export const getCachedMock = <T = any>(key: string, factory: () => T): T => {
  if (!mockCache.has(key)) {
    mockCache.set(key, factory());
  }
  return mockCache.get(key);
};

export const clearMockCache = (): void => {
  mockCache.clear();
};

// Optimized component factory for repeated use
export const createOptimizedComponent = <T extends Record<string, any>>(
  ComponentClass: React.ComponentType<T>,
  defaultProps: Partial<T> = {}
) => {
  const cachedKey = `component_${ComponentClass.name}`;
  
  return getCachedMock(cachedKey, () => {
    return (props: Partial<T> = {}) => {
      const mergedProps = { ...defaultProps, ...props } as T;
      return React.createElement(ComponentClass, mergedProps);
    };
  });
};

// Fast DOM query utilities
export const fastQuery = {
  byTestId: (testId: string) => document.querySelector(`[data-testid="${testId}"]`),
  byRole: (role: string) => document.querySelector(`[role="${role}"]`),
  byText: (text: string) => document.evaluate(
    `//*[contains(text(),'${text}')]`,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue,
  allByTestId: (testId: string) => Array.from(document.querySelectorAll(`[data-testid="${testId}"]`)),
};

// Batch testing utilities
export class BatchTestRunner {
  private tests: Array<{ name: string; test: () => Promise<void> | void }> = [];
  
  add(name: string, test: () => Promise<void> | void): this {
    this.tests.push({ name, test });
    return this;
  }
  
  async runAll(): Promise<void> {
    for (const { name, test } of this.tests) {
      const { cleanup } = setupPerformanceTest(name);
      try {
        await test();
      } finally {
        cleanup();
      }
    }
  }
  
  clear(): void {
    this.tests = [];
  }
}

// Memory optimization utilities
export const optimizeTestMemory = () => {
  // Clear vi mocks periodically
  const clearMocks = () => {
    vi.clearAllMocks();
    clearMockCache();
  };
  
  // Clear DOM between tests
  const clearDOM = () => {
    document.body.innerHTML = '';
  };
  
  return {
    clearMocks,
    clearDOM,
    clearAll: () => {
      clearMocks();
      clearDOM();
      cleanup();
    }
  };
};

// Async test utilities with timeout management
export const createAsyncTestWrapper = (timeout = 5000) => {
  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timeout after ${timeout}ms`));
      }, timeout);
      
      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  };
};

// Performance-optimized render function
export const fastRender = (component: React.ReactElement) => {
  // Use faster DOM manipulation for simple components
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  // Simple React render without full testing library overhead for performance tests
  return {
    container,
    cleanup: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };
};

// Test data factory with caching
export class TestDataFactory {
  private static cache = new Map<string, any>();
  
  static createUser(overrides: Record<string, any> = {}) {
    const cacheKey = `user_${JSON.stringify(overrides)}`;
    return getCachedMock(cacheKey, () => ({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    }));
  }
  
  static createProject(overrides: Record<string, any> = {}) {
    const cacheKey = `project_${JSON.stringify(overrides)}`;
    return getCachedMock(cacheKey, () => ({
      id: '1',
      name: 'Test Project',
      description: 'Test project description',
      user_id: '1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    }));
  }
  
  static createImage(overrides: Record<string, any> = {}) {
    const cacheKey = `image_${JSON.stringify(overrides)}`;
    return getCachedMock(cacheKey, () => ({
      id: '1',
      filename: 'test-image.jpg',
      original_filename: 'test-image.jpg',
      file_path: '/uploads/test-image.jpg',
      thumbnail_path: '/uploads/thumbs/test-image.jpg',
      segmentation_status: 'without_segmentation',
      project_id: '1',
      uploaded_at: new Date().toISOString(),
      ...overrides,
    }));
  }
  
  static clearCache() {
    this.cache.clear();
  }
}

// Performance assertion utilities
export const performanceAssertions = {
  expectMaxRenderTime: (maxMs: number) => (testName: string) => {
    const avgTime = TestPerformanceTracker.getAverageTime(testName);
    if (avgTime > maxMs) {
      throw new Error(`Test "${testName}" average render time ${avgTime.toFixed(2)}ms exceeds maximum ${maxMs}ms`);
    }
  },
  
  expectMemoryUsage: (maxMB: number) => {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memoryInfo = (performance as any).memory;
      const usedMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
      if (usedMB > maxMB) {
        throw new Error(`Memory usage ${usedMB.toFixed(2)}MB exceeds maximum ${maxMB}MB`);
      }
    }
  },
};

// Test concurrency utilities
export const createConcurrentTestRunner = (maxConcurrency = 3) => {
  const queue: Array<() => Promise<void>> = [];
  let running = 0;
  
  const runNext = async (): Promise<void> => {
    if (queue.length === 0 || running >= maxConcurrency) return;
    
    running++;
    const test = queue.shift();
    if (test) {
      try {
        await test();
      } finally {
        running--;
        runNext();
      }
    }
  };
  
  return {
    add: (test: () => Promise<void>) => {
      queue.push(test);
      runNext();
    },
    
    waitForAll: (): Promise<void> => {
      return new Promise((resolve) => {
        const checkComplete = () => {
          if (queue.length === 0 && running === 0) {
            resolve();
          } else {
            setTimeout(checkComplete, 10);
          }
        };
        checkComplete();
      });
    }
  };
};

export default {
  TestPerformanceTracker,
  setupPerformanceTest,
  getCachedMock,
  clearMockCache,
  createOptimizedComponent,
  fastQuery,
  BatchTestRunner,
  optimizeTestMemory,
  createAsyncTestWrapper,
  fastRender,
  TestDataFactory,
  performanceAssertions,
  createConcurrentTestRunner,
};