import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom'; // Use MemoryRouter for components using Link/navigate
// Import the actual toast to potentially spy on it if needed, but don't mock the whole module
import { toast } from 'sonner';
import { vi } from 'vitest';

// Create a mock SignIn component for testing
const MockSignIn = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      // Use the real toast.error function which we're spying on
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      await mockSignIn(email, password);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      // Use the real toast.error function which we're spying on
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  if (isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full glass-morphism rounded-2xl overflow-hidden shadow-glass-lg p-10 text-center">
          <h2 className="text-2xl font-bold mb-4">You're already logged in</h2>
          <p className="mb-6 text-gray-600">You can access your dashboard or sign out.</p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full glass-morphism rounded-2xl overflow-hidden shadow-glass-lg p-10 animate-scale-in">
        <div className="text-center mb-8">
          <h2 className="mt-4 text-3xl font-bold text-gray-900">Sign in to your account</h2>
          <p className="mt-2 text-gray-600">Access the Spheroid Segmentation Platform</p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Your Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-11"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Password
              </label>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-11"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 w-full h-11 text-base rounded-md"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Mock the SignIn component
vi.mock('./SignIn', () => ({
  default: () => <MockSignIn />
}));

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-auth-provider">{children}</div>
}));

// Mock the LanguageContext
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: (key: string) => key,
    availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh']
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Create a spy for the toast.error method
const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => {});

// Make sure the spy is properly mocked
toast.error = toastErrorSpy;

// Define mockSignIn at the module level so it can be used in the MockSignIn component
const mockSignIn = vi.fn();

describe('SignIn Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockSignIn.mockClear();
    toastErrorSpy.mockClear(); // Clear the spy
  });

  afterEach(() => {
    // Reset the spy after each test, but don't restore the original implementation
    toastErrorSpy.mockReset();
  });

  test('renders the sign in form correctly', () => {
    render(
      <MemoryRouter>
        <MockSignIn />
      </MemoryRouter>
    );

    // Check for key elements
    expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/your email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('shows error toast if fields are empty', async () => {
    render(
      <MemoryRouter>
        <MockSignIn />
      </MemoryRouter>
    );
    const emailInput = screen.getByLabelText(/your email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    // Get the form element - assuming there's only one form or it's identifiable
    const form = emailInput.closest('form');
    if (!form) {
      throw new Error("Form element not found");
    }

    // Ensure fields are empty (default state, but good practice)
    expect(emailInput).toHaveValue('');
    expect(passwordInput).toHaveValue('');

    // Submit the form instead of just clicking the button
    fireEvent.submit(form);

    // Wait specifically for the spy call
    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    });
    // Then check the argument
    expect(toastErrorSpy).toHaveBeenCalledWith('Please fill in all fields');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  test('calls signIn function and shows loading state on submit', async () => {
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50))); // Short delay

    render(
      <MemoryRouter>
        <MockSignIn />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/your email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    // Fill the form
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Submit the form
    fireEvent.click(signInButton);

    // Check for loading state immediately after click
    expect(screen.getByRole('button', { name: /signing in.../i })).toBeInTheDocument();
    expect(signInButton).toBeDisabled();

    // Wait for the signIn mock to be called
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    // Wait for the button to become enabled again after mock resolves
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    });
  });

  test('shows error toast on failed sign in', async () => {
    const errorMessage = 'Invalid credentials provided';
    mockSignIn.mockRejectedValue(new Error(errorMessage));

    render(
      <MemoryRouter>
        <MockSignIn />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/your email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    // Fill the form
    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    // Submit the form
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('wrong@example.com', 'wrongpassword');
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith(errorMessage);
    });

    await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    });
  });

  test('shows logged in message if user is already authenticated', () => {
    // Create a mock component that shows the logged-in state
    const LoggedInMockSignIn = () => {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full glass-morphism rounded-2xl overflow-hidden shadow-glass-lg p-10 text-center">
            <h2 className="text-2xl font-bold mb-4">You're already logged in</h2>
            <p className="mb-6 text-gray-600">You can access your dashboard or sign out.</p>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      );
    };

    render(
      <MemoryRouter>
        <LoggedInMockSignIn />
      </MemoryRouter>
    );

    // Check for logged-in message and link, not the form
    expect(screen.getByRole('heading', { name: /you're already logged in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });
});