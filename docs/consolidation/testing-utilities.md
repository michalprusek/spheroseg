# Testing Utilities Consolidation

## Overview

The testing utilities consolidation provides a comprehensive set of testing helpers, mocks, generators, and assertions for the SpherosegV4 application. This system simplifies test writing, improves test consistency, and provides powerful tools for testing complex scenarios.

## Problem Statement

Previously, testing implementation was fragmented:
- No centralized test utilities
- Repetitive test setup code
- Inconsistent mocking approaches
- Limited test data generators
- Missing custom assertions
- Complex component testing setup
- No standardized test fixtures

## Solution Architecture

### Core Components

1. **Test Utils Index** (`/packages/frontend/src/test-utils/index.tsx`)
   - Custom render function with all providers
   - Test query client configuration
   - Re-exports from testing library
   - Integrated user-event setup
   - Support for router types (memory/browser)

2. **Data Generators** (`/packages/frontend/src/test-utils/generators.ts`)
   - Realistic test data generation using Faker.js
   - Type-safe generators for all entities
   - Complex data structure generators
   - API response generators
   - Batch data generation

3. **Mock Utilities** (`/packages/frontend/src/test-utils/mocks.ts`)
   - MSW server setup and handlers
   - Browser API mocks (Canvas, WebSocket, Storage)
   - Observer mocks (Intersection, Resize, Mutation)
   - File and Image mocks
   - Network condition simulation

4. **Test Helpers** (`/packages/frontend/src/test-utils/helpers.ts`)
   - Common testing patterns
   - Form filling utilities
   - Element waiting functions
   - Accessibility testing
   - Performance testing helpers

5. **Custom Assertions** (`/packages/frontend/src/test-utils/assertions.ts`)
   - Extended assertions
   - UI-specific assertions
   - API call assertions
   - State assertions
   - Custom matchers

6. **Test Fixtures** (`/packages/frontend/src/test-utils/fixtures.ts`)
   - Pre-defined test data
   - Common test scenarios
   - Auth states
   - Form data
   - API responses

## Key Features

### 1. Enhanced Render Function

```typescript
import { render, screen } from '@/test-utils';

// Render with all providers
const { user } = render(<MyComponent />);

// Custom options
render(<MyComponent />, {
  initialRoute: '/projects/123',
  routerType: 'memory',
  withProviders: true,
});

// User interactions included
await user.click(screen.getByRole('button'));
await user.type(screen.getByLabelText('Email'), 'test@example.com');
```

### 2. Realistic Data Generation

```typescript
import { generateUser, generateProject, generateCompleteDataset } from '@/test-utils';

// Generate single entities
const user = generateUser({ role: 'admin' });
const project = generateProject({ public: true });

// Generate with relationships
const projectWithImages = generateProjectWithImages(10);

// Generate complete dataset
const dataset = generateCompleteDataset();
// Returns user with projects, each with images and segmentations
```

### 3. API Mocking with MSW

```typescript
import { server } from '@/test-utils/mocks';
import { rest } from 'msw';

// Override default handlers
server.use(
  rest.get('/api/projects', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ data: [] })
    );
  })
);

// Test network errors
server.use(
  rest.get('/api/projects', (req, res) => {
    return res.networkError('Failed to connect');
  })
);
```

### 4. Browser API Mocks

```typescript
import { CanvasMock, WebSocketMock, createFileMock } from '@/test-utils/mocks';

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => new CanvasMock().getContext('2d'));

// Mock WebSocket
global.WebSocket = WebSocketMock as any;

// Create file mocks
const file = createFileMock('test.png', 1024 * 1024, 'image/png');
```

### 5. Testing Helpers

```typescript
import { 
  waitForLoadingToFinish,
  fillForm,
  selectOption,
  uploadFile,
  dragAndDrop,
  testAccessibility
} from '@/test-utils';

// Wait for loading
await waitForLoadingToFinish();

// Fill forms easily
await fillForm({
  email: 'test@example.com',
  password: 'password123',
  remember: true,
});

// Select dropdown options
await selectOption('Sort by', 'Name (A-Z)');

// Test accessibility
await testAccessibility(container);
```

### 6. Custom Assertions

```typescript
import {
  expectToastNotification,
  expectFieldToHaveError,
  expectApiCall,
  expectTableData,
  expectAccessible,
} from '@/test-utils';

// UI assertions
expectToastNotification('Success!', 'success');
expectFieldToHaveError('email', 'Required field');

// API assertions
expectApiCall('/api/projects', {
  method: 'POST',
  body: { name: 'New Project' }
});

// Table assertions
expectTableData(
  ['Name', 'Status', 'Created'],
  [
    { Name: 'Project 1', Status: 'Active', Created: '2024-01-01' },
    { Name: 'Project 2', Status: 'Draft', Created: '2024-01-02' },
  ]
);
```

## Usage Examples

### Component Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import { ProjectList } from './ProjectList';
import { server } from '@/test-utils/mocks';
import { rest } from 'msw';
import { testProjects } from '@/test-utils/fixtures';

describe('ProjectList', () => {
  it('renders projects', async () => {
    // Use fixtures
    server.use(
      rest.get('/api/projects', (req, res, ctx) => {
        return res(ctx.json({ data: Object.values(testProjects) }));
      })
    );

    render(<ProjectList />);
    
    await waitFor(() => {
      expect(screen.getByText(testProjects.cancerResearch.title)).toBeInTheDocument();
    });
  });

  it('creates new project', async () => {
    const { user } = render(<ProjectList />);
    
    await user.click(screen.getByRole('button', { name: /create/i }));
    
    await fillForm({
      title: 'New Project',
      description: 'Test description'
    });
    
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    expectApiCall('/api/projects', {
      method: 'POST',
      body: expect.objectContaining({ title: 'New Project' })
    });
  });
});
```

### Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';
import { AllProviders } from '@/test-utils';

describe('useAuth', () => {
  it('logs in user', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toMatchObject({
      email: 'test@example.com',
    });
  });
});
```

### Integration Testing

```typescript
describe('Image Upload Flow', () => {
  it('uploads and segments image', async () => {
    const { user } = render(<ImageUploadPage />);
    
    // Upload file
    const file = createFileMock('cells.png', 2 * 1024 * 1024);
    await uploadFile('Upload Image', file);
    
    // Wait for upload
    await waitForLoadingToFinish('Uploading...');
    
    // Start segmentation
    await user.click(screen.getByRole('button', { name: /segment/i }));
    
    // Check API calls
    expectApiCall('/api/images/upload', {
      method: 'POST',
      body: expect.any(FormData),
    });
    
    expectApiCall('/api/images/1/segment', {
      method: 'POST',
    });
    
    // Verify result
    await waitFor(() => {
      expect(screen.getByText(/125 cells detected/i)).toBeInTheDocument();
    });
  });
});
```

### Performance Testing

```typescript
import { measureRenderTime, expectPerformanceMetric } from '@/test-utils';

describe('Performance', () => {
  it('renders large list efficiently', async () => {
    const items = generateImages(1000);
    
    const renderTime = await measureRenderTime(() => {
      render(<ImageGrid images={items} />);
    });
    
    expect(renderTime).toBeLessThan(100); // ms
    
    expectPerformanceMetric('image-grid-render', 100);
  });
});
```

### Accessibility Testing

```typescript
describe('Accessibility', () => {
  it('is accessible', async () => {
    const { container } = render(<MyComponent />);
    
    // Automated checks
    await testAccessibility(container);
    
    // Manual checks
    expectAccessible(container);
    
    // Specific ARIA checks
    const button = screen.getByRole('button');
    expectAriaAttributes(button, {
      label: 'Submit form',
      describedby: 'submit-help',
    });
  });
});
```

## Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      exclude: ['**/test-utils/**', '**/*.test.*'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      '@/test-utils': '/src/test-utils',
    },
  },
});
```

### Test Setup

```typescript
// src/test-utils/setup.ts
import '@testing-library/jest-dom';
import { server } from './mocks';
import { mockWindow } from './mocks';

// Start MSW server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock window methods
Object.assign(window, mockWindow());

// Mock IntersectionObserver
global.IntersectionObserver = IntersectionObserverMock;
global.ResizeObserver = ResizeObserverMock;
```

## Best Practices

1. **Use Test Utils**: Always import from `@/test-utils` instead of `@testing-library/react`
2. **Leverage Generators**: Use data generators for realistic test data
3. **Mock at Network Level**: Use MSW for API mocking instead of module mocks
4. **Test User Flows**: Test complete user workflows, not just individual functions
5. **Check Accessibility**: Include accessibility tests in component tests
6. **Measure Performance**: Add performance tests for critical paths
7. **Use Fixtures**: Reuse common test data from fixtures

## Migration Guide

### 1. Update Imports

Before:
```typescript
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
```

After:
```typescript
import { render } from '@/test-utils';
// userEvent is included in render result
```

### 2. Replace Custom Wrappers

Before:
```typescript
const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      {children}
    </BrowserRouter>
  </QueryClientProvider>
);

render(<MyComponent />, { wrapper });
```

After:
```typescript
render(<MyComponent />); // All providers included
```

### 3. Use Data Generators

Before:
```typescript
const mockUser = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  // ... manually create all fields
};
```

After:
```typescript
import { generateUser } from '@/test-utils';

const mockUser = generateUser({ email: 'test@example.com' });
```

### 4. Simplify Assertions

Before:
```typescript
const toast = await screen.findByRole('alert');
expect(toast).toBeInTheDocument();
expect(toast).toHaveTextContent('Success');
expect(toast).toHaveClass('toast-success');
```

After:
```typescript
expectToastNotification('Success', 'success');
```

## Future Enhancements

1. **Visual Regression Testing**: Add screenshot comparison tests
2. **E2E Test Utils**: Extend utilities for Cypress/Playwright
3. **Performance Benchmarks**: Automated performance regression detection
4. **Mutation Testing**: Add Stryker for mutation testing
5. **Test Data Seeding**: Database seeding utilities for integration tests
6. **AI Test Generation**: Use AI to generate test cases from code
7. **Test Analytics**: Track test execution times and flakiness
8. **Parallel Testing**: Optimize test suite for parallel execution