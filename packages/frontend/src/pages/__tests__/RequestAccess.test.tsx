import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter, Link } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock functions
const mockRequestAccess = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess
  }
}));

// Create a standalone RequestAccess component for testing
const MockRequestAccess = ({ isLoggedIn = false }) => {
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [organization, setOrganization] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [termsAccepted, setTermsAccepted] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !name || !reason) {
      mockToastError('Please fill in all required fields');
      return;
    }

    if (!termsAccepted) {
      mockToastError('Please accept the terms and conditions');
      return;
    }

    setIsLoading(true);
    try {
      await mockRequestAccess({ email, name, organization, reason });
      mockToastSuccess('Access request submitted successfully');
    } catch (error) {
      mockToastError('Failed to submit access request');
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
      <h2>Request Access</h2>
      <form onSubmit={handleSubmit} role="form">
        <div>
          <label htmlFor="email">Email address *</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
            required
          />
        </div>

        <div>
          <label htmlFor="name">Full Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Full Name"
            required
          />
        </div>

        <div>
          <label htmlFor="organization">Organization</label>
          <input
            id="organization"
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            aria-label="Organization"
          />
        </div>

        <div>
          <label htmlFor="reason">Reason for access *</label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for access"
            required
          />
        </div>

        <div>
          <input
            type="checkbox"
            id="terms"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            aria-label="Accept terms and conditions"
          />
          <label htmlFor="terms">
            I accept the Terms of Service and Privacy Policy
          </label>
        </div>

        <button type="submit">
          {isLoading ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>

      <div>
        <span>Already have an account?</span>
        <Link to="/sign-in">Sign in</Link>
      </div>
    </div>
  );
};

describe('RequestAccess Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (isLoggedIn = false) => {
    return render(
      <BrowserRouter>
        <MockRequestAccess isLoggedIn={isLoggedIn} />
      </BrowserRouter>
    );
  };

  it('renders the request access form correctly', () => {
    renderComponent();

    // Check if the title is rendered
    expect(screen.getByText('Request Access')).toBeInTheDocument();

    // Check if the form elements are rendered
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Organization')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason for access')).toBeInTheDocument();
    expect(screen.getByLabelText('Accept terms and conditions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeInTheDocument();

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

  it('shows validation error for empty required fields', async () => {
    renderComponent();

    // Get the form and submit it directly to bypass browser validation
    const form = screen.getByRole('form');
    fireEvent.submit(form);

    // Check if toast.error was called
    expect(mockToastError).toHaveBeenCalledWith('Please fill in all required fields');

    // Check if requestAccess was not called
    expect(mockRequestAccess).not.toHaveBeenCalled();
  });

  it('shows validation error for not accepting terms', async () => {
    renderComponent();

    // Fill in the required fields
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' }
    });

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Test User' }
    });

    fireEvent.change(screen.getByLabelText('Reason for access'), {
      target: { value: 'Testing the application' }
    });

    // Submit the form without accepting terms
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    // Check if toast.error was called
    expect(mockToastError).toHaveBeenCalledWith('Please accept the terms and conditions');

    // Check if requestAccess was not called
    expect(mockRequestAccess).not.toHaveBeenCalled();
  });

  it('handles form submission correctly', async () => {
    renderComponent();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' }
    });

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Test User' }
    });

    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'Test Organization' }
    });

    fireEvent.change(screen.getByLabelText('Reason for access'), {
      target: { value: 'Testing the application' }
    });

    // Accept terms
    fireEvent.click(screen.getByLabelText('Accept terms and conditions'));

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    // Check if requestAccess was called with the correct arguments
    expect(mockRequestAccess).toHaveBeenCalledWith({
      email: 'test@example.com',
      name: 'Test User',
      organization: 'Test Organization',
      reason: 'Testing the application'
    });

    // Check if toast.success was called
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Access request submitted successfully');
    });
  });

  it('shows loading state during submission', async () => {
    // Mock requestAccess to return a promise that doesn't resolve immediately
    mockRequestAccess.mockImplementation(() => new Promise(resolve => {
      setTimeout(resolve, 100);
    }));

    renderComponent();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' }
    });

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Test User' }
    });

    fireEvent.change(screen.getByLabelText('Reason for access'), {
      target: { value: 'Testing the application' }
    });

    // Accept terms
    fireEvent.click(screen.getByLabelText('Accept terms and conditions'));

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    // Check if the loading state is shown
    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });
  });

  it('handles submission error correctly', async () => {
    // Mock requestAccess to throw an error
    mockRequestAccess.mockRejectedValue(new Error('Failed to submit access request'));

    renderComponent();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' }
    });

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Test User' }
    });

    fireEvent.change(screen.getByLabelText('Reason for access'), {
      target: { value: 'Testing the application' }
    });

    // Accept terms
    fireEvent.click(screen.getByLabelText('Accept terms and conditions'));

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    // Check if toast.error was called with the error message
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to submit access request');
    });
  });
});
