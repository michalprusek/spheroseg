import React from 'react';
import { render, screen } from '@testing-library/react';
import { VisuallyHidden } from '@/components/a11y';

describe('VisuallyHidden', () => {
  it('renders children correctly', () => {
    render(<VisuallyHidden>Test content</VisuallyHidden>);

    const element = screen.getByText('Test content');
    expect(element).toBeInTheDocument();
    expect(element.tagName).toBe('SPAN');
    expect(element).toHaveClass('sr-only');
  });

  it('renders with custom element tag', () => {
    render(<VisuallyHidden as="div">Test content</VisuallyHidden>);

    const element = screen.getByText('Test content');
    expect(element).toBeInTheDocument();
    expect(element.tagName).toBe('DIV');
  });

  it('applies additional className when provided', () => {
    render(<VisuallyHidden className="custom-class">Test content</VisuallyHidden>);

    const element = screen.getByText('Test content');
    expect(element).toHaveClass('sr-only');
    expect(element).toHaveClass('custom-class');
  });

  it('passes additional props to the element', () => {
    render(
      <VisuallyHidden data-testid="custom-test-id" aria-label="Hidden text">
        Test content
      </VisuallyHidden>,
    );

    const element = screen.getByTestId('custom-test-id');
    expect(element).toHaveAttribute('aria-label', 'Hidden text');
    expect(element).toHaveTextContent('Test content');
  });
});
