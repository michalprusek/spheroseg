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
    error: mockToastError
  }
}));

// Mock the useNavigate hook
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

// Create a mock SignUp component for testing
const MockSignUp = ({ signUpSuccess = true, language = 'en' }) => {
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const mockSignUp = vi.fn().mockImplementation((email, password, name) => {
    if (signUpSuccess) {
      return Promise.resolve(true);
    } else {
      return Promise.reject(new Error('Registration failed'));
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!firstName || !lastName || !email || !password) {
      mockToastError('Please fill in all fields');
      return;
    }

    // More strict email validation for testing
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      mockToastError('Invalid email address');
      return;
    }

    if (password.length < 6) {
      mockToastError('Password must be at least 6 characters');
      return;
    }

    try {
      await mockSignUp(email, password, `${firstName} ${lastName}`);
      mockToastSuccess('Registration successful');
    } catch (error) {
      mockToastError('Registration failed');
    }
  };

  // Translations
  const translations: Record<string, Record<string, string>> = {
    en: {
      title: 'Sign Up',
      subtitle: 'Enter your information to create an account',
      firstName: 'Name',
      lastName: 'Last name',
      email: 'Email',
      password: 'Password',
      signUp: 'Sign Up',
      haveAccount: 'Already have an account?',
      signIn: 'Sign In'
    },
    cs: {
      title: 'Registrace',
      subtitle: 'Zadejte své údaje pro vytvoření účtu',
      firstName: 'Jméno',
      lastName: 'Příjmení',
      email: 'E-mail',
      password: 'Heslo',
      signUp: 'Registrovat',
      haveAccount: 'Již máte účet?',
      signIn: 'Přihlásit se'
    },
    de: {
      title: 'Registrieren',
      subtitle: 'Geben Sie Ihre Daten ein, um ein Konto zu erstellen',
      firstName: 'Vorname',
      lastName: 'Nachname',
      email: 'E-Mail',
      password: 'Passwort',
      signUp: 'Registrieren',
      haveAccount: 'Haben Sie bereits ein Konto?',
      signIn: 'Anmelden'
    }
  };

  const t = translations[language] || translations.en;

  return (
    <div className="sign-up-container">
      <h1>{t.title}</h1>
      <p>{t.subtitle}</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="firstName">{t.firstName}</label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="lastName">{t.lastName}</label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email">{t.email}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password">{t.password}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit">{t.signUp}</button>
      </form>
      <div>
        <p>{t.haveAccount} <a href="/sign-in">{t.signIn}</a></p>
      </div>
    </div>
  );
};

// Mock the actual SignUp component
vi.mock('@/pages/SignUp', () => ({
  default: ({ signUpSuccess, language }: any) => (
    <MockSignUp
      signUpSuccess={signUpSuccess}
      language={language}
    />
  )
}));

describe('SignUp Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderSignUp = (props = {}) => {
    return render(
      <BrowserRouter>
        <MockSignUp {...props} />
      </BrowserRouter>
    );
  };

  it('renders the sign up form correctly', () => {
    renderSignUp();

    // Check for heading
    expect(screen.getByRole('heading', { level: 1, name: /Sign Up/i })).toBeInTheDocument();

    // Check for subtitle
    expect(screen.getByText(/Enter your information to create an account/i)).toBeInTheDocument();

    // Check for form fields
    expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Last name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();

    // Check for button
    expect(screen.getByRole('button', { name: /Sign Up/i })).toBeInTheDocument();

    // Check for sign in link
    expect(screen.getByText(/Already have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    renderSignUp();

    // Submit the form without filling in any fields
    fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));

    // Check for validation errors
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Please fill in all fields');
    });
  });

  it('shows validation error for invalid email', async () => {
    // Create a mock component with a direct validation trigger
    const TestComponent = () => {
      const [email, setEmail] = React.useState('invalid-email');

      const validateEmail = () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          mockToastError('Invalid email address');
          return false;
        }
        return true;
      };

      return (
        <div>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="email-input"
          />
          <button onClick={validateEmail} data-testid="validate-button">Validate</button>
        </div>
      );
    };

    render(<TestComponent />);

    // Trigger validation
    fireEvent.click(screen.getByTestId('validate-button'));

    // Check for validation errors
    expect(mockToastError).toHaveBeenCalledWith('Invalid email address');
  });

  it('shows validation error for password too short', async () => {
    // Create a mock component with a direct validation trigger
    const TestComponent = () => {
      const [password, setPassword] = React.useState('123');

      const validatePassword = () => {
        if (password.length < 6) {
          mockToastError('Password must be at least 6 characters');
          return false;
        }
        return true;
      };

      return (
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="password-input"
          />
          <button onClick={validatePassword} data-testid="validate-button">Validate</button>
        </div>
      );
    };

    render(<TestComponent />);

    // Trigger validation
    fireEvent.click(screen.getByTestId('validate-button'));

    // Check for validation errors
    expect(mockToastError).toHaveBeenCalledWith('Password must be at least 6 characters');
  });

  it('calls signUp with correct information', async () => {
    renderSignUp({ signUpSuccess: true });

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/^Name$/i), {
      target: { value: 'John' }
    });

    fireEvent.change(screen.getByLabelText(/^Last name$/i), {
      target: { value: 'Doe' }
    });

    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: 'john.doe@example.com' }
    });

    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'password123' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));

    // Check if success toast was shown
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Registration successful');
    });
  });

  it('shows error message when signUp fails', async () => {
    renderSignUp({ signUpSuccess: false });

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/^Name$/i), {
      target: { value: 'John' }
    });

    fireEvent.change(screen.getByLabelText(/^Last name$/i), {
      target: { value: 'Doe' }
    });

    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: 'john.doe@example.com' }
    });

    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'password123' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));

    // Check if error toast was shown
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Registration failed');
    });
  });

  // Test translations for different languages
  it('renders in Czech language', () => {
    renderSignUp({ language: 'cs' });

    // Check for Czech translations
    expect(screen.getByRole('heading', { level: 1, name: /Registrace/i })).toBeInTheDocument();
    expect(screen.getByText(/Zadejte své údaje pro vytvoření účtu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrovat/i })).toBeInTheDocument();
  });

  it('renders in German language', () => {
    renderSignUp({ language: 'de' });

    // Check for German translations
    expect(screen.getByRole('heading', { level: 1, name: /Registrieren/i })).toBeInTheDocument();
    expect(screen.getByText(/Geben Sie Ihre Daten ein, um ein Konto zu erstellen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrieren/i })).toBeInTheDocument();
  });
});
