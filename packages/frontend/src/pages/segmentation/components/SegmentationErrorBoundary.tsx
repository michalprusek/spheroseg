import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class SegmentationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('SegmentationErrorBoundary caught an error:', error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4 max-w-md">
            An error occurred in the segmentation editor. This might be due to a temporary issue.
          </p>

          {/* Show error details in development */}
          {import.meta.env.DEV && this.state.error && (
            <details className="mb-4 text-left max-w-2xl w-full">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">Error details</summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                {this.state.error.toString()}
                {this.state.errorInfo && '\n\nComponent Stack:\n' + this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-2">
            <Button onClick={this.handleReset} variant="default">
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
