/**
 * Global test setup for advanced test utilities
 * 
 * This file should be imported in your test configuration to automatically
 * initialize performance benchmarking and health monitoring across all tests.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import {
  PerformanceBenchmarks,
  MemoryBenchmarks,
  BenchmarkSuiteRunner,
} from './performanceBenchmarks';
import {
  TestHealthMonitor,
  ConsoleHealthObserver,
  FileHealthObserver,
} from './testHealthMonitor';
import { AdvancedTestDataFactory } from './advancedTestFactories';

// Global test state
let healthMonitor: TestHealthMonitor;
let suiteRunner: BenchmarkSuiteRunner;
let globalTestMetrics = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  startTime: Date.now(),
};

/**
 * Initialize advanced test utilities
 * Call this in your test setup file (e.g., setupTests.ts)
 */
export function initializeAdvancedTestUtilities(options: {
  enableHealthMonitoring?: boolean;
  enablePerformanceBenchmarks?: boolean;
  enableConsoleReporting?: boolean;
  enableFileReporting?: boolean;
  healthReportPath?: string;
} = {}) {
  const {
    enableHealthMonitoring = true,
    enablePerformanceBenchmarks = true,
    enableConsoleReporting = true,
    enableFileReporting = false,
    healthReportPath = './test-health-report.md',
  } = options;

  // Initialize performance benchmarks
  if (enablePerformanceBenchmarks) {
    PerformanceBenchmarks.initializeStandardBenchmarks();
    
    // Add custom benchmarks for SpherosegV4
    PerformanceBenchmarks.register({
      name: 'image-upload-simulation',
      category: 'api',
      target: 300,
      warning: 800,
      critical: 2000,
      description: 'Image upload and processing simulation time',
    });

    PerformanceBenchmarks.register({
      name: 'segmentation-result-render',
      category: 'render',
      target: 200,
      warning: 500,
      critical: 1000,
      description: 'Segmentation result visualization render time',
    });

    PerformanceBenchmarks.register({
      name: 'project-dashboard-load',
      category: 'render',
      target: 400,
      warning: 800,
      critical: 1500,
      description: 'Project dashboard with multiple images load time',
    });

    PerformanceBenchmarks.register({
      name: 'cell-analysis-computation',
      category: 'computation',
      target: 250,
      warning: 600,
      critical: 1200,
      description: 'Cell feature analysis computation time',
    });

    // Initialize benchmark suite runner
    suiteRunner = new BenchmarkSuiteRunner();
    suiteRunner.addSuite('spheroseg-performance', [
      PerformanceBenchmarks.getBenchmark('component-render-basic')!,
      PerformanceBenchmarks.getBenchmark('component-render-complex')!,
      PerformanceBenchmarks.getBenchmark('user-click-response')!,
      PerformanceBenchmarks.getBenchmark('api-integration')!,
      PerformanceBenchmarks.getBenchmark('image-upload-simulation')!,
      PerformanceBenchmarks.getBenchmark('segmentation-result-render')!,
      PerformanceBenchmarks.getBenchmark('project-dashboard-load')!,
      PerformanceBenchmarks.getBenchmark('cell-analysis-computation')!,
    ]);
  }

  // Initialize test health monitoring
  if (enableHealthMonitoring) {
    healthMonitor = TestHealthMonitor.getInstance();
    
    if (enableConsoleReporting) {
      healthMonitor.addObserver(new ConsoleHealthObserver());
    }
    
    if (enableFileReporting) {
      healthMonitor.addObserver(new FileHealthObserver(healthReportPath));
    }
  }

  console.log('🚀 Advanced Test Utilities Initialized');
  if (enablePerformanceBenchmarks) {
    console.log('  ⚡ Performance Benchmarking: Enabled');
  }
  if (enableHealthMonitoring) {
    console.log('  🏥 Health Monitoring: Enabled');
  }
}

/**
 * Global test setup - runs before all tests
 */
export function setupGlobalTestEnvironment() {
  beforeAll(() => {
    globalTestMetrics.startTime = Date.now();
    console.log('🧪 Starting test suite execution');
  });

  beforeEach(() => {
    // Reset test data sequences for consistent data
    AdvancedTestDataFactory.resetSequence();
    
    // Track test execution
    globalTestMetrics.totalTests++;
  });

  afterAll(async () => {
    const duration = Date.now() - globalTestMetrics.startTime;
    
    console.log('\n📊 Test Suite Summary:');
    console.log(`  Total Tests: ${globalTestMetrics.totalTests}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Average Test Time: ${(duration / globalTestMetrics.totalTests).toFixed(2)}ms`);

    // Generate health report if monitoring is enabled
    if (healthMonitor) {
      try {
        const metrics = healthMonitor.collectMetrics();
        console.log('\n🏥 Final Test Health Metrics:');
        console.log(`  Performance: ${metrics.performance.score}/100`);
        console.log(`  Coverage: ${metrics.coverage.score}/100`);
        console.log(`  Reliability: ${metrics.reliability.score}/100`);
        console.log(`  Maintainability: ${metrics.maintainability.score}/100`);
        console.log(`  Overall: ${metrics.overall.score}/100 (${metrics.overall.status})`);
        
        if (metrics.overall.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          metrics.overall.recommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec}`);
          });
        }
      } catch (error) {
        console.warn('⚠️ Failed to generate health metrics:', error);
      }
    }

    // Generate performance benchmark report if enabled
    if (suiteRunner) {
      try {
        // Create a map of test functions for the suite (empty since we're just reporting)
        const emptyTestFunctions = new Map();
        
        console.log('\n⚡ Performance Benchmark Summary:');
        const allResults = PerformanceBenchmarks.getAllResults();
        
        let totalBenchmarks = 0;
        let passedBenchmarks = 0;
        let warningBenchmarks = 0;
        let failedBenchmarks = 0;

        allResults.forEach((results, benchmarkName) => {
          if (results.length > 0) {
            const latestResult = results[results.length - 1];
            totalBenchmarks++;
            
            switch (latestResult.status) {
              case 'pass':
                passedBenchmarks++;
                break;
              case 'warning':
                warningBenchmarks++;
                break;
              case 'fail':
                failedBenchmarks++;
                break;
            }
            
            console.log(`  ${benchmarkName}: ${latestResult.actualTime.toFixed(2)}ms (${latestResult.status})`);
          }
        });

        if (totalBenchmarks > 0) {
          console.log(`\n  Benchmark Summary: ${passedBenchmarks} passed, ${warningBenchmarks} warnings, ${failedBenchmarks} failed`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to generate benchmark report:', error);
      }
    }

    console.log('\n✅ Test suite execution completed');
  });
}

/**
 * Enhanced test wrapper for automatic performance tracking
 */
export function testWithBenchmark(
  testName: string,
  benchmarkName: string,
  testFn: () => Promise<void> | void
) {
  return async () => {
    const startTime = performance.now();
    
    try {
      await testFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Record benchmark result
      PerformanceBenchmarks.recordResult(benchmarkName, duration);
      globalTestMetrics.passedTests++;
      
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Still record performance even on failure
      PerformanceBenchmarks.recordResult(benchmarkName, duration);
      globalTestMetrics.failedTests++;
      
      throw error;
    }
  };
}

/**
 * Utility to check if performance monitoring is enabled
 */
export function isPerformanceMonitoringEnabled(): boolean {
  return process.env.ENABLE_TEST_PERFORMANCE_MONITORING === 'true' ||
         process.env.NODE_ENV === 'development';
}

/**
 * Utility to get performance thresholds from environment
 */
export function getPerformanceThresholds() {
  return {
    renderBasic: Number(process.env.TEST_RENDER_THRESHOLD_MS) || 50,
    renderComplex: Number(process.env.TEST_RENDER_COMPLEX_THRESHOLD_MS) || 150,
    userInteraction: Number(process.env.TEST_INTERACTION_THRESHOLD_MS) || 16,
    apiCall: Number(process.env.TEST_API_THRESHOLD_MS) || 200,
  };
}

/**
 * Memory leak detection utility
 */
export function detectMemoryLeaks(testName: string) {
  const beforeSnapshot = MemoryBenchmarks.takeSnapshot(`${testName}-before`);
  
  return {
    finish: () => {
      const afterSnapshot = MemoryBenchmarks.takeSnapshot(`${testName}-after`);
      const comparison = MemoryBenchmarks.compareSnapshots(
        `${testName}-before`,
        `${testName}-after`
      );
      
      if (comparison.leakDetected) {
        console.warn(`⚠️ Potential memory leak detected in test "${testName}"`);
        console.warn(`  Heap increase: ${(comparison.heapUsedDiff / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // Cleanup snapshots
      MemoryBenchmarks.clearSnapshots();
      
      return comparison;
    }
  };
}

/**
 * Export utilities for easy access
 */
export {
  healthMonitor,
  suiteRunner,
  globalTestMetrics,
  PerformanceBenchmarks,
  MemoryBenchmarks,
  TestHealthMonitor,
};