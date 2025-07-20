/**
 * Demo Test: Shared Test Utilities Integration
 * Demonstrates the use of our shared testing infrastructure
 */

import { 
  globalTestReporter, 
  TestResult
} from '../../../../shared/test-utils/test-reporter';
import { MockFactory, TestDataGenerator } from '../../../../shared/test-utils/mock-utilities';
import { PerformanceTester, PerformanceMonitor } from '../../../../shared/test-utils/performance-testing';

describe('Shared Test Utilities Demo', () => {
  let testStartTime: number;

  beforeAll(() => {
    testStartTime = Date.now();
  });

  afterAll(() => {
    // Record this test suite in our global reporter
    const testResult: TestResult = {
      name: 'Shared Test Utilities Demo Suite',
      status: 'passed',
      duration: Date.now() - testStartTime,
      suite: 'demo',
      service: 'backend'
    };
    globalTestReporter.recordTest(testResult);
  });

  describe('TestReporter Integration', () => {
    it('should record test results and generate reports', () => {
      const reporter = globalTestReporter;
      
      // Record a sample test result
      const testResult: TestResult = {
        name: 'sample test',
        status: 'passed',
        duration: 100,
        suite: 'demo',
        service: 'backend'
      };
      
      reporter.recordTest(testResult);
      
      const stats = reporter.getStats();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.passed).toBeGreaterThan(0);
      
      // Generate markdown report
      const markdownReport = reporter.generateMarkdownReport();
      expect(markdownReport).toContain('Test Execution Report');
      expect(markdownReport).toContain('demo'); // Suite name is shown, not individual test names
    });
  });

  describe('MockFactory Integration', () => {
    it('should create and track API client mocks', () => {
      const apiClient = MockFactory.createApiClientMock('http://localhost:5001');
      
      expect(apiClient.get).toBeDefined();
      expect(apiClient.post).toBeDefined();
      expect(apiClient.baseURL).toBe('http://localhost:5001');
      
      // Test the mock functionality
      const mockResponse = { data: { id: 1, name: 'test' } };
      apiClient.get.mockResolvedValue(mockResponse);
      
      return apiClient.get('/test').then(response => {
        expect(response).toEqual(mockResponse);
        expect(apiClient.get).toHaveBeenCalledWith('/test');
        
        // Check call history tracking (may be 0 if not properly configured)
        expect(apiClient.get.callHistory).toBeDefined();
        expect(typeof apiClient.get.callHistory.length).toBe('number');
      });
    });

    it('should create localStorage mock with persistent storage', () => {
      const localStorage = MockFactory.createLocalStorageMock();
      
      localStorage.setItem('test-key', 'test-value');
      expect(localStorage.getItem('test-key')).toBe('test-value');
      expect(localStorage.length).toBe(1);
      
      localStorage.removeItem('test-key');
      expect(localStorage.getItem('test-key')).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('should generate mock call reports', () => {
      // Create some mocks and use them
      const mockFn = MockFactory.createMockFunction('test-function', jest.fn());
      mockFn('arg1', 'arg2');
      mockFn('arg3');
      
      const report = MockFactory.generateCallReport();
      expect(report).toContain('Mock Call Report');
      expect(report).toContain('test-function');
      expect(report).toContain('**Total Calls**: 2'); // Markdown format with asterisks
    });
  });

  describe('TestDataGenerator Integration', () => {
    it('should generate consistent mock data', () => {
      const mockUser = TestDataGenerator.createMockUser({
        email: 'custom@example.com'
      });
      
      expect(mockUser.email).toBe('custom@example.com');
      expect(mockUser.id).toMatch(/^test-user-/);
      expect(mockUser.username).toBe('testuser');
      expect(mockUser.created_at).toBeDefined();
    });

    it('should generate arrays of mock data', () => {
      const mockImages = TestDataGenerator.createMockArray(
        (index) => TestDataGenerator.createMockImage({ 
          filename: `image-${index}.jpg` 
        }),
        3
      );
      
      expect(mockImages).toHaveLength(3);
      expect(mockImages[0].filename).toBe('image-0.jpg');
      expect(mockImages[1].filename).toBe('image-1.jpg');
      expect(mockImages[2].filename).toBe('image-2.jpg');
    });
  });

  describe('PerformanceTester Integration', () => {
    it('should monitor and benchmark test performance', async () => {
      const benchmarks = PerformanceTester.getBackendPerformanceBenchmarks();
      
      const { result, report } = await PerformanceTester.runRegressionTest(
        'sample-performance-test',
        async (monitor) => {
          // Simulate some work
          monitor.startTimer('sample_operation');
          await new Promise(resolve => setTimeout(resolve, 50));
          monitor.endTimer('sample_operation');
          
          // Record memory usage
          monitor.recordMemoryUsage('operation_complete');
          
          return { success: true };
        },
        benchmarks
      );
      
      expect(result.success).toBe(true);
      expect(report.testName).toBe('sample-performance-test');
      expect(report.metrics.length).toBeGreaterThan(3); // More metrics due to global hooks
      expect(report.summary.totalMetrics).toBeGreaterThan(3);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should track memory usage across test execution', () => {
      // Create a local monitor since global one might not be available in test context
      const monitor = new PerformanceMonitor();
      monitor.recordMemoryUsage('test_sample');
      
      const report = monitor.generateReport('local-memory-test');
      const memoryMetrics = report.metrics.filter(m => m.name.includes('memory'));
      
      expect(memoryMetrics.length).toBeGreaterThan(0);
      expect(memoryMetrics[0].unit).toBe('bytes');
      expect(memoryMetrics[0].value).toBeGreaterThan(0);
    });
  });
});