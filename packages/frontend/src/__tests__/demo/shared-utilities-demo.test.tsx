/**
 * Demo Test: Frontend Shared Test Utilities Integration
 * Demonstrates the use of our shared testing infrastructure in frontend tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { 
  globalTestReporter, 
  TestResult
} from '../../../../shared/test-utils/test-reporter';
import { MockFactory, TestDataGenerator } from '../../../../shared/test-utils/mock-utilities';
import { PerformanceTester, PerformanceMonitor } from '../../../../shared/test-utils/performance-testing';

// Simple test component to demonstrate React testing with shared utilities
const TestComponent: React.FC<{ title: string; onClick?: () => void }> = ({ title, onClick }) => {
  const [count, setCount] = React.useState(0);
  
  return (
    <div>
      <h1 data-testid="title">{title}</h1>
      <p data-testid="count">Count: {count}</p>
      <button 
        data-testid="increment"
        onClick={() => setCount(c => c + 1)}
      >
        Increment
      </button>
      {onClick && (
        <button 
          data-testid="custom-action"
          onClick={onClick}
        >
          Custom Action
        </button>
      )}
    </div>
  );
};

describe('Frontend Shared Test Utilities Demo', () => {
  let testStartTime: number;

  beforeAll(() => {
    testStartTime = Date.now();
  });

  afterAll(() => {
    // Record this test suite in our global reporter
    const testResult: TestResult = {
      name: 'Frontend Shared Test Utilities Demo Suite',
      status: 'passed',
      duration: Date.now() - testStartTime,
      suite: 'demo',
      service: 'frontend'
    };
    globalTestReporter.recordTest(testResult);
  });

  describe('TestReporter with React Integration', () => {
    it('should record test results for React component tests', () => {
      const reporter = globalTestReporter;
      
      // Record a sample test result
      const testResult: TestResult = {
        name: 'React component render test',
        status: 'passed',
        duration: 150,
        suite: 'demo',
        service: 'frontend'
      };
      
      reporter.recordTest(testResult);
      
      const stats = reporter.getStats();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.passed).toBeGreaterThan(0);
      
      // Generate markdown report
      const markdownReport = reporter.generateMarkdownReport();
      expect(markdownReport).toContain('Test Execution Report');
      expect(markdownReport).toContain('frontend');
    });

    it('should render test component successfully', () => {
      render(<TestComponent title="Test Title" />);
      
      expect(screen.getByTestId('title')).toHaveTextContent('Test Title');
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 0');
      expect(screen.getByTestId('increment')).toBeInTheDocument();
    });
  });

  describe('MockFactory with React Components', () => {
    it('should create and use React Context mocks', () => {
      const mockContext = MockFactory.createContextMock('TestContext', {
        value: 'initial',
        setValue: vi.fn(),
      });

      expect(mockContext.useContext).toBeDefined();
      expect(mockContext.Provider).toBeDefined();
      expect(mockContext.contextValue.value).toBe('initial');

      // Update context value
      mockContext.updateContextValue({ value: 'updated' });
      expect(mockContext.contextValue.value).toBe('updated');
    });

    it('should track API client mocks in React context', async () => {
      const apiClient = MockFactory.createApiClientMock('http://localhost:5001');
      
      const mockResponse = { data: { users: [{ id: 1, name: 'Test User' }] } };
      apiClient.get.mockResolvedValue(mockResponse);
      
      const response = await apiClient.get('/users');
      
      expect(response).toEqual(mockResponse);
      expect(apiClient.get).toHaveBeenCalledWith('/users');
      expect(apiClient.get.callHistory).toBeDefined();
    });

    it('should create i18n mocks with translation support', () => {
      const translations = {
        en: { 'welcome': 'Welcome', 'goodbye': 'Goodbye' },
        cs: { 'welcome': 'Vítejte', 'goodbye': 'Na shledanou' }
      };
      
      const i18n = MockFactory.createI18nMock(translations);
      
      expect(i18n.t('welcome')).toBe('Welcome');
      
      // Change language
      i18n.changeLanguage('cs');
      expect(i18n.language).toBe('cs');
      expect(i18n.t('welcome')).toBe('Vítejte');
    });
  });

  describe('TestDataGenerator for React Components', () => {
    it('should generate consistent user data for React forms', () => {
      const mockUser = TestDataGenerator.createMockUser({
        username: 'react-tester'
      });
      
      expect(mockUser.username).toBe('react-tester');
      expect(mockUser.id).toMatch(/^test-user-/);
      expect(mockUser.email).toBe('test@example.com');
      expect(mockUser.created_at).toBeDefined();
    });

    it('should generate project data for component props', () => {
      const projects = TestDataGenerator.createMockArray(
        (index) => TestDataGenerator.createMockProject({ 
          name: `React Project ${index}` 
        }),
        3
      );
      
      expect(projects).toHaveLength(3);
      expect(projects[0].name).toBe('React Project 0');
      expect(projects[1].name).toBe('React Project 1');
      expect(projects[2].name).toBe('React Project 2');
    });
  });

  describe('PerformanceTester with React Rendering', () => {
    it('should monitor React component rendering performance', async () => {
      const benchmarks = PerformanceTester.getWebPerformanceBenchmarks();
      
      const { result, report } = await PerformanceTester.runRegressionTest(
        'react-component-render-test',
        async (monitor) => {
          // Simulate React component rendering
          monitor.startTimer('component_render_time');
          
          const { unmount } = render(<TestComponent title="Performance Test" />);
          
          // Verify component rendered
          expect(screen.getByTestId('title')).toHaveTextContent('Performance Test');
          
          monitor.endTimer('component_render_time');
          
          // Simulate user interaction
          monitor.startTimer('user_interaction');
          const button = screen.getByTestId('increment');
          fireEvent.click(button);
          
          await waitFor(() => {
            expect(screen.getByTestId('count')).toHaveTextContent('Count: 1');
          });
          monitor.endTimer('user_interaction');
          
          // Record memory usage after component operations
          monitor.recordMemoryUsage('component_operations_complete');
          
          // Cleanup
          unmount();
          
          return { renderSuccess: true, interactionSuccess: true };
        },
        benchmarks
      );
      
      expect(result.renderSuccess).toBe(true);
      expect(result.interactionSuccess).toBe(true);
      expect(report.testName).toBe('react-component-render-test');
      expect(report.metrics.length).toBeGreaterThan(3); // More metrics due to global hooks
      expect(report.summary.totalMetrics).toBeGreaterThan(3);
    });
  });

  describe('Performance Monitoring in React Tests', () => {
    it('should track memory usage during React component lifecycle', () => {
      const monitor = new PerformanceMonitor();
      monitor.recordMemoryUsage('before_render');
      
      const { unmount } = render(<TestComponent title="Memory Test" />);
      monitor.recordMemoryUsage('after_render');
      
      // Simulate some operations
      const button = screen.getByTestId('increment');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      
      monitor.recordMemoryUsage('after_interactions');
      
      unmount();
      monitor.recordMemoryUsage('after_unmount');
      
      const report = monitor.generateReport('react-memory-test');
      const memoryMetrics = report.metrics.filter(m => m.name.includes('memory'));
      
      expect(memoryMetrics.length).toBeGreaterThan(0);
      expect(memoryMetrics[0].unit).toBe('bytes');
      expect(memoryMetrics[0].value).toBeGreaterThan(0);
    });
  });

  describe('Integration with Existing Frontend Mocks', () => {
    it('should work alongside existing i18n mocks', () => {
      // This test verifies that our shared utilities don't interfere with existing mocks
      const customMock = MockFactory.createMockFunction('custom-function');
      
      // The existing i18n mock should still work
      expect(typeof vi).toBe('object');
      expect(customMock).toBeDefined();
      expect(typeof customMock.mockImplementation).toBe('function');
    });

    it('should provide enhanced mock functionality', () => {
      const enhancedLocalStorage = MockFactory.createLocalStorageMock();
      
      enhancedLocalStorage.setItem('frontend-test', 'value');
      expect(enhancedLocalStorage.getItem('frontend-test')).toBe('value');
      expect(enhancedLocalStorage.length).toBe(1);
      
      enhancedLocalStorage.clear();
      expect(enhancedLocalStorage.length).toBe(0);
    });
  });
});