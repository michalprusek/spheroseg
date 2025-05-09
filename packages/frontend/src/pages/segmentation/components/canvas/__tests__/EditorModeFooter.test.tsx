import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EditorModeFooter from '../EditorModeFooter';
import '@testing-library/jest-dom';

describe('EditorModeFooter Component', () => {
  it('renders with the correct text', () => {
    render(<EditorModeFooter mode="edit" text="Edit Mode Active" />);
    expect(screen.getByText('Edit Mode Active')).toBeInTheDocument();
  });

  it('applies the orange gradient class for edit mode', () => {
    const { container } = render(<EditorModeFooter mode="edit" text="Edit Mode" />);
    const footer = container.firstChild as HTMLElement;
    expect(footer).toHaveClass('bg-gradient-to-r');
    expect(footer).toHaveClass('from-orange-600');
    expect(footer).toHaveClass('to-orange-500');
  });

  it('applies the red gradient class for slice mode', () => {
    const { container } = render(<EditorModeFooter mode="slice" text="Slice Mode" />);
    const footer = container.firstChild as HTMLElement;
    expect(footer).toHaveClass('bg-gradient-to-r');
    expect(footer).toHaveClass('from-red-600');
    expect(footer).toHaveClass('to-red-500');
  });

  it('applies the green gradient class for add mode', () => {
    const { container } = render(<EditorModeFooter mode="add" text="Add Points Mode" />);
    const footer = container.firstChild as HTMLElement;
    expect(footer).toHaveClass('bg-gradient-to-r');
    expect(footer).toHaveClass('from-green-600');
    expect(footer).toHaveClass('to-green-500');
  });

  it('applies the blue gradient class for unknown mode', () => {
    // @ts-ignore - testing default case with invalid mode
    const { container } = render(<EditorModeFooter mode="unknown" text="Unknown Mode" />);
    const footer = container.firstChild as HTMLElement;
    expect(footer).toHaveClass('bg-gradient-to-r');
    expect(footer).toHaveClass('from-blue-600');
    expect(footer).toHaveClass('to-blue-500');
  });

  it('has the correct positioning classes', () => {
    const { container } = render(<EditorModeFooter mode="edit" text="Edit Mode" />);
    const footer = container.firstChild as HTMLElement;
    expect(footer).toHaveClass('absolute');
    expect(footer).toHaveClass('bottom-4');
    expect(footer).toHaveClass('left-4');
  });

  it('has the correct text styling classes', () => {
    const { container } = render(<EditorModeFooter mode="edit" text="Edit Mode" />);
    const footer = container.firstChild as HTMLElement;
    expect(footer).toHaveClass('text-white');
    expect(footer).toHaveClass('text-sm');
    expect(footer).toHaveClass('font-semibold');
  });

  it('has the correct padding and border radius classes', () => {
    const { container } = render(<EditorModeFooter mode="edit" text="Edit Mode" />);
    const footer = container.firstChild as HTMLElement;
    expect(footer).toHaveClass('px-4');
    expect(footer).toHaveClass('py-2');
    expect(footer).toHaveClass('rounded-md');
  });

  it('has the shadow class for elevation effect', () => {
    const { container } = render(<EditorModeFooter mode="edit" text="Edit Mode" />);
    const footer = container.firstChild as HTMLElement;
    expect(footer).toHaveClass('shadow-lg');
  });

  it('renders correctly with long text', () => {
    const longText = "This is a very long text that should still be displayed correctly in the footer component";
    render(<EditorModeFooter mode="edit" text={longText} />);
    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  it('renders correctly with empty text', () => {
    const { container } = render(<EditorModeFooter mode="edit" text="" />);
    const footer = container.firstChild as HTMLElement;
    expect(footer).toBeInTheDocument();
    expect(footer.textContent).toBe('');
  });

  it('renders with different mode and text', () => {
    render(<EditorModeFooter mode="slice" text="Slice Mode" />);
    expect(screen.getByText('Slice Mode')).toBeInTheDocument();
  });

  it('renders with edit mode text', () => {
    render(<EditorModeFooter mode="edit" text="Edit Mode" />);
    expect(screen.getByText('Edit Mode')).toBeInTheDocument();
  });

  it('renders with slice mode text', () => {
    render(<EditorModeFooter mode="slice" text="Slice Mode" />);
    expect(screen.getByText('Slice Mode')).toBeInTheDocument();
  });

  it('renders with add mode text', () => {
    render(<EditorModeFooter mode="add" text="Add Points Mode" />);
    expect(screen.getByText('Add Points Mode')).toBeInTheDocument();
  });

  it('renders with unknown mode text', () => {
    // @ts-ignore - testing default case with invalid mode
    render(<EditorModeFooter mode="unknown" text="Unknown Mode" />);
    expect(screen.getByText('Unknown Mode')).toBeInTheDocument();
  });
});