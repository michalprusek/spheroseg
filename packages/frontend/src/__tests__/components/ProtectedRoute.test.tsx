import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import '@testing-library/jest-dom';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
}));

// Mock components for testing
const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;
const LoginPage = () => <div data-testid="login-page">Login Page</div>;

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  interface AuthState {
    user: { id: string; email: string } | null;
    loading: boolean;
  }

  const renderWithRouter = (authState: AuthState) => {
    // Set up the mock implementation for useAuth
    (useAuth as jest.Mock).mockReturnValue(authState);

    return render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/sign-in" element={<LoginPage />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('renders the protected content when user is authenticated', () => {
    renderWithRouter({
      user: { id: 'test-user-id', email: 'test@example.com' },
      loading: false,
    });

    // Protected content should be rendered
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();

    // Login page should not be rendered
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('redirects to login page when user is not authenticated', () => {
    renderWithRouter({
      user: null,
      loading: false,
    });

    // Protected content should not be rendered
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

    // Login page should be rendered
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('shows loading state while checking authentication', () => {
    renderWithRouter({
      user: null,
      loading: true,
    });

    // Protected content should not be rendered
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

    // Login page should not be rendered yet
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();

    // Loading indicator should be shown
    expect(screen.getByText('Loading your account...')).toBeInTheDocument();
  });
});
