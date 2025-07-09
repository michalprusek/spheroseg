import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImageListActions } from '../ImageListActions';

describe('ImageListActions', () => {
  const mockOnDelete = vi.fn();
  const mockOnResegment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both action buttons', () => {
    render(
      <ImageListActions 
        onDelete={mockOnDelete}
        onResegment={mockOnResegment}
      />
    );

    expect(screen.getByLabelText('Delete image')).toBeInTheDocument();
    expect(screen.getByLabelText('Resegment image')).toBeInTheDocument();
  });

  describe('isProcessing prop', () => {
    it('shows spinner animation when isProcessing is true', () => {
      render(
        <ImageListActions 
          onDelete={mockOnDelete}
          onResegment={mockOnResegment}
          isProcessing={true}
        />
      );

      const resegmentIcon = screen.getByLabelText('Resegment image').querySelector('svg');
      expect(resegmentIcon).toHaveClass('animate-spin');
    });

    it('does not show spinner animation when isProcessing is false', () => {
      render(
        <ImageListActions 
          onDelete={mockOnDelete}
          onResegment={mockOnResegment}
          isProcessing={false}
        />
      );

      const resegmentIcon = screen.getByLabelText('Resegment image').querySelector('svg');
      expect(resegmentIcon).not.toHaveClass('animate-spin');
    });

    it('disables resegment button during processing', () => {
      render(
        <ImageListActions 
          onDelete={mockOnDelete}
          onResegment={mockOnResegment}
          isProcessing={true}
        />
      );

      const resegmentButton = screen.getByLabelText('Resegment image');
      expect(resegmentButton).toBeDisabled();
    });

    it('prevents click events when processing', () => {
      render(
        <ImageListActions 
          onDelete={mockOnDelete}
          onResegment={mockOnResegment}
          isProcessing={true}
        />
      );

      const resegmentButton = screen.getByLabelText('Resegment image');
      fireEvent.click(resegmentButton);

      expect(mockOnResegment).not.toHaveBeenCalled();
    });
  });

  it('maintains visual consistency with ImageActions component', () => {
    const { container } = render(
      <ImageListActions 
        onDelete={mockOnDelete}
        onResegment={mockOnResegment}
        isProcessing={true}
      />
    );

    // Check that the same classes are applied for spinner animation
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});