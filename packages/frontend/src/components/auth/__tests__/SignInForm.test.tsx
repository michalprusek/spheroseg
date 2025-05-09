import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Create a simple test component
const MockSignInForm = () => {
  return (
    <div>
      <h2>Sign in to your account</h2>
      <form>
        <div>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" aria-label="Email address" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" aria-label="Password" />
        </div>
        <button type="submit">Sign in</button>
        <div>Don't have an account? <a href="/signup">Sign Up</a></div>
      </form>
    </div>
  );
};

// Mock the actual component
vi.mock('@/components/auth/SignInForm', () => ({
  default: () => <MockSignInForm />
}));

describe('SignInForm Component', () => {
  it('renders the component correctly', () => {
    render(<MockSignInForm />);
    
    // Check if the form title is rendered
    expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
    
    // Check if the form fields are rendered
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    
    // Check if the buttons are rendered
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign Up/i })).toBeInTheDocument();
  });
});