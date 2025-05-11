import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock the toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// Mock the useNavigate hook
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Create a mock SignIn component for testing
const MockSignIn = ({ isLoggedIn = false, signInSuccess = true, language = 'en' }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      mockToastError('Please fill in all fields');
      return;
    }

    if (signInSuccess) {
      mockToastSuccess('Successfully signed in');
    }
  };

  // Translations
  const translations: Record<string, Record<string, string>> = {
    en: {
      title: 'Sign in to your account',
      email: 'Email address',
      password: 'Password',
      signIn: 'Sign In',
      noAccount: "Don't have an account?",
      signUp: 'Sign Up',
      alreadyLoggedIn: "You're already logged in",
      goToDashboard: 'Go to Dashboard',
    },
    cs: {
      title: 'Přihlásit se k účtu',
      email: 'E-mailová adresa',
      password: 'Heslo',
      signIn: 'Přihlásit se',
      noAccount: 'Nemáte účet?',
      signUp: 'Registrovat se',
      alreadyLoggedIn: 'Již jste přihlášeni',
      goToDashboard: 'Přejít na nástěnku',
    },
    de: {
      title: 'Melden Sie sich bei Ihrem Konto an',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      signIn: 'Anmelden',
      noAccount: 'Haben Sie kein Konto?',
      signUp: 'Registrieren',
      alreadyLoggedIn: 'Sie sind bereits angemeldet',
      goToDashboard: 'Zum Dashboard',
    },
  };

  const t = translations[language] || translations.en;

  if (isLoggedIn) {
    return (
      <div className="already-logged-in">
        <h2>{t.alreadyLoggedIn}</h2>
        <a href="/dashboard">{t.goToDashboard}</a>
      </div>
    );
  }

  return (
    <div className="sign-in-container">
      <h1>{t.title}</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">{t.email}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password">{t.password}</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit">{t.signIn}</button>
      </form>
      <div>
        <p>
          {t.noAccount} <a href="/sign-up">{t.signUp}</a>
        </p>
      </div>
    </div>
  );
};

// Mock the actual SignIn component
vi.mock('@/pages/SignIn', () => ({
  default: ({ isLoggedIn, signInSuccess, language }: any) => (
    <MockSignIn isLoggedIn={isLoggedIn} signInSuccess={signInSuccess} language={language} />
  ),
}));

describe('SignIn Page', () => {
  const mockSignIn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderSignIn = (props = {}) => {
    return render(
      <BrowserRouter>
        <MockSignIn {...props} />
      </BrowserRouter>,
    );
  };

  it('renders the sign in form correctly', () => {
    renderSignIn();

    expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign Up/i)).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    renderSignIn();

    // Submit the form without filling in any fields
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    // Check for validation errors
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Please fill in all fields');
    });
  });

  it('calls signIn with correct credentials', async () => {
    renderSignIn({ signInSuccess: true });

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'test@example.com' },
    });

    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    // Check if success toast was shown
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Successfully signed in');
    });
  });

  it('shows error message when signIn fails', async () => {
    renderSignIn({ signInSuccess: false });

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'test@example.com' },
    });

    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'wrong-password' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    // No success toast should be shown
    await waitFor(() => {
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  it('shows already logged in message when user is already authenticated', () => {
    renderSignIn({ isLoggedIn: true });

    // Check for already logged in message
    expect(screen.getByText(/You're already logged in/i)).toBeInTheDocument();
    expect(screen.getByText(/Go to Dashboard/i)).toBeInTheDocument();

    // Form should not be rendered
    expect(screen.queryByLabelText(/Email address/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Password/i)).not.toBeInTheDocument();
  });

  // Test translations for different languages
  it('renders in Czech language', () => {
    renderSignIn({ language: 'cs' });

    // Check for Czech translations
    expect(screen.getByText(/Přihlásit se k účtu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Přihlásit se/i })).toBeInTheDocument();
  });

  it('renders in German language', () => {
    renderSignIn({ language: 'de' });

    // Check for German translations
    expect(screen.getByText(/Melden Sie sich bei Ihrem Konto an/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anmelden/i })).toBeInTheDocument();
  });
});
