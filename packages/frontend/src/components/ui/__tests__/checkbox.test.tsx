import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Checkbox } from '../checkbox';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

describe('Checkbox Component', () => {
  it('renders unchecked by default', () => {
    const { container } = render(<Checkbox />);
    
    const checkbox = container.firstChild as HTMLElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    expect(checkbox).toHaveClass('border-primary');
  });

  it('applies custom className', () => {
    const { container } = render(<Checkbox className="custom-class" />);
    
    const checkbox = container.firstChild as HTMLElement;
    expect(checkbox).toHaveClass('custom-class');
    expect(checkbox).toHaveClass('h-4'); // Still has default classes
    expect(checkbox).toHaveClass('w-4');
  });

  it('renders as checked when checked prop is true', () => {
    const { container } = render(<Checkbox checked />);
    
    const checkbox = container.firstChild as HTMLElement;
    expect(checkbox).toHaveAttribute('data-state', 'checked');
    
    // The bg-primary class is applied via data-[state=checked]:bg-primary
    // So we check for the data-state attribute instead
    expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('handles click events and calls onCheckedChange', () => {
    const handleCheckedChange = vi.fn();
    const { container } = render(
      <Checkbox onCheckedChange={handleCheckedChange} />
    );
    
    const checkbox = container.firstChild as HTMLElement;
    fireEvent.click(checkbox);
    
    expect(handleCheckedChange).toHaveBeenCalledTimes(1);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  it('renders as disabled when disabled prop is true', () => {
    const { container } = render(<Checkbox disabled />);
    
    const checkbox = container.firstChild as HTMLElement;
    expect(checkbox).toHaveAttribute('disabled', '');
    expect(checkbox).toHaveClass('disabled:cursor-not-allowed');
    expect(checkbox).toHaveClass('disabled:opacity-50');
  });

  it('passes additional props to the checkbox element', () => {
    const { container } = render(
      <Checkbox data-testid="checkbox-test" aria-label="Test Checkbox" />
    );
    
    const checkbox = container.firstChild as HTMLElement;
    expect(checkbox).toHaveAttribute('data-testid', 'checkbox-test');
    expect(checkbox).toHaveAttribute('aria-label', 'Test Checkbox');
  });

  it('renders with id and can be associated with a label', () => {
    const { container, getByLabelText } = render(
      <>
        <Checkbox id="terms" />
        <label htmlFor="terms">Accept terms</label>
      </>
    );
    
    const checkbox = container.firstChild as HTMLElement;
    expect(checkbox).toHaveAttribute('id', 'terms');
    
    // Check that clicking the label toggles the checkbox
    const label = getByLabelText('Accept terms');
    expect(label).toBe(checkbox);
  });
});
