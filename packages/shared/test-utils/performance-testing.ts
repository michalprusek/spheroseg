/**
 * Performance Testing Utilities
 * Advanced performance monitoring and regression testing for the test suite
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceBenchmark {
  name: string;
  baseline: number;
  threshold: number;
  unit: string;
  direction: 'lower-is-better' | 'higher-is-better';
}

export interface PerformanceReport {
  testName: string;
  metrics: PerformanceMetric[];
  benchmarks: PerformanceBenchmark[];
  violations: PerformanceViolation[];
  summary: {
    totalMetrics: number;
    violations: number;
    overallScore: number;
  };
}

export interface PerformanceViolation {
  metric: string;
  actual: number;
  expected: number;
  severity: 'warning' | 'error';
  message: string;
}

/**
 * Performance monitoring class
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private benchmarks: Map<string, PerformanceBenchmark> = new Map();
  private startTimes: Map<string, number> = new Map();

  /**
   * Set performance benchmark
   */
  setBenchmark(benchmark: PerformanceBenchmark): void {
    this.benchmarks.set(benchmark.name, benchmark);
  }

  /**
   * Set multiple benchmarks
   */
  setBenchmarks(benchmarks: PerformanceBenchmark[]): void {
    benchmarks.forEach(benchmark => this.setBenchmark(benchmark));
  }

  /**
   * Start timing a specific operation
   */
  startTimer(name: string): void {
    this.startTimes.set(name, performance.now());
  }

  /**
   * End timing and record metric
   */
  endTimer(name: string, metadata?: Record<string, any>): number {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      throw new Error(`No timer started for: ${name}`);
    }

    const duration = performance.now() - startTime;
    this.recordMetric({
      name,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      metadata,
    });

    this.startTimes.delete(name);
    return duration;
  }

  /**
   * Time a function execution
   */
  async timeFunction<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
  ): Promise<{ result: T; duration: number }> {
    this.startTimer(name);
    try {
      const result = await fn();
      const duration = this.endTimer(name, metadata);
      return { result, duration };
    } catch (error) {
      this.endTimer(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(name: string): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.recordMetric({
        name: `${name}_memory_rss`,
        value: usage.rss,
        unit: 'bytes',
        timestamp: Date.now(),
      });
      this.recordMetric({
        name: `${name}_memory_heapUsed`,
        value: usage.heapUsed,
        unit: 'bytes',
        timestamp: Date.now(),
      });
    } else if (typeof window !== 'undefined' && (window as any).performance?.memory) {
      const memory = (window as any).performance.memory;
      this.recordMetric({
        name: `${name}_memory_usedJSHeapSize`,
        value: memory.usedJSHeapSize,
        unit: 'bytes',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Generate performance report
   */
  generateReport(testName: string): PerformanceReport {
    const violations = this.checkViolations();
    const summary = this.calculateSummary(violations);

    return {
      testName,
      metrics: [...this.metrics],
      benchmarks: Array.from(this.benchmarks.values()),
      violations,
      summary,
    };
  }

  /**
   * Check for benchmark violations
   */
  private checkViolations(): PerformanceViolation[] {
    const violations: PerformanceViolation[] = [];

    this.benchmarks.forEach((benchmark, name) => {
      const metric = this.metrics.find(m => m.name === name);
      if (!metric) return;

      const isViolation = benchmark.direction === 'lower-is-better'
        ? metric.value > benchmark.threshold
        : metric.value < benchmark.threshold;

      if (isViolation) {
        const severity = metric.value > benchmark.baseline * 2 ? 'error' : 'warning';
        violations.push({
          metric: name,
          actual: metric.value,
          expected: benchmark.threshold,
          severity,
          message: `${name} ${benchmark.direction === 'lower-is-better' ? 'exceeded' : 'below'} threshold: ${metric.value}${metric.unit} vs ${benchmark.threshold}${benchmark.unit}`,
        });
      }
    });

    return violations;
  }

  /**
   * Calculate performance summary
   */
  private calculateSummary(violations: PerformanceViolation[]) {
    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;
    
    // Calculate overall score (100 = perfect, 0 = all failed)
    const overallScore = Math.max(0, 100 - (errorCount * 30) - (warningCount * 10));

    return {
      totalMetrics: this.metrics.length,
      violations: violations.length,
      overallScore,
    };
  }

  /**
   * Clear all metrics and timers
   */
  clear(): void {
    this.metrics = [];
    this.startTimes.clear();
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      benchmarks: Array.from(this.benchmarks.values()),
      timestamp: Date.now(),
    }, null, 2);
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTester {
  /**
   * Standard web performance benchmarks
   */
  static getWebPerformanceBenchmarks(): PerformanceBenchmark[] {
    return [
      {
        name: 'component_render_time',
        baseline: 16,
        threshold: 33, // 30fps threshold
        unit: 'ms',
        direction: 'lower-is-better',
      },
      {
        name: 'api_response_time',
        baseline: 100,
        threshold: 500,
        unit: 'ms',
        direction: 'lower-is-better',
      },
      {
        name: 'memory_usage',
        baseline: 50 * 1024 * 1024, // 50MB
        threshold: 100 * 1024 * 1024, // 100MB
        unit: 'bytes',
        direction: 'lower-is-better',
      },
      {
        name: 'test_execution_time',
        baseline: 1000,
        threshold: 5000, // 5 seconds
        unit: 'ms',
        direction: 'lower-is-better',
      },
    ];
  }

  /**
   * Standard backend performance benchmarks
   */
  static getBackendPerformanceBenchmarks(): PerformanceBenchmark[] {
    return [
      {
        name: 'database_query_time',
        baseline: 10,
        threshold: 100,
        unit: 'ms',
        direction: 'lower-is-better',
      },
      {
        name: 'endpoint_response_time',
        baseline: 50,
        threshold: 200,
        unit: 'ms',
        direction: 'lower-is-better',
      },
      {
        name: 'memory_heap_used',
        baseline: 100 * 1024 * 1024, // 100MB
        threshold: 500 * 1024 * 1024, // 500MB
        unit: 'bytes',
        direction: 'lower-is-better',
      },
    ];
  }

  /**
   * ML service performance benchmarks
   */
  static getMLPerformanceBenchmarks(): PerformanceBenchmark[] {
    return [
      {
        name: 'model_inference_time',
        baseline: 1000,
        threshold: 5000, // 5 seconds
        unit: 'ms',
        direction: 'lower-is-better',
      },
      {
        name: 'image_processing_time',
        baseline: 500,
        threshold: 2000,
        unit: 'ms',
        direction: 'lower-is-better',
      },
      {
        name: 'polygon_extraction_time',
        baseline: 100,
        threshold: 500,
        unit: 'ms',
        direction: 'lower-is-better',
      },
    ];
  }

  /**
   * Run performance regression test
   */
  static async runRegressionTest<T>(
    testName: string,
    testFunction: (monitor: PerformanceMonitor) => Promise<T> | T,
    benchmarks: PerformanceBenchmark[]
  ): Promise<{ result: T; report: PerformanceReport }> {
    const monitor = new PerformanceMonitor();
    monitor.setBenchmarks(benchmarks);

    // Record initial memory
    monitor.recordMemoryUsage('test_start');

    // Run the test
    const startTime = performance.now();
    const result = await monitor.timeFunction('test_execution_time', async () => {
      return await testFunction(monitor);
    });

    // Record final memory
    monitor.recordMemoryUsage('test_end');

    // Generate report
    const report = monitor.generateReport(testName);

    return {
      result: result.result,
      report,
    };
  }

  /**
   * Compare two performance reports
   */
  static compareReports(baseline: PerformanceReport, current: PerformanceReport): {
    improvements: string[];
    regressions: string[];
    summary: string;
  } {
    const improvements: string[] = [];
    const regressions: string[] = [];

    // Compare metrics by name
    baseline.metrics.forEach(baselineMetric => {
      const currentMetric = current.metrics.find(m => m.name === baselineMetric.name);
      if (!currentMetric) return;

      const benchmark = baseline.benchmarks.find(b => b.name === baselineMetric.name);
      if (!benchmark) return;

      const percentChange = ((currentMetric.value - baselineMetric.value) / baselineMetric.value) * 100;
      const isImprovement = benchmark.direction === 'lower-is-better' 
        ? currentMetric.value < baselineMetric.value
        : currentMetric.value > baselineMetric.value;

      if (Math.abs(percentChange) > 5) { // Only report significant changes
        const message = `${baselineMetric.name}: ${isImprovement ? 'improved' : 'regressed'} by ${Math.abs(percentChange).toFixed(1)}% (${baselineMetric.value}${baselineMetric.unit} → ${currentMetric.value}${currentMetric.unit})`;
        
        if (isImprovement) {
          improvements.push(message);
        } else {
          regressions.push(message);
        }
      }
    });

    const summary = `Performance Comparison: ${improvements.length} improvements, ${regressions.length} regressions`;

    return {
      improvements,
      regressions,
      summary,
    };
  }
}

/**
 * Memory leak detector
 */
export class MemoryLeakDetector {
  private initialMemory: number = 0;
  private samples: number[] = [];
  private sampleInterval: number = 1000; // 1 second

  /**
   * Start monitoring for memory leaks
   */
  startMonitoring(): void {
    this.initialMemory = this.getCurrentMemoryUsage();
    this.samples = [this.initialMemory];
  }

  /**
   * Take a memory sample
   */
  takeSample(): void {
    const current = this.getCurrentMemoryUsage();
    this.samples.push(current);
  }

  /**
   * Detect potential memory leak
   */
  detectLeak(): { 
    hasLeak: boolean; 
    growthRate: number; 
    currentUsage: number; 
    initialUsage: number;
    recommendation: string;
  } {
    if (this.samples.length < 3) {
      return {
        hasLeak: false,
        growthRate: 0,
        currentUsage: this.getCurrentMemoryUsage(),
        initialUsage: this.initialMemory,
        recommendation: 'Insufficient samples for leak detection',
      };
    }

    const currentUsage = this.samples[this.samples.length - 1];
    const growthRate = ((currentUsage - this.initialMemory) / this.initialMemory) * 100;
    
    // Consider it a leak if memory grew by more than 50% and shows consistent growth
    const hasLeak = growthRate > 50 && this.isConsistentGrowth();

    let recommendation = '';
    if (hasLeak) {
      recommendation = 'Potential memory leak detected. Check for: uncleaned event listeners, circular references, cached objects not being released.';
    } else if (growthRate > 20) {
      recommendation = 'High memory usage detected. Consider optimizing data structures or implementing cleanup.';
    } else {
      recommendation = 'Memory usage appears normal.';
    }

    return {
      hasLeak,
      growthRate,
      currentUsage,
      initialUsage: this.initialMemory,
      recommendation,
    };
  }

  /**
   * Check if memory usage shows consistent growth pattern
   */
  private isConsistentGrowth(): boolean {
    if (this.samples.length < 3) return false;

    let increasingCount = 0;
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i] > this.samples[i - 1]) {
        increasingCount++;
      }
    }

    // Consider it consistent growth if 70% of samples show increase
    return (increasingCount / (this.samples.length - 1)) > 0.7;
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    } else if (typeof window !== 'undefined' && (window as any).performance?.memory) {
      return (window as any).performance.memory.usedJSHeapSize;
    }
    return 0;
  }
}

// Global performance monitor for shared use
export const globalPerformanceMonitor = new PerformanceMonitor();