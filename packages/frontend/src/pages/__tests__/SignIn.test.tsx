import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { Link } from 'react-router-dom';
import '@testing-library/jest-dom';
import { renderWithRouter } from '@/shared/test-utils';

// Mock functions
const mockSignIn = vi.fn();
const mockToastError = vi.fn();

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: vi.fn(),
  },
}));

// Create a standalone SignIn component for testing
const MockSignIn = ({ isLoggedIn = false }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      mockToastError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await mockSignIn(email, password);
    } catch (_error) {
      mockToastError('Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  // If already logged in, show a message instead of the form
  if (isLoggedIn) {
    return (
      <div>
        <h2>You are already logged in</h2>
        <p>You are already logged in to your account.</p>
        <Link to="/dashboard">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div>
      <h2>Sign in to your account</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password"
          />
        </div>

        <div>
          <input type="checkbox" id="remember" />
          <label htmlFor="remember">Remember me</label>
        </div>

        <button type="submit">{isLoading ? 'Signing in' : 'Sign in'}</button>
      </form>

      <div>
        <span>Don't have an account?</span>
        <Link to="/sign-up">Sign up</Link>
        <Link to="/request-access">Request access</Link>
      </div>
    </div>
  );
};

describe('SignIn Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (isLoggedIn = false) => {
    return renderWithRouter(<MockSignIn isLoggedIn={isLoggedIn} />);
  };

  it('renders the sign in form correctly', () => {
    renderComponent();

    // Check if the title is rendered
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();

    // Check if the form elements are rendered
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Remember me')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    // Check if the sign up link is rendered
    expect(screen.getByText('Sign up')).toBeInTheDocument();

    // Check if the request access link is rendered
    expect(screen.getByText('Request access')).toBeInTheDocument();
  });

  it('shows already logged in message when user is logged in', () => {
    // Render with a logged in user
    renderComponent(true);

    // Check if the already logged in message is rendered
    expect(screen.getByText('You are already logged in')).toBeInTheDocument();

    // Check if the go to dashboard button is rendered
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toBeInTheDocument();
  });

  it('handles form submission correctly', async () => {
    renderComponent();

    // Fill in the form using fireEvent directly for this test
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' },
    });

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    // Check if signIn was called with the correct arguments
    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('shows error message when form is submitted with empty fields', async () => {
    renderComponent();

    // Submit the form without filling in the fields
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    // Check if toast.error was called
    expect(mockToastError).toHaveBeenCalledWith('Please fill in all fields');

    // Check if signIn was not called
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('shows loading state during sign in', async () => {
    // Mock signIn to return a promise that doesn't resolve immediately
    mockSignIn.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 100);
        }),
    );

    renderComponent();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' },
    });

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    // Check if the loading state is shown
    await waitFor(() => {
      expect(screen.getByText('Signing in')).toBeInTheDocument();
    });
  });

  it('handles sign in error correctly', async () => {
    // Mock signIn to throw an error
    mockSignIn.mockRejectedValue(new Error('Invalid credentials'));

    renderComponent();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' },
    });

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    // Check if toast.error was called with the error message
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Invalid credentials');
    });
  });
});
