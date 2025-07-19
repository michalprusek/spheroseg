/**
 * Vitest setup file for advanced test utilities
 * 
 * Add this to your vitest.config.ts:
 * 
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['./src/test-utils/vitestSetup.ts'],
 *     // ... other config
 *   },
 * });
 */

import { expect, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import our advanced test utilities
import {
  initializeAdvancedTestUtilities,
  setupGlobalTestEnvironment,
  isPerformanceMonitoringEnabled,
} from './testSetup';

// Initialize advanced test utilities
initializeAdvancedTestUtilities({
  enableHealthMonitoring: true,
  enablePerformanceBenchmarks: isPerformanceMonitoringEnabled(),
  enableConsoleReporting: true,
  enableFileReporting: process.env.CI === 'true', // Only in CI
  healthReportPath: './test-results/health-report.md',
});

// Setup global test environment
setupGlobalTestEnvironment();

// Global test setup
beforeAll(() => {
  // Mock browser APIs that might not be available in test environment
  global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  global.IntersectionObserver = global.IntersectionObserver || class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  // Mock URL.createObjectURL for file handling tests
  global.URL.createObjectURL = global.URL.createObjectURL || (() => 'mock-url');
  global.URL.revokeObjectURL = global.URL.revokeObjectURL || (() => {});

  console.log('🚀 Vitest setup completed with advanced test utilities');
});

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Custom matchers for our test utilities
expect.extend({
  toBeWithinPerformanceThreshold(received: number, threshold: number) {
    const pass = received <= threshold;
    
    if (pass) {
      return {
        message: () => `Expected ${received}ms to exceed ${threshold}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received}ms to be within ${threshold}ms threshold`,
        pass: false,
      };
    }
  },

  toHaveGoodTestHealth(received: any) {
    const pass = received.overall && received.overall.score >= 70;
    
    if (pass) {
      return {
        message: () => `Expected test health score ${received.overall.score} to be below 70`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected test health score ${received.overall.score} to be at least 70`,
        pass: false,
      };
    }
  },

  toBeAccessible(received: HTMLElement) {
    const checks = [];
    let pass = true;

    // Check for aria-label or aria-labelledby
    const hasAriaLabel = received.getAttribute('aria-label') || 
                        received.getAttribute('aria-labelledby');
    
    // Check for proper role
    const role = received.getAttribute('role');
    const tagName = received.tagName.toLowerCase();
    
    // Interactive elements should have proper accessibility
    const interactiveElements = ['button', 'input', 'select', 'textarea', 'a'];
    if (interactiveElements.includes(tagName)) {
      if (!hasAriaLabel && !received.textContent?.trim()) {
        checks.push('Missing aria-label or text content');
        pass = false;
      }
      
      const tabIndex = received.getAttribute('tabindex');
      if (tabIndex && parseInt(tabIndex) < 0) {
        checks.push('Interactive element has negative tabindex');
        pass = false;
      }
    }

    if (pass) {
      return {
        message: () => `Expected element to fail accessibility checks`,
        pass: true,
      };
    } else {
      return {
        message: () => `Element failed accessibility checks: ${checks.join(', ')}`,
        pass: false,
      };
    }
  },
});

// Declare custom matchers for TypeScript
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeWithinPerformanceThreshold(threshold: number): T;
    toHaveGoodTestHealth(): T;
  }
  
  interface AsymmetricMatchersContaining {
    toBeWithinPerformanceThreshold(threshold: number): any;
    toHaveGoodTestHealth(): any;
  }
}

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAccessible(): R;
    }
  }
}

// Export test utilities for easy import in test files
export {
  testWithBenchmark,
  detectMemoryLeaks,
  getPerformanceThresholds,
} from './testSetup';

export {
  AdvancedTestDataFactory,
  renderWithProviders,
  AdvancedMockBuilder,
  TestScenarioBuilder,
  TestTimingUtils,
  AdvancedAssertions,
} from './advancedTestFactories';

export {
  benchmarkTest,
  PerformanceBenchmarks,
  MemoryBenchmarks,
} from './performanceBenchmarks';

export {
  TestHealthMonitor,
} from './testHealthMonitor';