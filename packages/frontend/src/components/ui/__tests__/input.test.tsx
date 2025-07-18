import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../input';
import '@testing-library/jest-dom';

describe('Input Component', () => {
  it('renders with default attributes', () => {
    render(<Input placeholder="Enter text" />);

    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('h-10');
    expect(input).toHaveClass('w-full');
    expect(input).toHaveClass('rounded-md');
    expect(input).toHaveClass('border');
    expect(input).toHaveClass('border-input');
  });

  it('applies custom className', () => {
    render(<Input className="custom-class" placeholder="Enter text" />);

    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toHaveClass('custom-class');
    expect(input).toHaveClass('h-10'); // Still has default classes
  });

  it('handles different input types', () => {
    const { rerender } = render(<Input type="text" placeholder="Text input" />);

    let input = screen.getByPlaceholderText('Text input');
    expect(input).toHaveAttribute('type', 'text');

    rerender(<Input type="password" placeholder="Password input" />);
    input = screen.getByPlaceholderText('Password input');
    expect(input).toHaveAttribute('type', 'password');

    rerender(<Input type="email" placeholder="Email input" />);
    input = screen.getByPlaceholderText('Email input');
    expect(input).toHaveAttribute('type', 'email');

    rerender(<Input type="number" placeholder="Number input" />);
    input = screen.getByPlaceholderText('Number input');
    expect(input).toHaveAttribute('type', 'number');
  });

  it('handles value changes', () => {
    const handleChange = vi.fn();
    render(<Input placeholder="Enter text" onChange={handleChange} />);

    const input = screen.getByPlaceholderText('Enter text');
    fireEvent.change(input, { target: { value: 'New value' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('New value');
  });

  it('renders as disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled input" />);

    const input = screen.getByPlaceholderText('Disabled input');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('disabled:cursor-not-allowed');
    expect(input).toHaveClass('disabled:opacity-50');
  });

  it('passes additional props to the input element', () => {
    render(<Input data-testid="input-test" aria-label="Input Label" maxLength={10} placeholder="Test input" />);

    const input = screen.getByPlaceholderText('Test input');
    expect(input).toHaveAttribute('data-testid', 'input-test');
    expect(input).toHaveAttribute('aria-label', 'Input Label');
    expect(input).toHaveAttribute('maxLength', '10');
  });
});
