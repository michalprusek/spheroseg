import { render } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '../alert';
import '@testing-library/jest-dom';

describe('Alert Component', () => {
  it('renders with default variant', () => {
    const { container } = render(
      <Alert>
        <AlertTitle>Alert Title</AlertTitle>
        <AlertDescription>Alert Description</AlertDescription>
      </Alert>,
    );

    const alert = container.firstChild as HTMLElement;
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveClass('bg-background');
    expect(alert).toHaveClass('text-foreground');

    // Check title and description
    expect(alert.querySelector('h5')).toHaveTextContent('Alert Title');
    expect(alert.querySelector('div')).toHaveTextContent('Alert Description');
  });

  it('applies custom className', () => {
    const { container } = render(<Alert className="custom-class">Alert Content</Alert>);

    const alert = container.firstChild as HTMLElement;
    expect(alert).toHaveClass('custom-class');
    expect(alert).toHaveClass('bg-background'); // Still has default classes
  });

  it('renders with destructive variant', () => {
    const { container } = render(<Alert variant="destructive">Destructive Alert</Alert>);

    const alert = container.firstChild as HTMLElement;
    expect(alert).toHaveClass('border-destructive/50');
    expect(alert).toHaveClass('text-destructive');
    expect(alert).toHaveClass('dark:border-destructive');
  });

  it('renders AlertTitle with custom className', () => {
    const { getByText } = render(<AlertTitle className="custom-title-class">Custom Title</AlertTitle>);

    const title = getByText('Custom Title');
    expect(title).toHaveClass('custom-title-class');
    expect(title).toHaveClass('mb-1');
    expect(title).toHaveClass('font-medium');
  });

  it('renders AlertDescription with custom className', () => {
    const { getByText } = render(<AlertDescription className="custom-desc-class">Custom Description</AlertDescription>);

    const description = getByText('Custom Description');
    expect(description).toHaveClass('custom-desc-class');
    expect(description).toHaveClass('text-sm');
  });

  it('passes additional props to the alert element', () => {
    const { container } = render(
      <Alert data-testid="alert-test" aria-label="Important Alert">
        Alert Content
      </Alert>,
    );

    const alert = container.firstChild as HTMLElement;
    expect(alert).toHaveAttribute('data-testid', 'alert-test');
    expect(alert).toHaveAttribute('aria-label', 'Important Alert');
  });
});
