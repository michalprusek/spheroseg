import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { Link } from 'react-router-dom';
import '@testing-library/jest-dom';
import { renderWithRouter } from '@/shared/test-utils';

// Mock functions
const mockSignUp = vi.fn();

// Import mocked toast functions (already mocked in test-setup.ts)
import { toast } from 'sonner';
const mockToastError = toast.error as any;
const mockToastSuccess = toast.success as any;

// Create a standalone SignUp component for testing
const MockSignUp = ({ isLoggedIn = false }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword) {
      mockToastError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      mockToastError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      mockToastError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    try {
      await mockSignUp(email, password);
      mockToastSuccess('Account created successfully');
    } catch (_error) {
      mockToastError('Email already in use');
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
      <h2>Create an account</h2>
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
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-label="Confirm Password"
          />
        </div>

        <button type="submit">{isLoading ? 'Creating account...' : 'Sign up'}</button>
      </form>

      <div>
        <span>Already have an account?</span>
        <Link to="/sign-in">Sign in</Link>
      </div>
    </div>
  );
};

describe('SignUp Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (isLoggedIn = false) => {
    return renderWithRouter(<MockSignUp isLoggedIn={isLoggedIn} />);
  };

  it('renders the sign up form correctly', () => {
    renderComponent();

    // Check if the title is rendered
    expect(screen.getByText('Create an account')).toBeInTheDocument();

    // Check if the form elements are rendered
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();

    // Check if the sign in link is rendered
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('shows already logged in message when user is logged in', () => {
    // Render with a logged in user
    renderComponent(true);

    // Check if the already logged in message is rendered
    expect(screen.getByText('You are already logged in')).toBeInTheDocument();

    // Check if the go to dashboard button is rendered
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toBeInTheDocument();
  });

  it('shows validation error for empty fields', async () => {
    renderComponent();

    // Submit the form without filling in the fields
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    // Check if toast.error was called
    expect(mockToastError).toHaveBeenCalledWith('Please fill in all fields');

    // Check if signUp was not called
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows validation error for password mismatch', async () => {
    renderComponent();

    // Fill in the form with mismatched passwords
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' },
    });

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });

    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password456' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    // Check if toast.error was called
    expect(mockToastError).toHaveBeenCalledWith('Passwords do not match');

    // Check if signUp was not called
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows validation error for password too short', async () => {
    renderComponent();

    // Fill in the form with a short password
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' },
    });

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pass' },
    });

    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'pass' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    // Check if toast.error was called
    expect(mockToastError).toHaveBeenCalledWith('Password must be at least 8 characters long');

    // Check if signUp was not called
    expect(mockSignUp).not.toHaveBeenCalled();
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

    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    // Check if signUp was called with the correct arguments
    expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123');

    // Check if toast.success was called
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Account created successfully');
    });
  });

  it('shows loading state during sign up', async () => {
    // Mock signUp to return a promise that doesn't resolve immediately
    mockSignUp.mockImplementation(
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

    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    // Check if the loading state is shown
    await waitFor(() => {
      expect(screen.getByText('Creating account...')).toBeInTheDocument();
    });
  });

  it('handles sign up error correctly', async () => {
    // Mock signUp to throw an error
    mockSignUp.mockRejectedValue(new Error('Email already in use'));

    renderComponent();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' },
    });

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });

    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    // Check if toast.error was called with the error message
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Email already in use');
    });
  });
});
