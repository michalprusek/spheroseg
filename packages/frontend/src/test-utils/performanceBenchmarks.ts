/**
 * Test performance benchmarking system for automated performance testing
 */

import { TestPerformanceTracker } from './performanceTestUtils';

// Performance benchmark definitions
export interface PerformanceBenchmark {
  name: string;
  category: 'render' | 'interaction' | 'api' | 'computation' | 'memory';
  target: number; // Target time in milliseconds
  warning: number; // Warning threshold in milliseconds
  critical: number; // Critical threshold in milliseconds
  description: string;
}

export interface BenchmarkResult {
  benchmark: PerformanceBenchmark;
  actualTime: number;
  status: 'pass' | 'warning' | 'fail';
  improvement: number; // % improvement over baseline
  trend: 'improving' | 'stable' | 'degrading';
}

export interface BenchmarkSuite {
  name: string;
  benchmarks: PerformanceBenchmark[];
  results: BenchmarkResult[];
  overallStatus: 'pass' | 'warning' | 'fail';
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

// Performance benchmarks registry
export class PerformanceBenchmarks {
  private static benchmarks: Map<string, PerformanceBenchmark> = new Map();
  private static results: Map<string, BenchmarkResult[]> = new Map();
  private static baselines: Map<string, number> = new Map();

  // Register standard benchmarks
  static initializeStandardBenchmarks(): void {
    this.register({
      name: 'component-render-basic',
      category: 'render',
      target: 50,
      warning: 100,
      critical: 200,
      description: 'Basic component render time'
    });

    this.register({
      name: 'component-render-complex',
      category: 'render',
      target: 150,
      warning: 300,
      critical: 500,
      description: 'Complex component with data render time'
    });

    this.register({
      name: 'user-click-response',
      category: 'interaction',
      target: 16,
      warning: 50,
      critical: 100,
      description: 'User click to UI response time'
    });

    this.register({
      name: 'form-validation',
      category: 'interaction',
      target: 30,
      warning: 100,
      critical: 200,
      description: 'Form validation response time'
    });

    this.register({
      name: 'api-call-mock',
      category: 'api',
      target: 10,
      warning: 50,
      critical: 100,
      description: 'Mock API call response time'
    });

    this.register({
      name: 'api-integration',
      category: 'api',
      target: 200,
      warning: 500,
      critical: 1000,
      description: 'Real API integration test time'
    });

    this.register({
      name: 'data-processing',
      category: 'computation',
      target: 100,
      warning: 300,
      critical: 500,
      description: 'Test data processing time'
    });

    this.register({
      name: 'memory-usage-test',
      category: 'memory',
      target: 10, // MB
      warning: 25,
      critical: 50,
      description: 'Memory usage during test execution'
    });

    this.register({
      name: 'test-setup-teardown',
      category: 'computation',
      target: 50,
      warning: 150,
      critical: 300,
      description: 'Test setup and teardown time'
    });

    this.register({
      name: 'mock-creation',
      category: 'computation',
      target: 20,
      warning: 50,
      critical: 100,
      description: 'Mock object creation time'
    });
  }

  static register(benchmark: PerformanceBenchmark): void {
    this.benchmarks.set(benchmark.name, benchmark);
  }

  static getBenchmark(name: string): PerformanceBenchmark | undefined {
    return this.benchmarks.get(name);
  }

  static getAllBenchmarks(): PerformanceBenchmark[] {
    return Array.from(this.benchmarks.values());
  }

  static getBenchmarksByCategory(category: PerformanceBenchmark['category']): PerformanceBenchmark[] {
    return Array.from(this.benchmarks.values()).filter(b => b.category === category);
  }

  static setBaseline(benchmarkName: string, timeMs: number): void {
    this.baselines.set(benchmarkName, timeMs);
  }

  static getBaseline(benchmarkName: string): number | undefined {
    return this.baselines.get(benchmarkName);
  }

  static recordResult(benchmarkName: string, actualTime: number): BenchmarkResult | null {
    const benchmark = this.getBenchmark(benchmarkName);
    if (!benchmark) {
      console.warn(`Benchmark "${benchmarkName}" not found`);
      return null;
    }

    let status: 'pass' | 'warning' | 'fail';
    if (actualTime <= benchmark.target) {
      status = 'pass';
    } else if (actualTime <= benchmark.warning) {
      status = 'warning';
    } else {
      status = 'fail';
    }

    const baseline = this.getBaseline(benchmarkName);
    const improvement = baseline ? ((baseline - actualTime) / baseline) * 100 : 0;

    const trend = this.calculateTrend(benchmarkName, actualTime);

    const result: BenchmarkResult = {
      benchmark,
      actualTime,
      status,
      improvement,
      trend,
    };

    // Store result
    if (!this.results.has(benchmarkName)) {
      this.results.set(benchmarkName, []);
    }
    this.results.get(benchmarkName)!.push(result);

    return result;
  }

  private static calculateTrend(benchmarkName: string, currentTime: number): 'improving' | 'stable' | 'degrading' {
    const history = this.results.get(benchmarkName) || [];
    if (history.length < 3) {
      return 'stable';
    }

    const recent = history.slice(-3).map(r => r.actualTime);
    const average = recent.reduce((sum, time) => sum + time, 0) / recent.length;
    
    const threshold = average * 0.1; // 10% threshold
    
    if (currentTime < average - threshold) {
      return 'improving';
    } else if (currentTime > average + threshold) {
      return 'degrading';
    } else {
      return 'stable';
    }
  }

  static getResults(benchmarkName: string): BenchmarkResult[] {
    return this.results.get(benchmarkName) || [];
  }

  static getAllResults(): Map<string, BenchmarkResult[]> {
    return new Map(this.results);
  }

  static clearResults(benchmarkName?: string): void {
    if (benchmarkName) {
      this.results.delete(benchmarkName);
    } else {
      this.results.clear();
    }
  }
}

// Benchmark test decorator
export function benchmark(benchmarkName: string) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const startTime = performance.now();
      
      try {
        const result = await method.apply(this, args);
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Record benchmark result
        PerformanceBenchmarks.recordResult(benchmarkName, duration);
        
        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Still record the result even if test failed
        PerformanceBenchmarks.recordResult(benchmarkName, duration);
        
        throw error;
      }
    };

    return descriptor;
  };
}

// Benchmark test wrapper
export async function benchmarkTest<T>(
  benchmarkName: string,
  testFn: () => Promise<T> | T
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await testFn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    PerformanceBenchmarks.recordResult(benchmarkName, duration);
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    PerformanceBenchmarks.recordResult(benchmarkName, duration);
    
    throw error;
  }
}

// Memory benchmark utilities
export class MemoryBenchmarks {
  private static snapshots: Map<string, MemorySnapshot> = new Map();

  static takeSnapshot(name: string): MemorySnapshot {
    const snapshot: MemorySnapshot = {
      name,
      timestamp: Date.now(),
      heapUsed: this.getHeapUsed(),
      heapTotal: this.getHeapTotal(),
      external: this.getExternal(),
    };

    this.snapshots.set(name, snapshot);
    return snapshot;
  }

  static compareSnapshots(before: string, after: string): MemoryComparison {
    const beforeSnapshot = this.snapshots.get(before);
    const afterSnapshot = this.snapshots.get(after);

    if (!beforeSnapshot || !afterSnapshot) {
      throw new Error(`Snapshots "${before}" or "${after}" not found`);
    }

    return {
      heapUsedDiff: afterSnapshot.heapUsed - beforeSnapshot.heapUsed,
      heapTotalDiff: afterSnapshot.heapTotal - beforeSnapshot.heapTotal,
      externalDiff: afterSnapshot.external - beforeSnapshot.external,
      duration: afterSnapshot.timestamp - beforeSnapshot.timestamp,
      leakDetected: this.detectLeak(beforeSnapshot, afterSnapshot),
    };
  }

  private static getHeapUsed(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private static getHeapTotal(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapTotal;
    }
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.totalJSHeapSize;
    }
    return 0;
  }

  private static getExternal(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().external;
    }
    return 0;
  }

  private static detectLeak(before: MemorySnapshot, after: MemorySnapshot): boolean {
    const heapIncrease = after.heapUsed - before.heapUsed;
    const threshold = 10 * 1024 * 1024; // 10MB threshold
    return heapIncrease > threshold;
  }

  static clearSnapshots(): void {
    this.snapshots.clear();
  }
}

// Performance test suite runner
export class BenchmarkSuiteRunner {
  private suites: Map<string, BenchmarkSuite> = new Map();

  addSuite(name: string, benchmarks: PerformanceBenchmark[]): void {
    const suite: BenchmarkSuite = {
      name,
      benchmarks,
      results: [],
      overallStatus: 'pass',
      summary: {
        total: benchmarks.length,
        passed: 0,
        warnings: 0,
        failed: 0,
      },
    };

    this.suites.set(name, suite);
  }

  async runSuite(suiteName: string, testFunctions: Map<string, () => Promise<void>>): Promise<BenchmarkSuite> {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      throw new Error(`Benchmark suite "${suiteName}" not found`);
    }

    suite.results = [];
    suite.summary = { total: suite.benchmarks.length, passed: 0, warnings: 0, failed: 0 };

    for (const benchmark of suite.benchmarks) {
      const testFn = testFunctions.get(benchmark.name);
      if (!testFn) {
        console.warn(`Test function for benchmark "${benchmark.name}" not found`);
        continue;
      }

      const result = await benchmarkTest(benchmark.name, testFn);
      const benchmarkResult = PerformanceBenchmarks.getResults(benchmark.name).slice(-1)[0];
      
      if (benchmarkResult) {
        suite.results.push(benchmarkResult);
        
        switch (benchmarkResult.status) {
          case 'pass':
            suite.summary.passed++;
            break;
          case 'warning':
            suite.summary.warnings++;
            break;
          case 'fail':
            suite.summary.failed++;
            break;
        }
      }
    }

    // Determine overall status
    if (suite.summary.failed > 0) {
      suite.overallStatus = 'fail';
    } else if (suite.summary.warnings > 0) {
      suite.overallStatus = 'warning';
    } else {
      suite.overallStatus = 'pass';
    }

    return suite;
  }

  generateReport(suiteName: string): string {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      return `Benchmark suite "${suiteName}" not found`;
    }

    return `
# Performance Benchmark Report: ${suite.name}
Generated: ${new Date().toISOString()}

## Summary
- Total benchmarks: ${suite.summary.total}
- Passed: ${suite.summary.passed}
- Warnings: ${suite.summary.warnings}
- Failed: ${suite.summary.failed}
- Overall Status: ${suite.overallStatus.toUpperCase()}

## Results
${suite.results.map(result => `
### ${result.benchmark.name}
- **Status**: ${result.status.toUpperCase()}
- **Actual Time**: ${result.actualTime.toFixed(2)}ms
- **Target**: ${result.benchmark.target}ms
- **Warning Threshold**: ${result.benchmark.warning}ms
- **Critical Threshold**: ${result.benchmark.critical}ms
- **Improvement**: ${result.improvement > 0 ? '+' : ''}${result.improvement.toFixed(1)}%
- **Trend**: ${result.trend}
- **Description**: ${result.benchmark.description}
`).join('\n')}
    `;
  }

  getSuite(name: string): BenchmarkSuite | undefined {
    return this.suites.get(name);
  }

  getAllSuites(): BenchmarkSuite[] {
    return Array.from(this.suites.values());
  }
}

// Types
interface MemorySnapshot {
  name: string;
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

interface MemoryComparison {
  heapUsedDiff: number;
  heapTotalDiff: number;
  externalDiff: number;
  duration: number;
  leakDetected: boolean;
}

// Initialize standard benchmarks
PerformanceBenchmarks.initializeStandardBenchmarks();

export default {
  PerformanceBenchmarks,
  MemoryBenchmarks,
  BenchmarkSuiteRunner,
  benchmark,
  benchmarkTest,
};