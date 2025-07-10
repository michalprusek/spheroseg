import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImageActions } from '../ImageActions';

describe('ImageActions', () => {
  const mockOnDelete = vi.fn();
  const mockOnResegment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders delete and resegment buttons', () => {
    render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} />);

    expect(screen.getByLabelText('Delete image')).toBeInTheDocument();
    expect(screen.getByLabelText('Resegment image')).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} />);

    const deleteButton = screen.getByLabelText('Delete image');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onResegment when resegment button is clicked', () => {
    render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} />);

    const resegmentButton = screen.getByLabelText('Resegment image');
    fireEvent.click(resegmentButton);

    expect(mockOnResegment).toHaveBeenCalledTimes(1);
  });

  it('does not render resegment button when onResegment is not provided', () => {
    render(<ImageActions onDelete={mockOnDelete} />);

    expect(screen.getByLabelText('Delete image')).toBeInTheDocument();
    expect(screen.queryByLabelText('Resegment image')).not.toBeInTheDocument();
  });

  describe('isProcessing prop', () => {
    it('applies animate-spin class when isProcessing is true', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={true} />);

      const resegmentIcon = screen.getByLabelText('Resegment image').querySelector('svg');
      expect(resegmentIcon).toHaveClass('animate-spin');
    });

    it('does not apply animate-spin class when isProcessing is false', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={false} />);

      const resegmentIcon = screen.getByLabelText('Resegment image').querySelector('svg');
      expect(resegmentIcon).not.toHaveClass('animate-spin');
    });

    it('does not apply animate-spin class when isProcessing is undefined', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} />);

      const resegmentIcon = screen.getByLabelText('Resegment image').querySelector('svg');
      expect(resegmentIcon).not.toHaveClass('animate-spin');
    });

    it('disables resegment button when isProcessing is true', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={true} />);

      const resegmentButton = screen.getByLabelText('Resegment image');
      expect(resegmentButton).toBeDisabled();
    });

    it('enables resegment button when isProcessing is false', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={false} />);

      const resegmentButton = screen.getByLabelText('Resegment image');
      expect(resegmentButton).not.toBeDisabled();
    });
  });
});
