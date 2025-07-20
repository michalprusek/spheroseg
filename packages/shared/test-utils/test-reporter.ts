/**
 * Enhanced Test Reporter Utility
 * Provides standardized test result reporting and analysis across all services
 */

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  error?: string;
  suite: string;
  service: 'frontend' | 'backend' | 'ml';
}

export interface TestSuiteResult {
  service: string;
  suite: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestResult[];
}

export interface TestReport {
  timestamp: string;
  services: TestSuiteResult[];
  summary: {
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
    successRate: number;
    totalDuration: number;
  };
}

export class TestReporter {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  /**
   * Record a test result
   */
  recordTest(result: TestResult): void {
    this.results.push({
      ...result,
      duration: result.duration || 0
    });
  }

  /**
   * Record multiple test results
   */
  recordTests(results: TestResult[]): void {
    results.forEach(result => this.recordTest(result));
  }

  /**
   * Generate comprehensive test report
   */
  generateReport(): TestReport {
    const serviceGroups = this.groupByService();
    const summary = this.calculateSummary();

    return {
      timestamp: new Date().toISOString(),
      services: serviceGroups,
      summary,
    };
  }

  /**
   * Group test results by service
   */
  private groupByService(): TestSuiteResult[] {
    const services = [...new Set(this.results.map(r => r.service))];
    
    return services.map(service => {
      const serviceTests = this.results.filter(r => r.service === service);
      const suites = [...new Set(serviceTests.map(r => r.suite))];
      
      return suites.map(suite => {
        const suiteTests = serviceTests.filter(r => r.suite === suite);
        return {
          service,
          suite,
          total: suiteTests.length,
          passed: suiteTests.filter(t => t.status === 'passed').length,
          failed: suiteTests.filter(t => t.status === 'failed').length,
          skipped: suiteTests.filter(t => t.status === 'skipped').length,
          duration: suiteTests.reduce((sum, t) => sum + t.duration, 0),
          tests: suiteTests,
        };
      });
    }).flat();
  }

  /**
   * Calculate overall summary statistics
   */
  private calculateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const duration = Date.now() - this.startTime;

    return {
      totalTests: total,
      totalPassed: passed,
      totalFailed: failed,
      totalSkipped: skipped,
      successRate: total > 0 ? (passed / total) * 100 : 0,
      totalDuration: duration,
    };
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(): string {
    const report = this.generateReport();
    const { summary } = report;

    let markdown = `# Test Execution Report\n\n`;
    markdown += `**Generated**: ${report.timestamp}\n\n`;
    
    // Summary table
    markdown += `## Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Tests | ${summary.totalTests} |\n`;
    markdown += `| Passed | ${summary.totalPassed} |\n`;
    markdown += `| Failed | ${summary.totalFailed} |\n`;
    markdown += `| Skipped | ${summary.totalSkipped} |\n`;
    markdown += `| Success Rate | ${summary.successRate.toFixed(1)}% |\n`;
    markdown += `| Duration | ${summary.totalDuration}ms |\n\n`;

    // Service breakdown
    markdown += `## Service Breakdown\n\n`;
    report.services.forEach(service => {
      const successRate = service.total > 0 ? (service.passed / service.total) * 100 : 0;
      markdown += `### ${service.service} - ${service.suite}\n\n`;
      markdown += `- **Total**: ${service.total}\n`;
      markdown += `- **Passed**: ${service.passed}\n`;
      markdown += `- **Failed**: ${service.failed}\n`;
      markdown += `- **Success Rate**: ${successRate.toFixed(1)}%\n`;
      markdown += `- **Duration**: ${service.duration}ms\n\n`;

      if (service.failed > 0) {
        markdown += `#### Failed Tests\n\n`;
        service.tests.filter(t => t.status === 'failed').forEach(test => {
          markdown += `- **${test.name}**: ${test.error || 'No error message'}\n`;
        });
        markdown += `\n`;
      }
    });

    return markdown;
  }

  /**
   * Generate JSON report for CI/CD integration
   */
  generateJSONReport(): string {
    return JSON.stringify(this.generateReport(), null, 2);
  }

  /**
   * Clear all recorded results
   */
  clear(): void {
    this.results = [];
    this.startTime = Date.now();
  }

  /**
   * Get current test count by status
   */
  getStats() {
    return {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'passed').length,
      failed: this.results.filter(r => r.status === 'failed').length,
      skipped: this.results.filter(r => r.status === 'skipped').length,
    };
  }
}

// Singleton instance for global use
export const globalTestReporter = new TestReporter();

/**
 * Utility function to time test execution
 */
export function timeTest<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  
  const executeAndTime = async () => {
    try {
      const result = await fn();
      const duration = Date.now() - start;
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - start;
      throw { error, duration };
    }
  };

  return executeAndTime();
}

/**
 * Test result analyzer for identifying patterns
 */
export class TestAnalyzer {
  static analyzeFailurePatterns(results: TestResult[]): string[] {
    const failedTests = results.filter(r => r.status === 'failed');
    const patterns: string[] = [];

    // Analyze error patterns
    const errorTypes = new Map<string, number>();
    failedTests.forEach(test => {
      if (test.error) {
        const errorType = this.categorizeError(test.error);
        errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
      }
    });

    // Report common patterns
    for (const [errorType, count] of errorTypes.entries()) {
      if (count > 1) {
        patterns.push(`${errorType}: ${count} occurrences`);
      }
    }

    return patterns;
  }

  private static categorizeError(error: string): string {
    if (error.includes('TypeError')) return 'Type Error';
    if (error.includes('ReferenceError')) return 'Reference Error';
    if (error.includes('AssertionError')) return 'Assertion Failure';
    if (error.includes('timeout')) return 'Timeout';
    if (error.includes('network') || error.includes('connection')) return 'Network Issue';
    if (error.includes('mock') || error.includes('Mock')) return 'Mock Issue';
    return 'Other';
  }

  static identifySlowTests(results: TestResult[], threshold: number = 1000): TestResult[] {
    return results.filter(r => r.duration > threshold).sort((a, b) => b.duration - a.duration);
  }

  static calculateServiceHealth(results: TestResult[]): Record<string, number> {
    const services = [...new Set(results.map(r => r.service))];
    const health: Record<string, number> = {};

    services.forEach(service => {
      const serviceTests = results.filter(r => r.service === service);
      const passed = serviceTests.filter(r => r.status === 'passed').length;
      health[service] = serviceTests.length > 0 ? (passed / serviceTests.length) * 100 : 0;
    });

    return health;
  }
}