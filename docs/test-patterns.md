# Test Patterns and Best Practices

## Test File Naming Convention

**Standard**: Use `.test.ts` or `.test.tsx` for all test files
- ✅ `Button.test.tsx`
- ✅ `utils.test.ts`
- ❌ `Button.spec.tsx` (deprecated)

**Rationale**: Consistency across the codebase (316 files use .test vs 14 use .spec)

## Test Organization

### Directory Structure
```
src/
├── components/
│   ├── Button.tsx
│   └── __tests__/
│       └── Button.test.tsx
├── utils/
│   ├── validation.ts
│   └── __tests__/
│       └── validation.test.ts
```

### Test File Location
- Place tests in `__tests__` directories adjacent to the code being tested
- This makes it easy to find tests and understand test coverage

## Performance Testing Patterns

### Using TestPerformanceTracker
```typescript
import { TestPerformanceTracker, setupPerformanceTest } from '@/test-utils/performanceTestUtils';

describe('Component Performance', () => {
  it('should render within performance budget', async () => {
    const { cleanup } = setupPerformanceTest('ComponentRender');
    
    render(<ExpensiveComponent />);
    
    const duration = cleanup();
    expect(duration).toBeLessThan(100); // 100ms budget
  });
});
```

### Performance Benchmarks
```typescript
// Add baseline performance expectations
export const PERFORMANCE_BASELINES = {
  componentRender: 50,    // ms
  apiCall: 200,          // ms
  dataProcessing: 100,   // ms
  memoryUsage: 50,       // MB
};
```

## React 18 Act Pattern

### Async Operations
```typescript
import { actAsync } from '@/test-utils/actUtils';

it('should handle async state updates', async () => {
  const { result } = renderHook(() => useAsyncHook());
  
  await actAsync(async () => {
    await result.current.fetchData();
  });
  
  expect(result.current.data).toBeDefined();
});
```

### Avoiding Act Warnings
```typescript
// ❌ Bad - causes act warnings
it('test', async () => {
  const { result } = renderHook(() => useTimer());
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(result.current.time).toBe(100);
});

// ✅ Good - properly wrapped
it('test', async () => {
  const { result } = renderHook(() => useTimer());
  await actWait(100); // from actUtils
  expect(result.current.time).toBe(100);
});
```

## Mock Patterns

### Using Shared Mock Utilities
```typescript
import { MockFactory } from '@shared/test-utils/mock-utilities';

// Create consistent API mocks
const apiClient = MockFactory.createApiClientMock();

// Create context mocks
const authContext = MockFactory.createContextMock('Auth', {
  user: null,
  isAuthenticated: false,
});
```

### Test Data Factories
```typescript
import { TestDataFactory } from '@/test-utils/performanceTestUtils';

const user = TestDataFactory.createUser({ 
  username: 'specific-test-user' 
});

const images = TestDataFactory.createMockArray(
  (i) => TestDataFactory.createImage({ id: `img-${i}` }),
  10 // create 10 images
);
```

## Component Testing Patterns

### Setup and Cleanup
```typescript
import { optimizeTestMemory } from '@/test-utils/performanceTestUtils';

describe('Component', () => {
  const memoryOptimizer = optimizeTestMemory();
  
  afterEach(() => {
    memoryOptimizer.clearAll();
  });
  
  // tests...
});
```

### Testing with Providers
```typescript
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <I18nextProvider i18n={i18n}>
          {ui}
        </I18nextProvider>
      </AuthProvider>
    </ThemeProvider>,
    options
  );
};
```

## Integration Testing Patterns

### API Integration Tests
```typescript
describe('API Integration', () => {
  it('should handle full request cycle', async () => {
    const { cleanup } = setupPerformanceTest('APIIntegration');
    
    // Mock network layer
    const api = MockFactory.createApiClientMock();
    api.get.mockResolvedValueOnce({ data: { users: [] } });
    
    // Test the integration
    const result = await getUserList();
    
    // Verify performance
    const duration = cleanup();
    expect(duration).toBeLessThan(PERFORMANCE_BASELINES.apiCall);
  });
});
```

## E2E Testing Patterns

### Using Playwright
```typescript
test('user flow', async ({ page }) => {
  // Navigation
  await page.goto('/');
  
  // Interaction
  await page.click('[data-testid="login-button"]');
  
  // Assertion
  await expect(page).toHaveURL('/dashboard');
});
```

## Test Quality Checklist

Before submitting tests:

- [ ] Tests are independent and can run in any order
- [ ] No hardcoded timeouts or waits
- [ ] Proper cleanup after each test
- [ ] Meaningful test descriptions
- [ ] Performance benchmarks for critical paths
- [ ] No console warnings or errors
- [ ] Uses standard test patterns
- [ ] Follows naming conventions

## Common Pitfalls to Avoid

1. **Flaky Tests**: Use proper wait strategies, not arbitrary timeouts
2. **Test Interdependence**: Each test should set up its own state
3. **Memory Leaks**: Always clean up timers, subscriptions, and DOM elements
4. **Over-mocking**: Mock external dependencies, not internal implementation
5. **Poor Test Names**: Use descriptive names that explain what and why

## Migration Guide

For existing .spec files:
```bash
# Rename all .spec files to .test
find packages -name "*.spec.ts" -o -name "*.spec.tsx" | while read f; do
  mv "$f" "${f/.spec./.test.}"
done

# Update imports
find packages -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/\.spec"/\.test"/g'
```