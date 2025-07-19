/**
 * Test health monitoring system for automated test quality analysis
 */

import { TestPerformanceTracker } from './performanceTestUtils';
import { TestCoverageTracker } from './coverageTestUtils';

// Test health metrics
export interface TestHealthMetrics {
  performance: PerformanceHealth;
  coverage: CoverageHealth;
  reliability: ReliabilityHealth;
  maintainability: MaintainabilityHealth;
  overall: OverallHealth;
}

export interface PerformanceHealth {
  score: number; // 0-100
  avgTestDuration: number;
  slowTests: Array<{ name: string; duration: number }>;
  memoryUsage: number;
  trends: {
    improving: boolean;
    deteriorating: boolean;
    stable: boolean;
  };
}

export interface CoverageHealth {
  score: number; // 0-100
  componentsCovered: number;
  totalComponents: number;
  functionsCovered: number;
  totalFunctions: number;
  missingCoverage: string[];
}

export interface ReliabilityHealth {
  score: number; // 0-100
  flakyTests: Array<{ name: string; failureRate: number }>;
  errorRate: number;
  successRate: number;
  retryRate: number;
}

export interface MaintainabilityHealth {
  score: number; // 0-100
  duplicatedCode: number;
  complexTests: Array<{ name: string; complexity: number }>;
  outdatedMocks: number;
  testSmells: Array<{ type: string; count: number }>;
}

export interface OverallHealth {
  score: number; // 0-100
  status: 'excellent' | 'good' | 'warning' | 'critical';
  recommendations: string[];
  trends: {
    weekOverWeek: number;
    monthOverMonth: number;
  };
}

// Test health monitor
export class TestHealthMonitor {
  private static instance: TestHealthMonitor;
  private metrics: TestHealthMetrics[] = [];
  private observers: TestHealthObserver[] = [];

  static getInstance(): TestHealthMonitor {
    if (!this.instance) {
      this.instance = new TestHealthMonitor();
    }
    return this.instance;
  }

  addObserver(observer: TestHealthObserver): void {
    this.observers.push(observer);
  }

  removeObserver(observer: TestHealthObserver): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  private notifyObservers(metrics: TestHealthMetrics): void {
    this.observers.forEach(observer => observer.onHealthUpdate(metrics));
  }

  collectMetrics(): TestHealthMetrics {
    const performance = this.calculatePerformanceHealth();
    const coverage = this.calculateCoverageHealth();
    const reliability = this.calculateReliabilityHealth();
    const maintainability = this.calculateMaintainabilityHealth();
    const overall = this.calculateOverallHealth(performance, coverage, reliability, maintainability);

    const metrics: TestHealthMetrics = {
      performance,
      coverage,
      reliability,
      maintainability,
      overall,
    };

    this.metrics.push(metrics);
    this.notifyObservers(metrics);

    return metrics;
  }

  private calculatePerformanceHealth(): PerformanceHealth {
    const performanceMetrics = TestPerformanceTracker.getAllMetrics();
    const testTimes = Object.values(performanceMetrics).map(m => m.average);
    
    const avgTestDuration = testTimes.length > 0 
      ? testTimes.reduce((sum, time) => sum + time, 0) / testTimes.length 
      : 0;

    const slowTests = Object.entries(performanceMetrics)
      .filter(([_, metrics]) => metrics.average > 1000) // > 1 second
      .map(([name, metrics]) => ({ name, duration: metrics.average }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    // Performance score based on average test time
    let score = 100;
    if (avgTestDuration > 2000) score = 20; // Very slow
    else if (avgTestDuration > 1000) score = 40; // Slow
    else if (avgTestDuration > 500) score = 60; // Moderate
    else if (avgTestDuration > 200) score = 80; // Good
    else score = 100; // Excellent

    const memoryUsage = this.getMemoryUsage();
    const trends = this.calculatePerformanceTrends();

    return {
      score,
      avgTestDuration,
      slowTests,
      memoryUsage,
      trends,
    };
  }

  private calculateCoverageHealth(): CoverageHealth {
    const coverage = TestCoverageTracker.getCoverageReport();
    
    const componentsCovered = coverage.components.length;
    const totalComponents = this.estimateTotalComponents();
    const functionsCovered = coverage.functions.length;
    const totalFunctions = this.estimateTotalFunctions();

    const componentCoveragePercent = totalComponents > 0 
      ? (componentsCovered / totalComponents) * 100 
      : 0;

    const functionCoveragePercent = totalFunctions > 0 
      ? (functionsCovered / totalFunctions) * 100 
      : 0;

    const score = (componentCoveragePercent + functionCoveragePercent) / 2;

    const missingCoverage = this.identifyMissingCoverage();

    return {
      score,
      componentsCovered,
      totalComponents,
      functionsCovered,
      totalFunctions,
      missingCoverage,
    };
  }

  private calculateReliabilityHealth(): ReliabilityHealth {
    // Simulate reliability metrics (in real implementation, this would track actual test runs)
    const flakyTests = this.identifyFlakyTests();
    const errorRate = this.calculateErrorRate();
    const successRate = 100 - errorRate;
    const retryRate = this.calculateRetryRate();

    let score = 100;
    if (errorRate > 20) score = 20;
    else if (errorRate > 10) score = 40;
    else if (errorRate > 5) score = 60;
    else if (errorRate > 2) score = 80;
    else score = 100;

    return {
      score,
      flakyTests,
      errorRate,
      successRate,
      retryRate,
    };
  }

  private calculateMaintainabilityHealth(): MaintainabilityHealth {
    const duplicatedCode = this.detectDuplicatedTestCode();
    const complexTests = this.identifyComplexTests();
    const outdatedMocks = this.detectOutdatedMocks();
    const testSmells = this.detectTestSmells();

    let score = 100;
    
    // Deduct points for maintainability issues
    if (duplicatedCode > 30) score -= 30;
    else if (duplicatedCode > 20) score -= 20;
    else if (duplicatedCode > 10) score -= 10;

    if (complexTests.length > 10) score -= 20;
    else if (complexTests.length > 5) score -= 10;

    if (outdatedMocks > 20) score -= 25;
    else if (outdatedMocks > 10) score -= 15;

    testSmells.forEach(smell => {
      score -= Math.min(smell.count * 2, 20);
    });

    score = Math.max(score, 0);

    return {
      score,
      duplicatedCode,
      complexTests,
      outdatedMocks,
      testSmells,
    };
  }

  private calculateOverallHealth(
    performance: PerformanceHealth,
    coverage: CoverageHealth,
    reliability: ReliabilityHealth,
    maintainability: MaintainabilityHealth
  ): OverallHealth {
    // Weighted average of all health scores
    const weights = {
      performance: 0.25,
      coverage: 0.30,
      reliability: 0.30,
      maintainability: 0.15,
    };

    const score = Math.round(
      performance.score * weights.performance +
      coverage.score * weights.coverage +
      reliability.score * weights.reliability +
      maintainability.score * weights.maintainability
    );

    let status: 'excellent' | 'good' | 'warning' | 'critical';
    if (score >= 90) status = 'excellent';
    else if (score >= 75) status = 'good';
    else if (score >= 60) status = 'warning';
    else status = 'critical';

    const recommendations = this.generateRecommendations(
      performance, coverage, reliability, maintainability
    );

    const trends = this.calculateOverallTrends();

    return {
      score,
      status,
      recommendations,
      trends,
    };
  }

  private generateRecommendations(
    performance: PerformanceHealth,
    coverage: CoverageHealth,
    reliability: ReliabilityHealth,
    maintainability: MaintainabilityHealth
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (performance.score < 60) {
      recommendations.push('Optimize slow tests - consider mocking heavy operations');
      if (performance.slowTests.length > 0) {
        recommendations.push(`Focus on optimizing: ${performance.slowTests[0].name}`);
      }
    }

    // Coverage recommendations
    if (coverage.score < 70) {
      recommendations.push('Increase test coverage - aim for 80% component coverage');
      if (coverage.missingCoverage.length > 0) {
        recommendations.push(`Add tests for: ${coverage.missingCoverage.slice(0, 3).join(', ')}`);
      }
    }

    // Reliability recommendations
    if (reliability.score < 70) {
      recommendations.push('Fix flaky tests to improve reliability');
      if (reliability.flakyTests.length > 0) {
        recommendations.push(`Investigate flaky test: ${reliability.flakyTests[0].name}`);
      }
    }

    // Maintainability recommendations
    if (maintainability.score < 70) {
      recommendations.push('Refactor complex tests and remove code duplication');
      if (maintainability.duplicatedCode > 20) {
        recommendations.push('Extract common test utilities to reduce duplication');
      }
    }

    return recommendations;
  }

  // Helper methods (simplified implementations)
  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private calculatePerformanceTrends(): { improving: boolean; deteriorating: boolean; stable: boolean } {
    // Simplified trend calculation
    const recentMetrics = this.metrics.slice(-5);
    if (recentMetrics.length < 2) {
      return { improving: false, deteriorating: false, stable: true };
    }

    const trend = recentMetrics[recentMetrics.length - 1].performance.avgTestDuration - 
                  recentMetrics[0].performance.avgTestDuration;

    return {
      improving: trend < -100, // 100ms improvement
      deteriorating: trend > 100, // 100ms deterioration
      stable: Math.abs(trend) <= 100,
    };
  }

  private estimateTotalComponents(): number {
    // Simplified estimation - in real implementation, scan project files
    return 150;
  }

  private estimateTotalFunctions(): number {
    // Simplified estimation - in real implementation, scan project files
    return 500;
  }

  private identifyMissingCoverage(): string[] {
    // Simplified implementation - in real implementation, analyze code coverage
    return ['UserProfile.tsx', 'ImageUpload.tsx', 'SegmentationViewer.tsx'];
  }

  private identifyFlakyTests(): Array<{ name: string; failureRate: number }> {
    // Simplified implementation - in real implementation, track test history
    return [
      { name: 'user-authentication-flow', failureRate: 15 },
      { name: 'image-upload-integration', failureRate: 8 },
    ];
  }

  private calculateErrorRate(): number {
    // Simplified implementation - in real implementation, track actual test results
    return Math.random() * 10; // 0-10% error rate
  }

  private calculateRetryRate(): number {
    // Simplified implementation
    return Math.random() * 5; // 0-5% retry rate
  }

  private detectDuplicatedTestCode(): number {
    // Simplified implementation - in real implementation, analyze test files
    return Math.floor(Math.random() * 40); // 0-40% duplication
  }

  private identifyComplexTests(): Array<{ name: string; complexity: number }> {
    // Simplified implementation
    return [
      { name: 'complex-integration-test', complexity: 15 },
      { name: 'end-to-end-workflow', complexity: 12 },
    ];
  }

  private detectOutdatedMocks(): number {
    // Simplified implementation
    return Math.floor(Math.random() * 25);
  }

  private detectTestSmells(): Array<{ type: string; count: number }> {
    // Simplified implementation
    return [
      { type: 'Long test methods', count: 8 },
      { type: 'Hard-coded values', count: 15 },
      { type: 'Missing assertions', count: 3 },
    ];
  }

  private calculateOverallTrends(): { weekOverWeek: number; monthOverMonth: number } {
    // Simplified trend calculation
    return {
      weekOverWeek: Math.random() * 10 - 5, // -5% to +5%
      monthOverMonth: Math.random() * 20 - 10, // -10% to +10%
    };
  }

  generateHealthReport(): string {
    const metrics = this.collectMetrics();
    
    return `
# Test Health Report
Generated: ${new Date().toISOString()}

## Overall Health: ${metrics.overall.status.toUpperCase()} (${metrics.overall.score}/100)

### Performance Health: ${metrics.performance.score}/100
- Average test duration: ${metrics.performance.avgTestDuration.toFixed(2)}ms
- Memory usage: ${metrics.performance.memoryUsage.toFixed(2)}MB
- Slow tests: ${metrics.performance.slowTests.length}

### Coverage Health: ${metrics.coverage.score}/100
- Components covered: ${metrics.coverage.componentsCovered}/${metrics.coverage.totalComponents}
- Functions covered: ${metrics.coverage.functionsCovered}/${metrics.coverage.totalFunctions}

### Reliability Health: ${metrics.reliability.score}/100
- Success rate: ${metrics.reliability.successRate.toFixed(1)}%
- Flaky tests: ${metrics.reliability.flakyTests.length}

### Maintainability Health: ${metrics.maintainability.score}/100
- Code duplication: ${metrics.maintainability.duplicatedCode}%
- Complex tests: ${metrics.maintainability.complexTests.length}
- Test smells: ${metrics.maintainability.testSmells.reduce((sum, smell) => sum + smell.count, 0)}

## Recommendations
${metrics.overall.recommendations.map(rec => `- ${rec}`).join('\n')}

## Trends
- Week over week: ${metrics.overall.trends.weekOverWeek > 0 ? '+' : ''}${metrics.overall.trends.weekOverWeek.toFixed(1)}%
- Month over month: ${metrics.overall.trends.monthOverMonth > 0 ? '+' : ''}${metrics.overall.trends.monthOverMonth.toFixed(1)}%
    `;
  }

  getLatestMetrics(): TestHealthMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(): TestHealthMetrics[] {
    return [...this.metrics];
  }

  reset(): void {
    this.metrics = [];
  }
}

// Test health observer interface
export interface TestHealthObserver {
  onHealthUpdate(metrics: TestHealthMetrics): void;
}

// Console health observer
export class ConsoleHealthObserver implements TestHealthObserver {
  onHealthUpdate(metrics: TestHealthMetrics): void {
    console.log(`🏥 Test Health Update: ${metrics.overall.status.toUpperCase()} (${metrics.overall.score}/100)`);
    
    if (metrics.overall.status === 'critical' || metrics.overall.status === 'warning') {
      console.warn('⚠️ Test health issues detected:');
      metrics.overall.recommendations.forEach(rec => {
        console.warn(`  - ${rec}`);
      });
    }
  }
}

// File health observer
export class FileHealthObserver implements TestHealthObserver {
  constructor(private filePath: string) {}

  onHealthUpdate(metrics: TestHealthMetrics): void {
    const monitor = TestHealthMonitor.getInstance();
    const report = monitor.generateHealthReport();
    
    // In a real implementation, this would write to a file
    console.log(`📄 Health report would be saved to: ${this.filePath}`);
  }
}

export default {
  TestHealthMonitor,
  ConsoleHealthObserver,
  FileHealthObserver,
};