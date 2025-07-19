/**
 * Integration test demonstrating advanced test utilities in action
 * 
 * This test showcases how to use all our advanced testing utilities together
 * for comprehensive test quality monitoring and performance benchmarking.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Import all our advanced test utilities
import {
  AdvancedTestDataFactory,
  renderWithProviders,
  AdvancedMockBuilder,
  TestScenarioBuilder,
  TestTimingUtils,
  AdvancedAssertions,
} from '../advancedTestFactories';
import {
  PerformanceBenchmarks,
  MemoryBenchmarks,
  BenchmarkSuiteRunner,
  benchmark,
  benchmarkTest,
} from '../performanceBenchmarks';
import {
  TestHealthMonitor,
  ConsoleHealthObserver,
  FileHealthObserver,
} from '../testHealthMonitor';

// Example component to test with
const TestComponent: React.FC<{ user?: any; onAction?: () => void }> = ({ 
  user, 
  onAction 
}) => {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any[]>([]);

  const handleClick = async () => {
    if (onAction) {
      setLoading(true);
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));
      setData([{ id: 1, name: 'Test Item' }]);
      onAction();
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Test Component</h1>
      {user && <div data-testid="user-name">{user.username}</div>}
      <button 
        data-testid="action-button" 
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Click Me'}
      </button>
      {data.length > 0 && (
        <ul data-testid="data-list">
          {data.map(item => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

describe('Advanced Test Utilities Integration', () => {
  let healthMonitor: TestHealthMonitor;
  let suiteRunner: BenchmarkSuiteRunner;

  beforeAll(async () => {
    // Initialize health monitoring
    healthMonitor = TestHealthMonitor.getInstance();
    healthMonitor.addObserver(new ConsoleHealthObserver());
    healthMonitor.addObserver(new FileHealthObserver('./test-health-report.md'));

    // Initialize performance benchmarks
    PerformanceBenchmarks.initializeStandardBenchmarks();
    
    // Setup benchmark suite
    suiteRunner = new BenchmarkSuiteRunner();
    suiteRunner.addSuite('component-tests', [
      PerformanceBenchmarks.getBenchmark('component-render-basic')!,
      PerformanceBenchmarks.getBenchmark('user-click-response')!,
      PerformanceBenchmarks.getBenchmark('test-setup-teardown')!,
    ]);
  });

  beforeEach(() => {
    // Reset test data sequences for consistent data
    AdvancedTestDataFactory.resetSequence();
    
    // Clear any previous benchmark results
    PerformanceBenchmarks.clearResults();
  });

  afterAll(() => {
    // Generate final health report
    const report = healthMonitor.generateHealthReport();
    console.log('\n📊 Final Test Health Report:', report);
    
    // Reset health monitor
    healthMonitor.reset();
  });

  describe('Data Factory Integration', () => {
    it('should create consistent test data', async () => {
      return benchmarkTest('test-setup-teardown', async () => {
        // Create test data using factories
        const user1 = AdvancedTestDataFactory.createUser({
          username: 'testuser1',
          email: 'user1@test.com',
        });

        const user2 = AdvancedTestDataFactory.createUser({
          username: 'testuser2',
          email: 'user2@test.com',
        });

        // Verify unique sequences
        expect(user1.id).toBe('user-1');
        expect(user2.id).toBe('user-2');
        expect(user1.username).toBe('testuser1');
        expect(user2.username).toBe('testuser2');

        // Create API response
        const apiResponse = AdvancedTestDataFactory.createApiResponse(user1);
        expect(apiResponse.data).toEqual(user1);
        expect(apiResponse.status).toBe(200);
        expect(apiResponse.message).toBe('Success');
      });
    });

    it('should handle form data creation', async () => {
      const mockFile = AdvancedTestDataFactory.createMockFile('test.jpg', 'image/jpeg', 2048);
      const formData = AdvancedTestDataFactory.createFormData({
        name: 'Test Project',
        description: 'Test Description',
        image: mockFile,
      });

      expect(formData.get('name')).toBe('Test Project');
      expect(formData.get('description')).toBe('Test Description');
      expect(formData.get('image')).toBeInstanceOf(File);
    });
  });

  describe('Enhanced Rendering with Providers', () => {
    it('should render with multiple providers', async () => {
      return benchmarkTest('component-render-basic', async () => {
        const testUser = AdvancedTestDataFactory.createUser();
        
        renderWithProviders(
          <TestComponent user={testUser} />,
          {
            routerProps: { initialEntries: ['/test'] },
            withAuth: true,
            authUser: testUser,
            withTheme: true,
            theme: 'dark',
            withLanguage: true,
            language: 'en',
          }
        );

        // Verify component renders with providers
        expect(screen.getByText('Test Component')).toBeInTheDocument();
        expect(screen.getByTestId('user-name')).toHaveTextContent(testUser.username);

        // Verify providers are present
        expect(screen.getByTestId('mock-auth-provider')).toBeInTheDocument();
        expect(screen.getByTestId('mock-theme-provider')).toHaveAttribute('data-theme', 'dark');
        expect(screen.getByTestId('mock-language-provider')).toHaveAttribute('data-language', 'en');
      });
    });
  });

  describe('Performance Benchmarking', () => {
    it('should benchmark user interactions', async () => {
      return benchmarkTest('user-click-response', async () => {
        const mockAction = AdvancedMockBuilder.createApiClientMock();
        let actionCalled = false;

        renderWithProviders(
          <TestComponent onAction={() => { actionCalled = true; }} />
        );

        const button = screen.getByTestId('action-button');
        
        // Use performance assertion
        await AdvancedAssertions.expectPerformanceWithinThreshold(
          async () => {
            fireEvent.click(button);
            await waitFor(() => {
              expect(actionCalled).toBe(true);
            });
          },
          200 // Should complete within 200ms
        );

        // Verify the interaction worked
        expect(screen.getByTestId('data-list')).toBeInTheDocument();
      });
    });

    it('should track memory usage during test', async () => {
      const beforeSnapshot = MemoryBenchmarks.takeSnapshot('test-start');
      
      // Perform memory-intensive operation
      const largeArray = Array.from({ length: 1000 }, (_, i) => 
        AdvancedTestDataFactory.createUser({ id: `user-${i}` })
      );

      const afterSnapshot = MemoryBenchmarks.takeSnapshot('test-end');
      const comparison = MemoryBenchmarks.compareSnapshots('test-start', 'test-end');

      expect(comparison.heapUsedDiff).toBeGreaterThan(0);
      expect(comparison.leakDetected).toBe(false); // Should not leak memory
      expect(largeArray).toHaveLength(1000);

      MemoryBenchmarks.clearSnapshots();
    });
  });

  describe('Advanced Assertions', () => {
    it('should validate accessibility', async () => {
      renderWithProviders(<TestComponent />);

      const button = screen.getByTestId('action-button');
      
      // Use advanced accessibility assertions
      AdvancedAssertions.expectElementToBeVisible(button);
      AdvancedAssertions.expectElementToHaveCorrectAccessibility(button);
    });

    it('should validate API call patterns', async () => {
      const mockApiClient = AdvancedMockBuilder.createApiClientMock();
      
      // Simulate API call
      await mockApiClient.get('/api/users/123');

      // Use advanced API assertion
      AdvancedAssertions.expectApiCallToMatchPattern(mockApiClient.get, {
        url: '/api/users/123',
      });
    });
  });

  describe('Test Scenario Builder', () => {
    it('should execute complex test scenarios', async () => {
      return benchmarkTest('user-click-response', async () => {
        const testUser = AdvancedTestDataFactory.createUser();
        let componentRendered = false;
        let userInteractionCompleted = false;
        let assertionsPassed = false;

        const scenario = new TestScenarioBuilder()
          .scenario('Complex User Interaction Flow')
          .setup(async () => {
            renderWithProviders(<TestComponent user={testUser} onAction={() => { userInteractionCompleted = true; }} />);
            componentRendered = true;
          })
          .action(async () => {
            const button = screen.getByTestId('action-button');
            fireEvent.click(button);
            await TestTimingUtils.waitForCondition(() => userInteractionCompleted, 1000);
          })
          .assert(async () => {
            expect(componentRendered).toBe(true);
            expect(userInteractionCompleted).toBe(true);
            expect(screen.getByTestId('data-list')).toBeInTheDocument();
            assertionsPassed = true;
          });

        await scenario.execute();
        expect(assertionsPassed).toBe(true);
      });
    });
  });

  describe('Test Health Monitoring', () => {
    it('should collect and analyze test health metrics', async () => {
      // Collect current health metrics
      const metrics = healthMonitor.collectMetrics();

      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('coverage');
      expect(metrics).toHaveProperty('reliability');
      expect(metrics).toHaveProperty('maintainability');
      expect(metrics).toHaveProperty('overall');

      // Verify metrics structure
      expect(metrics.performance.score).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.score).toBeLessThanOrEqual(100);
      expect(metrics.overall.status).toMatch(/excellent|good|warning|critical/);
      expect(Array.isArray(metrics.overall.recommendations)).toBe(true);

      console.log('📊 Test Health Metrics:', {
        performance: metrics.performance.score,
        coverage: metrics.coverage.score,
        reliability: metrics.reliability.score,
        maintainability: metrics.maintainability.score,
        overall: metrics.overall.score,
        status: metrics.overall.status,
      });
    });
  });

  describe('Benchmark Suite Execution', () => {
    it('should run complete benchmark suite', async () => {
      const testFunctions = new Map([
        ['component-render-basic', async () => {
          renderWithProviders(<TestComponent />);
        }],
        ['user-click-response', async () => {
          renderWithProviders(<TestComponent onAction={() => {}} />);
          const button = screen.getByTestId('action-button');
          fireEvent.click(button);
        }],
        ['test-setup-teardown', async () => {
          AdvancedTestDataFactory.createUser();
        }],
      ]);

      const results = await suiteRunner.runSuite('component-tests', testFunctions);

      expect(results.name).toBe('component-tests');
      expect(results.results).toHaveLength(3);
      expect(['pass', 'warning', 'fail']).toContain(results.overallStatus);

      // Generate and log report
      const report = suiteRunner.generateReport('component-tests');
      console.log('\n📈 Benchmark Suite Report:', report);
    });
  });

  describe('Timing Utilities', () => {
    it('should handle async timing operations', async () => {
      let conditionMet = false;

      // Set condition after delay
      setTimeout(() => {
        conditionMet = true;
      }, 500);

      // Wait for condition using utility
      await TestTimingUtils.waitForCondition(
        () => conditionMet,
        1000, // timeout
        100   // polling interval
      );

      expect(conditionMet).toBe(true);
    });

    it('should debounce function calls', async () => {
      let callCount = 0;
      const debouncedFn = TestTimingUtils.debounce(() => {
        callCount++;
      }, 100);

      // Call multiple times rapidly
      debouncedFn();
      debouncedFn();
      debouncedFn();

      // Should not have been called yet
      expect(callCount).toBe(0);

      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have been called only once
      expect(callCount).toBe(1);
    });
  });
});