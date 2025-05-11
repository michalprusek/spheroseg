import React from 'react';
import { render } from '@testing-library/react';
import { Badge } from '../badge';
import '@testing-library/jest-dom';

describe('Badge Component', () => {
  it('renders with default variant', () => {
    const { container } = render(<Badge>Default Badge</Badge>);
    const badge = container.firstChild as HTMLElement;

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-primary');
    expect(badge).toHaveClass('text-primary-foreground');
    expect(badge).toHaveClass('border-transparent');
    expect(badge).toHaveTextContent('Default Badge');
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom-class">Badge</Badge>);
    const badge = container.firstChild as HTMLElement;

    expect(badge).toHaveClass('custom-class');
    expect(badge).toHaveClass('bg-primary'); // Still has default classes
  });

  it('renders with secondary variant', () => {
    const { container } = render(<Badge variant="secondary">Secondary Badge</Badge>);
    const badge = container.firstChild as HTMLElement;

    expect(badge).toHaveClass('bg-secondary');
    expect(badge).toHaveClass('text-secondary-foreground');
    expect(badge).toHaveClass('border-transparent');
  });

  it('renders with destructive variant', () => {
    const { container } = render(<Badge variant="destructive">Destructive Badge</Badge>);
    const badge = container.firstChild as HTMLElement;

    expect(badge).toHaveClass('bg-destructive');
    expect(badge).toHaveClass('text-destructive-foreground');
    expect(badge).toHaveClass('border-transparent');
  });

  it('renders with outline variant', () => {
    const { container } = render(<Badge variant="outline">Outline Badge</Badge>);
    const badge = container.firstChild as HTMLElement;

    expect(badge).toHaveClass('text-foreground');
    expect(badge).not.toHaveClass('bg-primary');
    expect(badge).not.toHaveClass('bg-secondary');
    expect(badge).not.toHaveClass('bg-destructive');
  });

  it('passes additional props to the div element', () => {
    const { container } = render(
      <Badge data-testid="badge-test" aria-label="Badge Label">
        Badge
      </Badge>,
    );
    const badge = container.firstChild as HTMLElement;

    expect(badge).toHaveAttribute('data-testid', 'badge-test');
    expect(badge).toHaveAttribute('aria-label', 'Badge Label');
  });
});
