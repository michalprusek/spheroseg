/**
 * Enhanced test configuration that integrates all test utility systems
 */

import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { optimizeTestMemory } from './performanceTestUtils';
import { TestDebugger, TestMonitor, PerformanceDebugger } from './debuggingTestUtils';
import { TestReportGenerator, TestMetricsCollector } from './reportingTestUtils';

// Global test configuration
export const configureTestEnvironment = () => {
  // Performance optimization settings
  const memoryOptimizer = optimizeTestMemory();
  
  // Enable debugging in development
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TESTS === 'true') {
    TestDebugger.enable();
  }

  // Setup global test hooks
  beforeEach(() => {
    // Clear all mocks and memory
    vi.clearAllMocks();
    memoryOptimizer.clearMocks();
    
    // Reset metrics collection
    TestMetricsCollector.reset();
    
    // Clear debug state
    TestDebugger.clear();
    PerformanceDebugger.clear();
  });

  afterEach(() => {
    // Clean up React Testing Library
    cleanup();
    
    // Clear DOM and memory
    memoryOptimizer.clearDOM();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  // Setup test monitoring
  TestMonitor.addListener({
    onTestStart: (testName) => {
      TestDebugger.log(`Test started: ${testName}`);
      PerformanceDebugger.mark(`test_start_${testName}`);
    },
    
    onTestEnd: (testName, result) => {
      PerformanceDebugger.mark(`test_end_${testName}`);
      const duration = PerformanceDebugger.measure(
        `test_duration_${testName}`,
        `test_start_${testName}`,
        `test_end_${testName}`
      );
      
      TestDebugger.log(`Test completed: ${testName}`, {
        status: result.status,
        duration: `${duration.toFixed(2)}ms`
      });
    },
    
    onError: (error, context) => {
      TestDebugger.log(`Test error in ${context || 'unknown context'}`, error, 'error');
    }
  });

  return {
    memoryOptimizer,
    generateReport: () => TestReportGenerator.generateComprehensiveReport(),
    getDebugState: () => TestDebugger.dumpState(),
    getPerformanceReport: () => PerformanceDebugger.generatePerformanceReport(),
  };
};

// Enhanced test wrapper with automatic performance tracking
export const enhancedTest = (testName: string, testFn: () => Promise<void> | void) => {
  return async () => {
    const startTime = performance.now();
    TestMonitor.onTestStart(testName);
    
    try {
      await testFn();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      TestMonitor.onTestEnd(testName, {
        status: 'passed',
        duration,
      });
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      TestMonitor.onTestEnd(testName, {
        status: 'failed',
        duration,
        error: error.message,
        stack: error.stack,
      });
      
      TestMonitor.onError(error, testName);
      throw error;
    }
  };
};

// Component test factory with built-in optimizations
export const createOptimizedComponentTest = <T extends Record<string, any>>(
  componentName: string,
  Component: React.ComponentType<T>,
  defaultProps: Partial<T> = {}
) => {
  return {
    render: (props: Partial<T> = {}) => {
      const mergedProps = { ...defaultProps, ...props } as T;
      TestDebugger.log(`Rendering component: ${componentName}`, { props: mergedProps });
      
      const startTime = performance.now();
      const result = render(<Component {...mergedProps} />);
      const endTime = performance.now();
      
      TestDebugger.log(`Component rendered in ${(endTime - startTime).toFixed(2)}ms`);
      TestMetricsCollector.incrementAssertion();
      
      return result;
    },
    
    testProps: async (propCombinations: Array<Partial<T>>) => {
      for (const props of propCombinations) {
        const { unmount } = render(<Component {...defaultProps} {...props} />);
        TestMetricsCollector.incrementAssertion();
        unmount();
      }
    },
    
    testAccessibility: async () => {
      const { container } = render(<Component {...defaultProps} />);
      
      // Basic accessibility checks
      const interactiveElements = container.querySelectorAll('button, input, select, textarea, a[href]');
      interactiveElements.forEach(element => {
        const hasLabel = element.getAttribute('aria-label') || 
                        element.getAttribute('aria-labelledby') ||
                        (element as HTMLElement).innerText?.trim();
        
        if (!hasLabel) {
          TestDebugger.log(`Missing label on interactive element`, element, 'warn');
        }
      });
      
      TestMetricsCollector.incrementAssertion();
    },
  };
};

// API test helpers with automatic monitoring
export const createApiTestHelpers = () => {
  const originalFetch = global.fetch;
  
  const mockFetch = vi.fn();
  global.fetch = mockFetch;
  
  return {
    mockApiResponse: (data: any, status = 200, delay = 0) => {
      mockFetch.mockImplementation(() => {
        TestMetricsCollector.incrementApiCall();
        
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: status >= 200 && status < 300,
              status,
              json: () => Promise.resolve(data),
              text: () => Promise.resolve(JSON.stringify(data)),
            });
          }, delay);
        });
      });
    },
    
    mockApiError: (error: string, status = 500) => {
      mockFetch.mockImplementation(() => {
        TestMetricsCollector.incrementApiCall();
        
        return Promise.reject(new Error(error));
      });
    },
    
    verifyApiCalls: (expectedCalls: number) => {
      expect(mockFetch).toHaveBeenCalledTimes(expectedCalls);
      TestMetricsCollector.incrementAssertion();
    },
    
    getApiCallHistory: () => {
      return mockFetch.mock.calls;
    },
    
    restore: () => {
      global.fetch = originalFetch;
      mockFetch.mockRestore();
    },
  };
};

// Form test helpers with validation
export const createFormTestHelpers = () => {
  return {
    fillField: async (fieldName: string, value: string, user: any) => {
      const field = screen.getByLabelText(new RegExp(fieldName, 'i'));
      await user.clear(field);
      await user.type(field, value);
      TestMetricsCollector.incrementDomQuery();
    },
    
    submitForm: async (user: any) => {
      const submitButton = screen.getByRole('button', { name: /submit|save|create/i });
      await user.click(submitButton);
      TestMetricsCollector.incrementDomQuery();
    },
    
    expectValidationError: async (errorMessage: string) => {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
      });
      TestMetricsCollector.incrementAssertion();
    },
    
    expectFormSuccess: async () => {
      await waitFor(() => {
        const successElements = screen.queryAllByText(/success|created|saved|submitted/i);
        expect(successElements.length).toBeGreaterThan(0);
      });
      TestMetricsCollector.incrementAssertion();
    },
  };
};

// Memory leak detection
export const detectMemoryLeaks = () => {
  const initialMemory = process.memoryUsage().heapUsed;
  
  return {
    check: (testName: string, threshold = 10 * 1024 * 1024) => { // 10MB threshold
      const currentMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = currentMemory - initialMemory;
      
      if (memoryIncrease > threshold) {
        TestDebugger.log(
          `Potential memory leak detected in ${testName}`,
          {
            initial: `${(initialMemory / 1024 / 1024).toFixed(2)}MB`,
            current: `${(currentMemory / 1024 / 1024).toFixed(2)}MB`,
            increase: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
          },
          'warn'
        );
        TestMetricsCollector.incrementMemoryLeak();
      }
    },
  };
};

// Test performance assertions
export const createPerformanceAssertions = () => {
  return {
    expectMaxRenderTime: (maxMs: number) => (actualMs: number) => {
      expect(actualMs).toBeLessThanOrEqual(maxMs);
      if (actualMs > maxMs * 0.8) {
        TestDebugger.log(`Render time approaching limit: ${actualMs}ms (max: ${maxMs}ms)`, null, 'warn');
      }
    },
    
    expectMaxMemoryUsage: (maxMB: number) => {
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      expect(memoryUsage).toBeLessThanOrEqual(maxMB);
      if (memoryUsage > maxMB * 0.8) {
        TestDebugger.log(`Memory usage approaching limit: ${memoryUsage.toFixed(2)}MB (max: ${maxMB}MB)`, null, 'warn');
      }
    },
    
    expectMaxDomQueries: (maxQueries: number) => {
      const metrics = TestMetricsCollector.getMetrics();
      expect(metrics.domQueries).toBeLessThanOrEqual(maxQueries);
      if (metrics.domQueries > maxQueries * 0.8) {
        TestDebugger.log(`DOM queries approaching limit: ${metrics.domQueries} (max: ${maxQueries})`, null, 'warn');
      }
    },
  };
};

// Test suite configuration for different environments
export const testEnvironmentConfig = {
  ci: {
    timeout: 30000,
    retries: 2,
    enableDebug: false,
    enablePerformanceTracking: true,
    memoryThresholds: {
      test: 50, // MB
      suite: 200, // MB
    },
  },
  
  development: {
    timeout: 10000,
    retries: 0,
    enableDebug: true,
    enablePerformanceTracking: true,
    memoryThresholds: {
      test: 100, // MB
      suite: 500, // MB
    },
  },
  
  production: {
    timeout: 5000,
    retries: 0,
    enableDebug: false,
    enablePerformanceTracking: false,
    memoryThresholds: {
      test: 25, // MB
      suite: 100, // MB
    },
  },
};

// Get configuration for current environment
export const getCurrentTestConfig = () => {
  const env = process.env.NODE_ENV as keyof typeof testEnvironmentConfig || 'development';
  return testEnvironmentConfig[env] || testEnvironmentConfig.development;
};

// Export all utilities as a unified interface
export default {
  configureTestEnvironment,
  enhancedTest,
  createOptimizedComponentTest,
  createApiTestHelpers,
  createFormTestHelpers,
  detectMemoryLeaks,
  createPerformanceAssertions,
  getCurrentTestConfig,
};