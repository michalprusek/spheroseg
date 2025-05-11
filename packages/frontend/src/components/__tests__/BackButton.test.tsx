import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import BackButton from '../BackButton';

// Create a mock function for navigation
const mockNavigate = vi.fn();

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      // Simple mock translation function
      const translations: Record<string, string> = {
        'common.backToHome': 'Back to Home',
      };
      return translations[key] || key;
    },
  }),
}));

describe('BackButton Component', () => {
  it('renders correctly', () => {
    render(<BackButton />);

    // Check that the button is rendered with the correct aria-label
    const button = screen.getByLabelText('Back to Home');
    expect(button).toBeInTheDocument();
  });

  it('navigates to homepage when clicked', () => {
    // Clear any previous calls
    mockNavigate.mockClear();

    render(<BackButton />);

    // Get the button and click it
    const button = screen.getByLabelText('Back to Home');
    fireEvent.click(button);

    // Confirm navigation was attempted
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('has the correct styling', () => {
    render(<BackButton />);

    const button = screen.getByLabelText('Back to Home');

    // Check that the button has the expected class names
    expect(button).toHaveClass('text-gray-600');
    expect(button).toHaveClass('hover:text-gray-900');
    expect(button).toHaveClass('dark:text-gray-400');
    expect(button).toHaveClass('dark:hover:text-gray-100');
  });
});
