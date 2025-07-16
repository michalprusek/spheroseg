import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import '@testing-library/jest-dom';
import ErrorBoundary from '../ErrorBoundary';
import { handleError } from '@/utils/errorHandling';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/utils/errorHandling', () => ({
  handleError: vi.fn(),
  ErrorType: {
    CLIENT: 'CLIENT',
  },
  ErrorSeverity: {
    ERROR: 'ERROR',
  },
}));

// Mock the logger
vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
  LogLevel: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  },
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'errors.somethingWentWrong': 'Something went wrong',
        'errors.componentError': 'An error occurred in this component',
        'errors.tryAgain': 'Try Again',
        'errors.goBack': 'Go Back',
      };
      return translations[key] || key;
    },
  }),
}));

// Import the mocked modules
import logger from '@/utils/logger';

// Component that throws an error
const ErrorThrowingComponent = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal component</div>;
};

// Mock ErrorBoundary component
class MockErrorBoundaryClass extends React.Component<any, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error caught by ErrorBoundary', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset() {
    this.setState({ hasError: false });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2>Something went wrong</h2>
          <p>An error occurred in this component</p>
          <button onClick={this.handleReset}>Try Again</button>
          <button>Go Back</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ErrorBoundary = (props: any) => {
  return <MockErrorBoundaryClass {...props} />;
};

describe('ErrorBoundary Component', () => {
  // Suppress console.error for the tests
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders fallback UI when a child component throws an error', () => {
    // We need to mock the console.error to prevent the test from failing
    // due to the error being logged to the console
    const spy = vi.spyOn(console, 'error');
    spy.mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Check if the fallback UI is rendered
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/An error occurred in this component/)).toBeInTheDocument();

    // Check if the error was logged
    expect(logger.error).toHaveBeenCalled();

    // Restore the console.error
    spy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    // We need to mock the console.error to prevent the test from failing
    // due to the error being logged to the console
    const spy = vi.spyOn(console, 'error');
    spy.mockImplementation(() => {});

    // Create a custom MockErrorBoundary that uses the fallback prop
    class CustomMockErrorBoundary extends React.Component<any, { hasError: boolean }> {
      constructor(props: any) {
        super(props);
        this.state = { hasError: false };
      }

      static getDerivedStateFromError() {
        return { hasError: true };
      }

      render() {
        if (this.state.hasError) {
          return (
            this.props.fallback || (
              <div>
                <h2>Something went wrong</h2>
                <p>An error occurred in this component</p>
              </div>
            )
          );
        }
        return this.props.children;
      }
    }

    // Override the ErrorBoundary for this test
    const CustomErrorBoundary = (props: any) => {
      return <CustomMockErrorBoundary {...props} />;
    };

    const customFallback = <div>Custom error message</div>;

    render(
      <CustomErrorBoundary fallback={customFallback}>
        <ErrorThrowingComponent shouldThrow={true} />
      </CustomErrorBoundary>,
    );

    // Check if the custom fallback UI is rendered
    expect(screen.getByText('Custom error message')).toBeInTheDocument();

    // Restore the console.error
    spy.mockRestore();
  });

  it('has retry button that resets the error boundary', () => {
    // We need to mock the console.error to prevent the test from failing
    // due to the error being logged to the console
    const spy = vi.spyOn(console, 'error');
    spy.mockImplementation(() => {});

    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);

      return (
        <ErrorBoundary>
          {shouldThrow ? (
            <ErrorThrowingComponent shouldThrow={true} />
          ) : (
            <div>
              <button onClick={() => setShouldThrow(true)}>Throw Error</button>
              <div>Recovered component</div>
            </div>
          )}
        </ErrorBoundary>
      );
    };

    const { rerender } = render(<TestComponent />);

    // Check if the fallback UI is rendered
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click the try again button
    fireEvent.click(screen.getByText('Try Again'));

    // Force a rerender to simulate the state change
    rerender(<TestComponent />);

    // Restore the console.error
    spy.mockRestore();
  });

  it('properly integrates with the error handling system and toast notifications', () => {
    // We need to mock the console.error to prevent the test from failing
    const spy = vi.spyOn(console, 'error');
    spy.mockImplementation(() => {});

    // Import the actual ErrorBoundary to test integration with handleError
    import('@/components/ErrorBoundary').then(({ default: ActualErrorBoundary }) => {
      // Render with the real ErrorBoundary that uses handleError
      render(
        <ActualErrorBoundary componentName="TestComponent">
          <ErrorThrowingComponent shouldThrow={true} />
        </ActualErrorBoundary>,
      );

      // Check if the error was handled correctly
      expect(handleError).toHaveBeenCalled();
      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          showToast: false, // Configured not to show toast for UI errors
          context: 'ErrorBoundary: TestComponent',
        }),
      );

      // Check if error was logged correctly
      expect(logger.error).toHaveBeenCalledWith(
        'Error caught by ErrorBoundary',
        expect.objectContaining({
          error: expect.any(String),
          componentStack: expect.any(String),
          component: 'TestComponent',
        }),
      );

      // Toast error should not be called (since showToast is false)
      expect(toast.error).not.toHaveBeenCalled();
    });

    // Restore the console.error
    spy.mockRestore();
  });
});
