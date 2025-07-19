# Advanced Test Utilities Guide

This directory contains advanced testing utilities that enhance our testing capabilities with performance monitoring, health analysis, and comprehensive test data management.

## 🚀 Quick Start

```typescript
import {
  AdvancedTestDataFactory,
  renderWithProviders,
  AdvancedMockBuilder,
  TestScenarioBuilder,
  AdvancedAssertions,
} from '@/test-utils/advancedTestFactories';
import { benchmarkTest } from '@/test-utils/performanceBenchmarks';
import { TestHealthMonitor } from '@/test-utils/testHealthMonitor';
```

## 📊 Core Utilities

### 1. Advanced Test Data Factory

Creates consistent, unique test data with automatic sequence management.

```typescript
// Create test users with auto-incrementing IDs
const user1 = AdvancedTestDataFactory.createUser(); // id: 'user-1'
const user2 = AdvancedTestDataFactory.createUser(); // id: 'user-2'

// Create with overrides
const adminUser = AdvancedTestDataFactory.createUser({
  username: 'admin',
  email: 'admin@test.com',
});

// Create API responses
const response = AdvancedTestDataFactory.createApiResponse(user1);
const errorResponse = AdvancedTestDataFactory.createApiError('Not found', 404);

// Create mock files
const imageFile = AdvancedTestDataFactory.createMockFile('test.jpg', 'image/jpeg', 2048);
const formData = AdvancedTestDataFactory.createFormData({
  name: 'Test Project',
  image: imageFile,
});

// Reset sequences (useful in beforeEach)
AdvancedTestDataFactory.resetSequence(); // Reset all
AdvancedTestDataFactory.resetSequence('user'); // Reset specific type
```

### 2. Enhanced Rendering with Providers

Simplified component testing with automatic provider setup.

```typescript
// Render with routing
renderWithProviders(<MyComponent />, {
  routerProps: { initialEntries: ['/dashboard'] },
});

// Render with auth context
const testUser = AdvancedTestDataFactory.createUser();
renderWithProviders(<ProtectedComponent />, {
  withAuth: true,
  authUser: testUser,
});

// Render with theme and language
renderWithProviders(<ThemedComponent />, {
  withTheme: true,
  theme: 'dark',
  withLanguage: true,
  language: 'es',
});

// Combine multiple providers
renderWithProviders(<ComplexComponent />, {
  routerProps: { initialEntries: ['/user/123'] },
  withAuth: true,
  authUser: testUser,
  withTheme: true,
  theme: 'light',
  withLanguage: true,
  language: 'en',
});
```

### 3. Advanced Mock Builder

Create sophisticated mocks for services and APIs.

```typescript
// Create API client mock
const apiClient = AdvancedMockBuilder.createApiClientMock();
apiClient.get.mockResolvedValue({ data: testUser });

// Create auth service mock
const authService = AdvancedMockBuilder.createAuthServiceMock(testUser);
expect(authService.isAuthenticated()).toBe(true);

// Create WebSocket mock with event simulation
const wsClient = AdvancedMockBuilder.createWebSocketMock();
wsClient.on('message', (data) => console.log('Received:', data));
wsClient._triggerEvent('message', { type: 'notification' });

// Create browser API mocks
const IntersectionObserver = AdvancedMockBuilder.createIntersectionObserverMock();
const ResizeObserver = AdvancedMockBuilder.createResizeObserverMock();
```

### 4. Test Scenario Builder

Create complex, multi-step test scenarios.

```typescript
const scenario = new TestScenarioBuilder()
  .scenario('User Registration Flow')
  .setup(async () => {
    // Setup test environment
    renderWithProviders(<RegistrationForm />);
  })
  .action(async () => {
    // Fill and submit form
    fireEvent.change(screen.getByLabelText('Email'), { 
      target: { value: 'test@example.com' } 
    });
    fireEvent.click(screen.getByText('Register'));
  })
  .assert(async () => {
    // Verify results
    await waitFor(() => {
      expect(screen.getByText('Registration successful')).toBeInTheDocument();
    });
  });

await scenario.execute();
```

### 5. Advanced Assertions

Enhanced assertions for common testing patterns.

```typescript
// Visibility and accessibility
const button = screen.getByRole('button');
AdvancedAssertions.expectElementToBeVisible(button);
AdvancedAssertions.expectElementToHaveCorrectAccessibility(button);

// API call verification
AdvancedAssertions.expectApiCallToMatchPattern(mockApiCall, {
  method: 'POST',
  url: /\/api\/users\/\d+/,
  data: { name: 'Test User' },
});

// Performance assertions
await AdvancedAssertions.expectPerformanceWithinThreshold(
  async () => {
    // Expensive operation
    await heavyComputation();
  },
  1000 // Should complete within 1 second
);
```

### 6. Timing Utilities

Handle async operations and timing in tests.

```typescript
// Wait for conditions
await TestTimingUtils.waitForCondition(
  () => screen.queryByText('Loading...') === null,
  5000, // timeout
  100   // polling interval
);

// Wait for elements
const element = await TestTimingUtils.waitForElement('.dynamic-content');

// Debounce functions for testing
const debouncedFn = TestTimingUtils.debounce(mockFn, 300);
```

## 🏃‍♂️ Performance Benchmarking

Track and monitor test performance automatically.

### Basic Usage

```typescript
import { benchmarkTest, PerformanceBenchmarks } from '@/test-utils/performanceBenchmarks';

// Wrap tests with performance monitoring
it('should render quickly', async () => {
  return benchmarkTest('component-render-basic', async () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});

// Use decorator for class methods
class MyTestClass {
  @benchmark('user-click-response')
  async testUserInteraction() {
    // Test implementation
  }
}
```

### Memory Monitoring

```typescript
import { MemoryBenchmarks } from '@/test-utils/performanceBenchmarks';

it('should not leak memory', async () => {
  const before = MemoryBenchmarks.takeSnapshot('before-test');
  
  // Perform operations that might leak memory
  const largeArray = Array.from({ length: 10000 }, () => createExpensiveObject());
  
  const after = MemoryBenchmarks.takeSnapshot('after-test');
  const comparison = MemoryBenchmarks.compareSnapshots('before-test', 'after-test');
  
  expect(comparison.leakDetected).toBe(false);
});
```

### Benchmark Suites

```typescript
import { BenchmarkSuiteRunner } from '@/test-utils/performanceBenchmarks';

const runner = new BenchmarkSuiteRunner();
runner.addSuite('component-performance', [
  PerformanceBenchmarks.getBenchmark('component-render-basic')!,
  PerformanceBenchmarks.getBenchmark('user-click-response')!,
]);

const testFunctions = new Map([
  ['component-render-basic', async () => { /* test */ }],
  ['user-click-response', async () => { /* test */ }],
]);

const results = await runner.runSuite('component-performance', testFunctions);
console.log(runner.generateReport('component-performance'));
```

## 🏥 Test Health Monitoring

Continuous monitoring of test quality and performance.

### Setup Health Monitoring

```typescript
import { 
  TestHealthMonitor, 
  ConsoleHealthObserver, 
  FileHealthObserver 
} from '@/test-utils/testHealthMonitor';

// In test setup (beforeAll)
const healthMonitor = TestHealthMonitor.getInstance();
healthMonitor.addObserver(new ConsoleHealthObserver());
healthMonitor.addObserver(new FileHealthObserver('./test-health.md'));
```

### Collect Metrics

```typescript
// Collect current health metrics
const metrics = healthMonitor.collectMetrics();

console.log('Test Health:', {
  performance: metrics.performance.score,
  coverage: metrics.coverage.score,
  reliability: metrics.reliability.score,
  maintainability: metrics.maintainability.score,
  overall: metrics.overall.score,
  status: metrics.overall.status,
});

// Generate detailed report
const report = healthMonitor.generateHealthReport();
console.log(report);
```

### Health Metrics Explained

- **Performance Health (0-100)**: Based on test execution speed and memory usage
- **Coverage Health (0-100)**: Component and function test coverage analysis
- **Reliability Health (0-100)**: Test flakiness and error rates
- **Maintainability Health (0-100)**: Code duplication, complexity, and test smells
- **Overall Health (0-100)**: Weighted average with recommendations

## 📋 Best Practices

### 1. Test Organization

```typescript
describe('MyComponent', () => {
  beforeEach(() => {
    // Reset sequences for consistent data
    AdvancedTestDataFactory.resetSequence();
  });

  it('should render with test data', async () => {
    return benchmarkTest('component-render-basic', async () => {
      const testData = AdvancedTestDataFactory.createProject();
      
      renderWithProviders(<MyComponent project={testData} />, {
        withAuth: true,
        authUser: AdvancedTestDataFactory.createUser(),
      });

      AdvancedAssertions.expectElementToBeVisible(screen.getByText(testData.name));
    });
  });
});
```

### 2. Performance-First Testing

```typescript
// Always wrap performance-critical tests
it('should handle large datasets efficiently', async () => {
  return benchmarkTest('data-processing', async () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => 
      AdvancedTestDataFactory.createImage({ id: `img-${i}` })
    );

    await AdvancedAssertions.expectPerformanceWithinThreshold(
      async () => {
        renderWithProviders(<DataTable data={largeDataset} />);
        await waitFor(() => {
          expect(screen.getAllByRole('row')).toHaveLength(1001); // +1 for header
        });
      },
      2000 // Should render 1000 items within 2 seconds
    );
  });
});
```

### 3. Health Monitoring Integration

```typescript
// In your test suite setup
describe('Application Tests', () => {
  let healthMonitor: TestHealthMonitor;

  beforeAll(() => {
    healthMonitor = TestHealthMonitor.getInstance();
    healthMonitor.addObserver(new ConsoleHealthObserver());
    PerformanceBenchmarks.initializeStandardBenchmarks();
  });

  afterAll(() => {
    // Generate final health report
    const report = healthMonitor.generateHealthReport();
    console.log('\n📊 Final Test Health Report:', report);
  });

  // Your tests here...
});
```

### 4. Complex Integration Testing

```typescript
it('should handle complete user workflow', async () => {
  const scenario = new TestScenarioBuilder()
    .scenario('Complete Image Upload and Segmentation')
    .setup(async () => {
      const user = AdvancedTestDataFactory.createUser();
      const project = AdvancedTestDataFactory.createProject({ user_id: user.id });
      
      renderWithProviders(<ProjectDetail projectId={project.id} />, {
        routerProps: { initialEntries: [`/projects/${project.id}`] },
        withAuth: true,
        authUser: user,
      });
    })
    .action(async () => {
      // Upload image
      const file = AdvancedTestDataFactory.createMockFile('test.jpg', 'image/jpeg');
      const input = screen.getByLabelText('Upload Image');
      fireEvent.change(input, { target: { files: [file] } });
      
      // Wait for upload to complete
      await TestTimingUtils.waitForCondition(
        () => screen.queryByText('Uploading...') === null,
        10000
      );
    })
    .assert(async () => {
      // Verify image appears in project
      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });
      
      // Check accessibility
      const imageElement = screen.getByAltText('test.jpg');
      AdvancedAssertions.expectElementToHaveCorrectAccessibility(imageElement);
    });

  return benchmarkTest('api-integration', async () => {
    await scenario.execute();
  });
});
```

## 🔧 Configuration

### Environment Variables

```bash
# Enable detailed performance monitoring
ENABLE_TEST_PERFORMANCE_MONITORING=true

# Set custom benchmark thresholds
TEST_RENDER_THRESHOLD_MS=100
TEST_INTERACTION_THRESHOLD_MS=50
TEST_API_THRESHOLD_MS=200
```

### Custom Benchmarks

```typescript
// Register custom benchmarks
PerformanceBenchmarks.register({
  name: 'custom-heavy-operation',
  category: 'computation',
  target: 500,
  warning: 1000,
  critical: 2000,
  description: 'Custom heavy computation benchmark',
});

// Use in tests
it('should handle heavy computation', async () => {
  return benchmarkTest('custom-heavy-operation', async () => {
    await performHeavyComputation();
  });
});
```

## 📈 Reporting

### Generate Comprehensive Reports

```typescript
// Performance benchmark report
const suiteRunner = new BenchmarkSuiteRunner();
const report = suiteRunner.generateReport('my-test-suite');

// Test health report
const healthMonitor = TestHealthMonitor.getInstance();
const healthReport = healthMonitor.generateHealthReport();

// Combine reports
const fullReport = `
# Test Quality Report

## Performance Benchmarks
${report}

## Test Health Analysis
${healthReport}
`;

// Save to file or output to console
console.log(fullReport);
```

## 🚀 Migration Guide

### From Basic Testing

```typescript
// Before: Basic test
it('should render component', () => {
  render(<MyComponent user={{ id: '1', name: 'Test' }} />);
  expect(screen.getByText('Test')).toBeInTheDocument();
});

// After: Enhanced test
it('should render component', async () => {
  return benchmarkTest('component-render-basic', async () => {
    const testUser = AdvancedTestDataFactory.createUser({ name: 'Test' });
    
    renderWithProviders(<MyComponent user={testUser} />, {
      withAuth: true,
      authUser: testUser,
    });

    AdvancedAssertions.expectElementToBeVisible(screen.getByText('Test'));
  });
});
```

### Adding Health Monitoring

```typescript
// Add to existing test suites
describe('Existing Test Suite', () => {
  beforeAll(() => {
    const healthMonitor = TestHealthMonitor.getInstance();
    healthMonitor.addObserver(new ConsoleHealthObserver());
  });

  // Existing tests remain unchanged
  // Health metrics are collected automatically
});
```

## 📚 API Reference

### AdvancedTestDataFactory

- `createUser(overrides?)` - Create test user
- `createProject(overrides?)` - Create test project  
- `createImage(overrides?)` - Create test image
- `createCell(overrides?)` - Create test cell
- `createApiResponse(data, status?)` - Create API response
- `createApiError(message?, status?)` - Create API error
- `createMockFile(name?, type?, size?)` - Create mock file
- `createFormData(fields)` - Create FormData
- `sequence(name)` - Get next sequence number
- `resetSequence(name?)` - Reset sequences

### PerformanceBenchmarks

- `initializeStandardBenchmarks()` - Setup default benchmarks
- `register(benchmark)` - Register custom benchmark
- `recordResult(name, time)` - Record performance result
- `getBenchmark(name)` - Get benchmark definition
- `getResults(name)` - Get benchmark results

### TestHealthMonitor

- `getInstance()` - Get singleton instance
- `addObserver(observer)` - Add health observer
- `collectMetrics()` - Collect current metrics
- `generateHealthReport()` - Generate text report
- `reset()` - Reset all metrics

See the integration test file for comprehensive usage examples.