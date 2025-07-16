import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { useToastErrorHandler } from '@/hooks/useErrorHandler';
import ErrorBoundary from '@/components/ErrorBoundary';
import apiClient from '@/lib/apiClient';

// Create persistent mock functions that can be tracked
const mockHandleError = vi.fn((error) => {
  toast.error(`Error handled: ${error.message || 'Unknown error'}`);
});

const mockCreateAsyncErrorHandler = vi.fn((fn, onSuccess, errorMsg) => {
  return async (...args) => {
    try {
      const result = await fn(...args);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (error) {
      toast.error(error.message || errorMsg || 'Unknown error');
      return null;
    }
  };
});

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    promise: vi.fn(),
  },
}));

vi.mock('@/hooks/useErrorHandler', () => ({
  useToastErrorHandler: vi.fn(() => ({
    handleError: mockHandleError,
    createAsyncErrorHandler: mockCreateAsyncErrorHandler,
  })),
}));

vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Test components demonstrating different error handling patterns

// 1. Component using try/catch with the error handler
const ApiComponentWithTryCatch = () => {
  const { handleError } = useToastErrorHandler();
  const [data, setData] = React.useState(null);

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/data');
      setData(response.data);
    } catch (error) {
      handleError(error, 'API Error', 'Failed to fetch data');
    }
  };

  return (
    <div>
      <h2>API Component With Try/Catch</h2>
      <button onClick={fetchData}>Fetch Data</button>
      {data && <div data-testid="data-display">{JSON.stringify(data)}</div>}
    </div>
  );
};

// 2. Component using async error handler
const ApiComponentWithAsyncHandler = () => {
  const { createAsyncErrorHandler } = useToastErrorHandler();
  const [data, setData] = React.useState(null);

  const fetchDataRaw = async () => {
    const response = await apiClient.post('/api/submit', { value: 'test' });
    return response.data;
  };

  const handleSuccess = (result) => {
    setData(result);
    toast.success('Data fetched successfully');
  };

  const fetchData = createAsyncErrorHandler(fetchDataRaw, handleSuccess, 'Failed to fetch data');

  return (
    <div>
      <h2>API Component With Async Handler</h2>
      <button onClick={fetchData}>Submit Data</button>
      {data && <div data-testid="async-data-display">{JSON.stringify(data)}</div>}
    </div>
  );
};

// 3. Component with promise toast
const PromiseToastComponent = () => {
  const fetchWithPromise = () => {
    const promise = apiClient.get('/api/promise-data').then((res) => res.data);

    toast.promise(promise, {
      loading: 'Loading data...',
      success: 'Data loaded successfully',
      error: 'Failed to load data',
    });
  };

  return (
    <div>
      <h2>Promise Toast Component</h2>
      <button onClick={fetchWithPromise}>Fetch With Promise</button>
    </div>
  );
};

// 4. Component with an uncaught error for ErrorBoundary
const ErrorComponent = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Uncaught component error');
  }

  return (
    <div>
      <h2>Error Component</h2>
      <button
        onClick={() => {
          throw new Error('Button click error');
        }}
      >
        Trigger Error
      </button>
    </div>
  );
};

// Test app combining all test components
const TestApp = () => {
  return (
    <>
      <ApiComponentWithTryCatch />
      <ApiComponentWithAsyncHandler />
      <PromiseToastComponent />
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ErrorComponent shouldThrow={false} />
      </ErrorBoundary>
    </>
  );
};

describe('Toast Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the persistent mock functions
    mockHandleError.mockClear();
    mockCreateAsyncErrorHandler.mockClear();
  });

  it('handles API errors with try/catch pattern', async () => {
    // Mock API to throw error
    (apiClient.get as any).mockRejectedValueOnce(new Error('Network error'));

    render(<ApiComponentWithTryCatch />);

    // Click button to trigger API call
    const fetchButton = screen.getByText('Fetch Data');
    fireEvent.click(fetchButton);

    // Wait for error handling to complete
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/data');
      expect(mockHandleError).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Error handled: Network error');
    });
  });

  it('handles API errors with async error handler pattern', async () => {
    // Mock API to throw error
    (apiClient.post as any).mockRejectedValueOnce(new Error('Validation error'));

    render(<ApiComponentWithAsyncHandler />);

    // Click button to trigger API call
    const submitButton = screen.getByText('Submit Data');
    fireEvent.click(submitButton);

    // Wait for error handling to complete
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/submit', {
        value: 'test',
      });
      expect(toast.error).toHaveBeenCalledWith('Validation error');
    });
  });

  it('handles successful responses with async error handler', async () => {
    // Mock API to return success
    const mockData = { id: 1, status: 'success' };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockData });

    render(<ApiComponentWithAsyncHandler />);

    // Click button to trigger API call
    const submitButton = screen.getByText('Submit Data');
    fireEvent.click(submitButton);

    // Wait for success handling
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/submit', {
        value: 'test',
      });
      expect(toast.success).toHaveBeenCalledWith('Data fetched successfully');
      expect(screen.getByTestId('async-data-display')).toHaveTextContent(JSON.stringify(mockData));
    });
  });

  it('shows promise toast for API calls', async () => {
    // Mock API for promise toast
    (apiClient.get as any).mockResolvedValueOnce({ data: { success: true } });

    render(<PromiseToastComponent />);

    // Click button to trigger promise API call
    const promiseButton = screen.getByText('Fetch With Promise');
    fireEvent.click(promiseButton);

    // Verify toast.promise was called
    expect(toast.promise).toHaveBeenCalled();

    // Extract the promise from the call
    const promiseArg = (toast.promise as any).mock.calls[0][0];
    expect(promiseArg).toBeInstanceOf(Promise);

    // Extract the loading/success/error messages
    const toastConfig = (toast.promise as any).mock.calls[0][1];
    expect(toastConfig.loading).toBe('Loading data...');
    expect(toastConfig.success).toBe('Data loaded successfully');
    expect(toastConfig.error).toBe('Failed to load data');
  });

  it('handles click errors in components', async () => {
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ErrorComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    // The ErrorBoundary won't catch event handler errors, so this is just
    // testing that the component renders correctly when not throwing
    const errorButton = screen.getByText('Trigger Error');
    expect(errorButton).toBeInTheDocument();

    // We can't easily test the click error in this context without special setup
    // because React Error Boundaries don't catch event handler errors
    // This test verifies the component structure is correct
    expect(screen.getByText('Error Component')).toBeInTheDocument();
  });

  it('uses ErrorBoundary for component errors', () => {
    // Silence console errors during this test since we're intentionally throwing
    const originalConsoleError = console.error;
    console.error = vi.fn();

    try {
      // Test error boundary with component that immediately throws
      render(
        <ErrorBoundary fallback={<div>Error boundary caught error</div>}>
          <ErrorComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Error boundary should show fallback UI
      expect(screen.getByText('Error boundary caught error')).toBeInTheDocument();
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  });
});
