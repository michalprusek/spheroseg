/**
 * Test reporting and metrics utilities for comprehensive test analysis
 */

import { TestPerformanceTracker } from './performanceTestUtils';
import { TestCoverageTracker } from './coverageTestUtils';

// Test report generation utilities
export class TestReportGenerator {
  private static testResults: Map<string, TestResult> = new Map();
  private static suiteResults: Map<string, SuiteResult> = new Map();
  private static startTime: number = Date.now();

  static addTestResult(testName: string, result: TestResult): void {
    this.testResults.set(testName, result);
  }

  static addSuiteResult(suiteName: string, result: SuiteResult): void {
    this.suiteResults.set(suiteName, result);
  }

  static generateComprehensiveReport(): ComprehensiveTestReport {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    const performance = TestPerformanceTracker.getAllMetrics();
    const coverage = TestCoverageTracker.getCoverageReport();

    const testResults = Array.from(this.testResults.entries()).map(([name, result]) => ({
      name,
      ...result,
    }));

    const suiteResults = Array.from(this.suiteResults.entries()).map(([name, result]) => ({
      name,
      ...result,
    }));

    const summary = this.calculateSummary(testResults, suiteResults);

    return {
      summary,
      performance,
      coverage,
      testResults,
      suiteResults,
      metadata: {
        totalDuration,
        generatedAt: new Date().toISOString(),
        environment: this.getEnvironmentInfo(),
      },
    };
  }

  private static calculateSummary(
    testResults: Array<{ name: string } & TestResult>,
    suiteResults: Array<{ name: string } & SuiteResult>
  ): TestSummary {
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.status === 'passed').length;
    const failedTests = testResults.filter(t => t.status === 'failed').length;
    const skippedTests = testResults.filter(t => t.status === 'skipped').length;

    const totalSuites = suiteResults.length;
    const passedSuites = suiteResults.filter(s => s.status === 'passed').length;
    const failedSuites = suiteResults.filter(s => s.status === 'failed').length;

    const avgTestDuration = testResults.length > 0 
      ? testResults.reduce((sum, t) => sum + (t.duration || 0), 0) / testResults.length 
      : 0;

    const slowestTests = testResults
      .filter(t => t.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5)
      .map(t => ({ name: t.name, duration: t.duration! }));

    const flakyTests = testResults
      .filter(t => t.retries && t.retries > 0)
      .map(t => ({ name: t.name, retries: t.retries! }));

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      totalSuites,
      passedSuites,
      failedSuites,
      successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      avgTestDuration,
      slowestTests,
      flakyTests,
    };
  }

  private static getEnvironmentInfo(): EnvironmentInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      env: process.env.NODE_ENV || 'test',
    };
  }

  static generateHtmlReport(report: ComprehensiveTestReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; border-left: 4px solid #007bff; }
        .summary-card.success { border-left-color: #28a745; }
        .summary-card.danger { border-left-color: #dc3545; }
        .summary-card.warning { border-left-color: #ffc107; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .status-passed { color: #28a745; font-weight: bold; }
        .status-failed { color: #dc3545; font-weight: bold; }
        .status-skipped { color: #6c757d; font-weight: bold; }
        .progress-bar { width: 100%; height: 8px; background-color: #e9ecef; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .progress-success { background-color: #28a745; }
        .progress-danger { background-color: #dc3545; }
        .chart { height: 300px; margin: 20px 0; }
        .metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .metric:last-child { border-bottom: none; }
        .metric-name { font-weight: 500; }
        .metric-value { color: #6c757d; }
        .error-details { background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 10px; margin-top: 10px; font-family: monospace; font-size: 0.9em; }
        .coverage-item { margin: 10px 0; }
        .coverage-list { list-style: none; padding: 0; }
        .coverage-list li { padding: 5px 10px; margin: 2px 0; background-color: #e7f3ff; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Report</h1>
            <p>Generated on ${new Date(report.metadata.generatedAt).toLocaleString()}</p>
            <p>Total Duration: ${(report.metadata.totalDuration / 1000).toFixed(2)}s</p>
        </div>

        <div class="summary">
            <div class="summary-card ${report.summary.successRate >= 90 ? 'success' : report.summary.successRate >= 70 ? 'warning' : 'danger'}">
                <h3>Success Rate</h3>
                <div class="progress-bar">
                    <div class="progress-fill ${report.summary.successRate >= 90 ? 'progress-success' : 'progress-danger'}" 
                         style="width: ${report.summary.successRate}%"></div>
                </div>
                <p>${report.summary.successRate.toFixed(1)}%</p>
            </div>
            <div class="summary-card success">
                <h3>Tests Passed</h3>
                <p style="font-size: 2em; margin: 10px 0;">${report.summary.passedTests}</p>
                <p>out of ${report.summary.totalTests} total</p>
            </div>
            <div class="summary-card danger">
                <h3>Tests Failed</h3>
                <p style="font-size: 2em; margin: 10px 0;">${report.summary.failedTests}</p>
                <p>${((report.summary.failedTests / report.summary.totalTests) * 100).toFixed(1)}% failure rate</p>
            </div>
            <div class="summary-card warning">
                <h3>Avg Duration</h3>
                <p style="font-size: 2em; margin: 10px 0;">${report.summary.avgTestDuration.toFixed(0)}ms</p>
                <p>per test</p>
            </div>
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Average Time (ms)</th>
                        <th>Min Time (ms)</th>
                        <th>Max Time (ms)</th>
                        <th>Runs</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(report.performance).map(([name, metrics]) => `
                        <tr>
                            <td>${name}</td>
                            <td>${metrics.average.toFixed(2)}</td>
                            <td>${metrics.min.toFixed(2)}</td>
                            <td>${metrics.max.toFixed(2)}</td>
                            <td>${metrics.runs}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Coverage Report</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                <div class="coverage-item">
                    <h4>Components Tested (${report.coverage.components.length})</h4>
                    <ul class="coverage-list">
                        ${report.coverage.components.map(comp => `<li>${comp}</li>`).join('')}
                    </ul>
                </div>
                <div class="coverage-item">
                    <h4>Functions Tested (${report.coverage.functions.length})</h4>
                    <ul class="coverage-list">
                        ${report.coverage.functions.map(func => `<li>${func}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>

        ${report.summary.slowestTests.length > 0 ? `
        <div class="section">
            <h2>Slowest Tests</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Duration (ms)</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.summary.slowestTests.map(test => `
                        <tr>
                            <td>${test.name}</td>
                            <td>${test.duration.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${report.summary.flakyTests.length > 0 ? `
        <div class="section">
            <h2>Flaky Tests (Required Retries)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Retries</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.summary.flakyTests.map(test => `
                        <tr>
                            <td>${test.name}</td>
                            <td>${test.retries}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="section">
            <h2>Failed Tests</h2>
            ${report.testResults.filter(t => t.status === 'failed').length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Test Name</th>
                            <th>Error Message</th>
                            <th>Duration (ms)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.testResults.filter(t => t.status === 'failed').map(test => `
                            <tr>
                                <td>${test.name}</td>
                                <td>
                                    ${test.error || 'Unknown error'}
                                    ${test.stack ? `<div class="error-details">${test.stack}</div>` : ''}
                                </td>
                                <td>${test.duration?.toFixed(2) || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p>No failed tests 🎉</p>'}
        </div>

        <div class="section">
            <h2>Environment Information</h2>
            <div class="metric">
                <span class="metric-name">Node Version:</span>
                <span class="metric-value">${report.metadata.environment.nodeVersion}</span>
            </div>
            <div class="metric">
                <span class="metric-name">Platform:</span>
                <span class="metric-value">${report.metadata.environment.platform} (${report.metadata.environment.arch})</span>
            </div>
            <div class="metric">
                <span class="metric-name">Environment:</span>
                <span class="metric-value">${report.metadata.environment.env}</span>
            </div>
            <div class="metric">
                <span class="metric-name">Memory Usage:</span>
                <span class="metric-value">${(report.metadata.environment.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB</span>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  static generateJsonReport(report: ComprehensiveTestReport): string {
    return JSON.stringify(report, null, 2);
  }

  static generateJunitXml(report: ComprehensiveTestReport): string {
    const timestamp = new Date(report.metadata.generatedAt).toISOString();
    const duration = (report.metadata.totalDuration / 1000).toFixed(3);

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="SpherosegV4 Test Suite" tests="${report.summary.totalTests}" failures="${report.summary.failedTests}" skipped="${report.summary.skippedTests}" time="${duration}" timestamp="${timestamp}">
${Array.from(this.suiteResults.entries()).map(([suiteName, suite]) => `
  <testsuite name="${suiteName}" tests="${suite.testCount}" failures="${suite.failedCount}" skipped="${suite.skippedCount}" time="${((suite.duration || 0) / 1000).toFixed(3)}">
${report.testResults.filter(t => t.suiteName === suiteName).map(test => `
    <testcase name="${test.name}" classname="${suiteName}" time="${((test.duration || 0) / 1000).toFixed(3)}">
${test.status === 'failed' ? `
      <failure message="${test.error || 'Test failed'}" type="AssertionError">
        <![CDATA[${test.stack || test.error || 'No stack trace available'}]]>
      </failure>
` : ''}${test.status === 'skipped' ? `
      <skipped message="Test skipped"/>
` : ''}
    </testcase>
`).join('')}
  </testsuite>
`).join('')}
</testsuites>`;
  }

  static reset(): void {
    this.testResults.clear();
    this.suiteResults.clear();
    this.startTime = Date.now();
  }
}

// Test metrics collection
export class TestMetricsCollector {
  private static metrics: TestMetrics = {
    assertions: 0,
    apiCalls: 0,
    domQueries: 0,
    rerenders: 0,
    memoryLeaks: 0,
    slowQueries: 0,
    coverage: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    }
  };

  static incrementAssertion(): void {
    this.metrics.assertions++;
  }

  static incrementApiCall(): void {
    this.metrics.apiCalls++;
  }

  static incrementDomQuery(): void {
    this.metrics.domQueries++;
  }

  static incrementRerender(): void {
    this.metrics.rerenders++;
  }

  static incrementMemoryLeak(): void {
    this.metrics.memoryLeaks++;
  }

  static incrementSlowQuery(): void {
    this.metrics.slowQueries++;
  }

  static updateCoverage(coverage: Partial<CoverageData>): void {
    this.metrics.coverage = { ...this.metrics.coverage, ...coverage };
  }

  static getMetrics(): TestMetrics {
    return { ...this.metrics };
  }

  static reset(): void {
    this.metrics = {
      assertions: 0,
      apiCalls: 0,
      domQueries: 0,
      rerenders: 0,
      memoryLeaks: 0,
      slowQueries: 0,
      coverage: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      }
    };
  }
}

// Real-time test monitoring
export class TestMonitor {
  private static listeners: Set<TestMonitorListener> = new Set();
  private static isRunning = false;

  static addListener(listener: TestMonitorListener): void {
    this.listeners.add(listener);
  }

  static removeListener(listener: TestMonitorListener): void {
    this.listeners.delete(listener);
  }

  static onTestStart(testName: string): void {
    this.isRunning = true;
    this.listeners.forEach(listener => listener.onTestStart?.(testName));
  }

  static onTestEnd(testName: string, result: TestResult): void {
    this.listeners.forEach(listener => listener.onTestEnd?.(testName, result));
    TestReportGenerator.addTestResult(testName, result);
  }

  static onSuiteStart(suiteName: string): void {
    this.listeners.forEach(listener => listener.onSuiteStart?.(suiteName));
  }

  static onSuiteEnd(suiteName: string, result: SuiteResult): void {
    this.listeners.forEach(listener => listener.onSuiteEnd?.(suiteName, result));
    TestReportGenerator.addSuiteResult(suiteName, result);
  }

  static onError(error: Error, context?: string): void {
    this.listeners.forEach(listener => listener.onError?.(error, context));
  }

  static isTestRunning(): boolean {
    return this.isRunning;
  }

  static stop(): void {
    this.isRunning = false;
    this.listeners.forEach(listener => listener.onStop?.());
  }
}

// Types
export interface TestResult {
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  stack?: string;
  retries?: number;
  suiteName?: string;
}

export interface SuiteResult {
  status: 'passed' | 'failed';
  duration?: number;
  testCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  successRate: number;
  avgTestDuration: number;
  slowestTests: Array<{ name: string; duration: number }>;
  flakyTests: Array<{ name: string; retries: number }>;
}

export interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  env: string;
}

export interface ComprehensiveTestReport {
  summary: TestSummary;
  performance: Record<string, { average: number; runs: number; min: number; max: number }>;
  coverage: {
    components: string[];
    functions: string[];
    propCoverage: Record<string, string[]>;
    stateCoverage: Record<string, string[]>;
    interactionCoverage: Record<string, string[]>;
  };
  testResults: Array<{ name: string } & TestResult>;
  suiteResults: Array<{ name: string } & SuiteResult>;
  metadata: {
    totalDuration: number;
    generatedAt: string;
    environment: EnvironmentInfo;
  };
}

export interface CoverageData {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface TestMetrics {
  assertions: number;
  apiCalls: number;
  domQueries: number;
  rerenders: number;
  memoryLeaks: number;
  slowQueries: number;
  coverage: CoverageData;
}

export interface TestMonitorListener {
  onTestStart?(testName: string): void;
  onTestEnd?(testName: string, result: TestResult): void;
  onSuiteStart?(suiteName: string): void;
  onSuiteEnd?(suiteName: string, result: SuiteResult): void;
  onError?(error: Error, context?: string): void;
  onStop?(): void;
}

export default {
  TestReportGenerator,
  TestMetricsCollector,
  TestMonitor,
};