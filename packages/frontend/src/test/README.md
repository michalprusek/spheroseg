# Frontend Testing Guide

This guide explains how to use the enhanced testing infrastructure for the SpherosegV4 frontend.

## Quick Start

### Basic Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils/renderWithProviders';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Testing with Route Parameters

```typescript
import { renderWithRoute, screen } from '@/test/utils/renderWithProviders';
import { updateMockParams } from '@/test/mocks/router';
import ProjectDetail from '../ProjectDetail';

describe('ProjectDetail', () => {
  it('loads project based on route param', () => {
    updateMockParams({ projectId: '123' });
    renderWithRoute(<ProjectDetail />, '/projects/123');
    
    expect(screen.getByText('Project 123')).toBeInTheDocument();
  });
});
```

### Testing Authentication States

```typescript
import { renderWithProviders, renderWithoutAuth } from '@/test/utils/renderWithProviders';

// Test authenticated state
it('shows user content when authenticated', () => {
  renderWithProviders(<Dashboard />);
  expect(screen.getByText('Welcome, testuser')).toBeInTheDocument();
});

// Test unauthenticated state
it('redirects to login when not authenticated', () => {
  renderWithoutAuth(<Dashboard />);
  expect(mockNavigate).toHaveBeenCalledWith('/login');
});
```

## Available Test Utilities

### 1. localStorage Mock

```typescript
import { localStorageMock } from '@/test/mocks/localStorage';

// Set initial state for a test
beforeEach(() => {
  localStorageMock.__setInitialState({
    'user-theme': 'dark',
    'user-language': 'en',
  });
});

// Verify localStorage interactions
it('saves user preference', () => {
  // ... user action ...
  expect(localStorage.setItem).toHaveBeenCalledWith('user-theme', 'light');
});
```

### 2. WebSocket / Socket.IO Mock

```typescript
import { MockSocketIO } from '@/test/mocks/websocket';

it('handles real-time updates', async () => {
  const socket = new MockSocketIO();
  
  // Simulate connection
  socket.__simulateConnect();
  
  // Simulate receiving data
  socket.__simulateEvent('image-updated', { id: '1', status: 'completed' });
  
  // Verify UI updates
  await waitFor(() => {
    expect(screen.getByText('Processing Complete')).toBeInTheDocument();
  });
});
```

### 3. API Mocking

```typescript
import { createApiClientMock } from '@/test/mocks/apiClientFactory';

const mockApi = createApiClientMock();

beforeEach(() => {
  // Set up mock responses
  mockApi.__setMockResponse('GET', '/api/projects', [
    { id: '1', name: 'Test Project' }
  ]);
});

it('loads projects', async () => {
  renderWithProviders(<ProjectList />);
  
  await waitFor(() => {
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });
  
  expect(mockApi.get).toHaveBeenCalledWith('/api/projects');
});
```

### 4. Router Navigation

```typescript
import { mockNavigate, updateMockLocation } from '@/test/mocks/router';

it('navigates to project detail', async () => {
  renderWithProviders(<ProjectList />);
  
  const projectLink = screen.getByText('Test Project');
  fireEvent.click(projectLink);
  
  expect(mockNavigate).toHaveBeenCalledWith('/projects/1');
});

it('shows breadcrumbs based on location', () => {
  updateMockLocation({ pathname: '/projects/1/images' });
  renderWithProviders(<Breadcrumbs />);
  
  expect(screen.getByText('Projects')).toBeInTheDocument();
  expect(screen.getByText('Images')).toBeInTheDocument();
});
```

## Common Testing Patterns

### Testing Async Operations

```typescript
import { waitFor, screen } from '@testing-library/react';

it('loads data asynchronously', async () => {
  renderWithProviders(<DataComponent />);
  
  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
  
  // Verify data is displayed
  expect(screen.getByText('Data loaded')).toBeInTheDocument();
});
```

### Testing Form Submissions

```typescript
import { fireEvent, waitFor } from '@testing-library/react';

it('submits form data', async () => {
  const mockApi = createApiClientMock();
  renderWithProviders(<ContactForm />);
  
  // Fill form
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'John Doe' }
  });
  
  // Submit
  fireEvent.click(screen.getByText('Submit'));
  
  // Verify API call
  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith('/api/contact', {
      name: 'John Doe'
    });
  });
});
```

### Testing Error States

```typescript
it('handles API errors gracefully', async () => {
  const mockApi = createApiClientMock();
  mockApi.__setMockError('GET', '/api/data', new Error('Network error'));
  
  renderWithProviders(<DataComponent />);
  
  await waitFor(() => {
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });
});
```

## Best Practices

1. **Use the Right Render Function**
   - `renderWithProviders` - For most components
   - `renderWithRoute` - When testing route-dependent components
   - `renderWithoutAuth` - For login/signup pages

2. **Clean Up Between Tests**
   - Mocks are automatically cleared between tests
   - localStorage is cleared automatically
   - Router state is reset automatically

3. **Mock at the Right Level**
   - Mock API calls, not service methods when possible
   - Mock external dependencies (localStorage, WebSocket)
   - Don't mock what you're testing

4. **Use Type-Safe Mocks**
   - Import service types and ensure mocks match
   - Use TypeScript to catch mock/implementation mismatches

5. **Test User Behavior, Not Implementation**
   - Click buttons like users would
   - Verify what users see, not internal state
   - Test accessibility (keyboard navigation, screen readers)

## Debugging Tips

1. **Debug Render Output**
   ```typescript
   const { debug } = renderWithProviders(<Component />);
   debug(); // Prints DOM to console
   ```

2. **Check Mock Calls**
   ```typescript
   console.log(mockApi.get.mock.calls); // See all calls to GET
   ```

3. **Use Testing Playground**
   ```typescript
   screen.logTestingPlaygroundURL(); // Get interactive query helper
   ```

4. **Enable Console Output**
   ```typescript
   // In your test file
   global.console.error = console.error; // Re-enable error logs
   global.console.warn = console.warn;   // Re-enable warnings
   ```

## Migration Guide

If you're updating existing tests:

1. Replace `render` with `renderWithProviders`
2. Remove manual provider wrapping
3. Use mock helpers instead of manual vi.mock()
4. Update localStorage usage to use the mock
5. Update router navigation assertions

Example migration:

```typescript
// Before
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

it('old test', () => {
  render(
    <BrowserRouter>
      <MyComponent />
    </BrowserRouter>
  );
});

// After
import { renderWithProviders } from '@/test/utils/renderWithProviders';

it('new test', () => {
  renderWithProviders(<MyComponent />);
});
```