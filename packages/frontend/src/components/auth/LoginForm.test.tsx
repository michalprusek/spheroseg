import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import { LoginForm } from './LoginForm';
import { server } from '@/test-utils/mocks';
import { rest } from 'msw';
import { testFormData, testUsers } from '@/test-utils/fixtures';
import {
  fillForm,
  expectFieldToHaveError,
  expectToastNotification,
  expectApiCall,
  expectNavigation,
} from '@/test-utils';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with all fields', () => {
    render(<LoginForm />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const { user } = render(<LoginForm />);
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expectFieldToHaveError('email', /required/i);
      expectFieldToHaveError('password', /required/i);
    });
  });

  it('validates email format', async () => {
    const { user } = render(<LoginForm />);
    
    await fillForm({
      email: 'invalid-email',
      password: 'password123',
    });
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expectFieldToHaveError('email', /invalid email/i);
    });
  });

  it('successfully logs in user', async () => {
    const mockOnSuccess = vi.fn();
    const { user } = render(<LoginForm onSuccess={mockOnSuccess} />);
    
    await fillForm(testFormData.loginForm);
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expectApiCall('/auth/login', {
        method: 'POST',
        body: {
          email: testFormData.loginForm.email,
          password: testFormData.loginForm.password,
        },
      });
      
      expectToastNotification(/login successful/i, 'success');
      expect(mockOnSuccess).toHaveBeenCalledWith(expect.objectContaining({
        user: expect.any(Object),
        token: expect.any(String),
      }));
    });
  });

  it('handles login error', async () => {
    server.use(
      rest.post('/auth/login', (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({
            error: 'Invalid credentials',
            message: 'Email or password is incorrect',
          })
        );
      })
    );
    
    const { user } = render(<LoginForm />);
    
    await fillForm(testFormData.loginForm);
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expectToastNotification(/invalid credentials/i, 'error');
    });
  });

  it('disables form during submission', async () => {
    const { user } = render(<LoginForm />);
    
    await fillForm(testFormData.loginForm);
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });

  it('remembers user preference', async () => {
    const { user } = render(<LoginForm />);
    
    const rememberCheckbox = screen.getByLabelText(/remember me/i);
    await user.click(rememberCheckbox);
    
    expect(rememberCheckbox).toBeChecked();
    
    await fillForm({
      email: testFormData.loginForm.email,
      password: testFormData.loginForm.password,
    });
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(localStorage.getItem('rememberMe')).toBe('true');
    });
  });

  it('navigates to forgot password', async () => {
    const { user } = render(<LoginForm />);
    
    const forgotPasswordLink = screen.getByText(/forgot password/i);
    await user.click(forgotPasswordLink);
    
    expectNavigation('/auth/forgot-password');
  });

  it('shows password visibility toggle', async () => {
    const { user } = render(<LoginForm />);
    
    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    const toggleButton = screen.getByRole('button', { name: /show password/i });
    await user.click(toggleButton);
    
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('clears error messages on input change', async () => {
    const { user } = render(<LoginForm />);
    
    // Submit empty form to trigger errors
    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expectFieldToHaveError('email', /required/i);
    });
    
    // Type in email field
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'test@example.com');
    
    // Error should be cleared
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });
});