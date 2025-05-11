import React from 'react';
import { render, screen } from '@testing-library/react';
import { SkipLink } from '@/components/a11y';

// Mock the useLanguage hook
jest.mock('@/contexts/LanguageContext', () => ({
  ...jest.requireActual('@/contexts/LanguageContext'),
  useLanguage: () => ({
    t: (key: string, fallback: string) => fallback,
    language: 'en',
    setLanguage: jest.fn(),
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SkipLink', () => {
  it('renders correctly with default props', () => {
    render(<SkipLink targetId="main-content" />);

    const skipLink = screen.getByTestId('skip-link');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(skipLink).toHaveClass('skip-link');
    expect(skipLink).toHaveTextContent('Skip to main content');
  });

  it('applies additional className when provided', () => {
    render(<SkipLink targetId="main-content" className="custom-class" />);

    const skipLink = screen.getByTestId('skip-link');
    expect(skipLink).toHaveClass('skip-link');
    expect(skipLink).toHaveClass('custom-class');
  });

  it('links to the correct target ID', () => {
    render(<SkipLink targetId="custom-target" />);

    const skipLink = screen.getByTestId('skip-link');
    expect(skipLink).toHaveAttribute('href', '#custom-target');
  });
});
