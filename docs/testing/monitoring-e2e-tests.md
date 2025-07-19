# Monitoring E2E Tests Documentation

Comprehensive end-to-end testing suite for monitoring endpoints, performance validation, and accessibility compliance.

## Overview

The monitoring E2E test suite provides comprehensive testing coverage for:

- **Health Check Endpoints**: System health, readiness, and liveness probes
- **Monitoring APIs**: Metrics, dashboard, error reporting, and system information
- **Performance Monitoring**: Response time validation, load testing, and performance benchmarks
- **Accessibility Compliance**: WCAG 2.1 AA compliance testing for monitoring interfaces
- **Authentication & Authorization**: Admin-protected endpoint security
- **Error Handling**: Proper error responses and user experience

## Test Files

### 1. Core Monitoring Endpoints (`monitoring-endpoints.spec.ts`)

**Purpose**: Tests all monitoring API endpoints for functionality, authentication, and data integrity.

**Coverage**:
- Health check endpoints (`/api/health/*`)
- Monitoring endpoints (`/api/monitoring/*`)
- Performance metrics endpoints (`/api/performance/*`)
- Authentication and authorization
- Error handling and edge cases
- Frontend integration

**Key Test Areas**:
```typescript
// Health endpoints
GET /api/health                    // Basic health check
GET /api/health?details=true       // Detailed health info
GET /api/health/live               // Kubernetes liveness probe
GET /api/health/ready              // Kubernetes readiness probe

// Monitoring endpoints (admin-protected)
GET /api/monitoring/health         // Comprehensive system health
GET /api/monitoring/metrics        // Prometheus metrics
GET /api/monitoring/dashboard      // Unified dashboard data
GET /api/monitoring/errors         // Error metrics and reporting
GET /api/monitoring/performance    // Performance analytics
GET /api/monitoring/system         // System configuration info
GET /api/monitoring/recommendations // Optimization suggestions

// Performance metrics
POST /api/performance              // Submit performance data
GET /api/performance/me            // User-specific metrics
```

### 2. Performance Monitoring (`performance-monitoring.spec.ts`)

**Purpose**: Validates performance benchmarks, load handling, and response time requirements.

**Performance Thresholds**:
```javascript
const PERFORMANCE_BENCHMARKS = {
  healthCheck: { fast: 500ms, acceptable: 2000ms, slow: 5000ms },
  metrics: { fast: 1000ms, acceptable: 3000ms, slow: 10000ms },
  dashboard: { fast: 2000ms, acceptable: 5000ms, slow: 15000ms },
};
```

**Test Categories**:
- **Benchmark Testing**: Response time measurements against thresholds
- **Load Testing**: Concurrent request handling and system stability
- **Stress Testing**: Sustained load and performance degradation detection
- **Performance Data Collection**: Metrics recording and retrieval efficiency
- **Regression Detection**: Baseline performance measurements for CI/CD

### 3. Accessibility Testing (`monitoring-accessibility.spec.ts`)

**Purpose**: Ensures monitoring interfaces comply with WCAG 2.1 AA accessibility standards.

**Accessibility Features Tested**:
- **Screen Reader Compatibility**: Proper ARIA labels and semantic markup
- **Keyboard Navigation**: Complete interface navigation without mouse
- **Visual Accessibility**: Color contrast, multiple visual cues, text alternatives
- **Responsive Design**: Usability across different viewport sizes
- **Error Message Accessibility**: Clear, understandable error communication

**Tools Used**:
- `@axe-core/playwright`: Automated accessibility scanning
- Manual keyboard navigation testing
- Multiple viewport size testing
- Color contrast and visual indicator validation

## Test Execution

### Quick Start

```bash
# Install dependencies
npm install

# Run all monitoring E2E tests
npm run e2e:monitoring

# Run specific test suites
npm run e2e:monitoring:endpoints      # Core functionality tests
npm run e2e:monitoring:performance    # Performance benchmarks
npm run e2e:monitoring:accessibility  # Accessibility compliance
npm run e2e:monitoring:benchmarks     # Performance-only benchmarks
npm run e2e:monitoring:report         # Generate comprehensive report
```

### Prerequisites

1. **Services Running**: Backend and frontend services must be running
   ```bash
   # Development mode
   npm run dev
   # OR
   docker-compose --profile dev up -d
   ```

2. **Test User**: Test user account must exist
   ```bash
   npm run db:create-test-user
   ```

3. **Database**: PostgreSQL database must be accessible and healthy

### Test Environment Setup

The test runner automatically:
- Validates service availability
- Checks test user authentication
- Ensures Playwright installation
- Waits for services to be ready with retry logic

### Advanced Usage

#### Custom Test Execution

```bash
# Run specific test file
npx playwright test e2e/monitoring/monitoring-endpoints.spec.ts

# Run with specific browser
npx playwright test e2e/monitoring/ --project=chromium

# Run in headed mode for debugging
npx playwright test e2e/monitoring/ --headed

# Run with debug mode
npx playwright test e2e/monitoring/ --debug
```

#### Performance Benchmarking

```bash
# Run comprehensive performance benchmarks
npm run e2e:monitoring:benchmarks

# View performance results
npx playwright show-report
```

#### Accessibility Scanning

```bash
# Run accessibility tests only
npm run e2e:monitoring:accessibility

# Generate accessibility report
npm run e2e:monitoring:report
```

## Test Configuration

### Playwright Configuration

Located in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,           // 60 second test timeout
  expect: { timeout: 10000 },   // 10 second assertion timeout
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Test Data and Credentials

```typescript
// Default test configuration
const BASE_API_URL = 'http://localhost:5001/api';
const FRONTEND_URL = 'http://localhost:3000';
const TEST_ADMIN_EMAIL = 'testuser@test.com';
const TEST_ADMIN_PASSWORD = 'testuser123';
```

### Performance Thresholds

Performance thresholds can be customized per environment:

```typescript
const PERFORMANCE_BENCHMARKS = {
  healthCheck: {
    fast: 500,        // Green performance
    acceptable: 2000, // Yellow performance
    slow: 5000,       // Red performance (test failure)
  },
  // ... other thresholds
};
```

## Test Reports and Results

### HTML Reports

Playwright generates comprehensive HTML reports with:
- Test execution timeline
- Screenshots on failure
- Trace files for debugging
- Performance metrics
- Accessibility scan results

```bash
# View latest test results
npx playwright show-report

# Open specific report
npx playwright show-report test-results/monitoring-e2e-20250119-143022/html
```

### JSON Reports

For CI/CD integration, JSON reports include:
- Structured test results
- Performance measurements
- Pass/fail statistics
- Execution timing

### Test Summary

The test runner generates summaries including:
- Total tests executed
- Pass/fail breakdown
- Performance benchmark results
- Key metrics and response times

## Continuous Integration

### CI/CD Integration

The monitoring E2E tests are designed for CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Monitoring E2E Tests
  run: |
    npm run dev &
    sleep 30  # Wait for services
    npm run e2e:monitoring:report
    
- name: Upload Test Results
  uses: actions/upload-artifact@v3
  with:
    name: monitoring-e2e-results
    path: test-results/
```

### Environment Variables

Configure tests for different environments:

```bash
# Environment configuration
TEST_ENV=staging npm run e2e:monitoring
BACKEND_URL=https://api.staging.example.com npm run e2e:monitoring
```

## Troubleshooting

### Common Issues

1. **Services Not Running**
   ```
   [ERROR] Backend service not accessible at http://localhost:5001
   ```
   **Solution**: Start services with `npm run dev` or `docker-compose --profile dev up -d`

2. **Test User Authentication Failed**
   ```
   [WARNING] Test user not found or invalid credentials
   ```
   **Solution**: Create test user with `npm run db:create-test-user`

3. **Database Connection Issues**
   ```
   [ERROR] Database is not healthy: unhealthy
   ```
   **Solution**: Check PostgreSQL service and connection configuration

4. **Playwright Installation Issues**
   ```
   [ERROR] Playwright not installed
   ```
   **Solution**: Install with `npm run playwright:install`

### Debug Mode

For detailed debugging:

```bash
# Enable debug output
DEBUG=pw:api npm run e2e:monitoring:endpoints

# Run with browser UI for visual debugging
npm run e2e:open

# Run single test with debugging
npx playwright test e2e/monitoring/monitoring-endpoints.spec.ts --debug
```

### Performance Issues

If tests are failing due to performance:

1. **Check System Resources**: Ensure adequate CPU and memory
2. **Adjust Thresholds**: Modify performance benchmarks in test files
3. **Isolate Tests**: Run individual test suites to identify bottlenecks
4. **Monitor Services**: Check backend/database performance during tests

## Test Coverage

### Endpoint Coverage

✅ **Health Endpoints**
- Basic health check (`/api/health`)
- Detailed health check (`/api/health?details=true`)
- Liveness probe (`/api/health/live`)
- Readiness probe (`/api/health/ready`)

✅ **Monitoring Endpoints**
- System health (`/api/monitoring/health`)
- Prometheus metrics (`/api/monitoring/metrics`)
- Error reporting (`/api/monitoring/errors`)
- Performance metrics (`/api/monitoring/performance`)
- Unified dashboard (`/api/monitoring/dashboard`)
- System information (`/api/monitoring/system`)
- Recommendations (`/api/monitoring/recommendations`)
- Log access (`/api/monitoring/logs`)
- Alert resolution (`/api/monitoring/alerts/:id/resolve`)

✅ **Performance Endpoints**
- Metrics submission (`/api/performance`)
- User metrics retrieval (`/api/performance/me`)

### Test Scenarios

✅ **Functional Testing**
- All endpoints return expected data structures
- Authentication and authorization working correctly
- Error handling for invalid requests
- Edge cases and boundary conditions

✅ **Performance Testing**
- Response time validation against thresholds
- Concurrent request handling
- Load testing and stress testing
- Performance regression detection

✅ **Security Testing**
- Unauthorized access prevention
- Invalid token handling
- Input validation and sanitization
- Sensitive data exposure prevention

✅ **Accessibility Testing**
- WCAG 2.1 AA compliance
- Screen reader compatibility
- Keyboard navigation support
- Multi-device responsiveness

### Integration Testing

✅ **Frontend Integration**
- Error reporting from frontend to backend
- Health check accessibility from browser
- Real user workflow simulation

✅ **Service Integration**
- Database connectivity validation
- ML service health checking
- Redis service integration
- Cross-service communication

## Maintenance

### Updating Tests

When monitoring endpoints change:

1. **Update Test Files**: Modify test assertions for new response structures
2. **Update Thresholds**: Adjust performance benchmarks if needed
3. **Update Documentation**: Keep this documentation current
4. **Test Coverage**: Ensure new endpoints have test coverage

### Performance Baseline Updates

Periodically review and update performance baselines:

1. **Collect Baseline Data**: Run benchmarks on stable system
2. **Analyze Trends**: Look for performance improvements or degradations
3. **Update Thresholds**: Adjust acceptable performance ranges
4. **Document Changes**: Track performance expectation changes

### Adding New Test Scenarios

For new monitoring features:

1. **Identify Test Cases**: What needs to be tested?
2. **Choose Test File**: Core, performance, or accessibility?
3. **Write Tests**: Follow existing patterns and conventions
4. **Update Runner**: Add new test categories if needed
5. **Update Documentation**: Document new test coverage

## Best Practices

### Test Writing

- **Clear Test Names**: Describe what is being tested and expected outcome
- **Independent Tests**: Each test should run independently without dependencies
- **Meaningful Assertions**: Test specific behaviors, not just status codes
- **Error Scenarios**: Include negative test cases and error conditions
- **Performance Awareness**: Consider test execution time and resource usage

### Test Data

- **Use Test Fixtures**: Consistent test data for reliable results
- **Clean Up**: Remove test data after test execution
- **Isolation**: Avoid test data conflicts between concurrent tests
- **Realistic Data**: Use data similar to production scenarios

### Debugging

- **Verbose Logging**: Include console.log statements for debugging
- **Screenshots**: Capture screenshots on test failures
- **Trace Files**: Use Playwright's trace feature for detailed debugging
- **Incremental Testing**: Test individual components before integration

## Contributing

When adding new monitoring E2E tests:

1. **Follow Conventions**: Use existing test patterns and structure
2. **Update Documentation**: Keep this file current with new tests
3. **Performance Impact**: Consider test execution time
4. **Accessibility**: Include accessibility testing for UI components
5. **Cross-Browser**: Ensure tests work across supported browsers

For questions or issues with monitoring E2E tests, refer to the test files themselves or create an issue in the project repository.