import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock contexts directly
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, options?: any) => {
      const translations: Record<string, string> = {
        'segmentation.processingImage': 'Processing image',
        'project.resegmentImage': 'Resegment image',
        'project.deleteImage': 'Delete image',
      };
      let translation = translations[key] || key;
      
      // Replace template variables if needed
      if (options && typeof translation === 'string') {
        translation = translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
          return options[param] || match;
        });
      }
      
      return translation;
    },
    setLanguage: vi.fn(),
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import ImageActions from '../ImageActions';

describe('ImageActions', () => {
  const mockOnDelete = vi.fn();
  const mockOnResegment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders delete and resegment buttons', () => {
    render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} />);

    expect(screen.getByTitle('Delete image')).toBeInTheDocument();
    expect(screen.getByTitle('Resegment image')).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} />);

    const deleteButton = screen.getByTitle('Delete image');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onResegment when resegment button is clicked', () => {
    render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} />);

    const resegmentButton = screen.getByTitle('Resegment image');
    fireEvent.click(resegmentButton);

    expect(mockOnResegment).toHaveBeenCalledTimes(1);
  });

  it('does not render resegment button when onResegment is not provided', () => {
    render(<ImageActions onDelete={mockOnDelete} />);

    expect(screen.getByTitle('Delete image')).toBeInTheDocument();
    expect(screen.queryByTitle('Resegment image')).not.toBeInTheDocument();
  });

  describe('isProcessing prop', () => {
    it('applies animate-spin class when isProcessing is true', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={true} />);

      const resegmentIcon = screen.getByTitle('Processing image').querySelector('svg');
      expect(resegmentIcon).toHaveClass('animate-spin');
    });

    it('does not apply animate-spin class when isProcessing is false', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={false} />);

      const resegmentIcon = screen.getByTitle('Resegment image').querySelector('svg');
      expect(resegmentIcon).not.toHaveClass('animate-spin');
    });

    it('does not apply animate-spin class when isProcessing is undefined', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} />);

      const resegmentIcon = screen.getByTitle('Resegment image').querySelector('svg');
      expect(resegmentIcon).not.toHaveClass('animate-spin');
    });

    it('disables resegment button when isProcessing is true', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={true} />);

      const resegmentButton = screen.getByTitle('Processing image');
      expect(resegmentButton).toBeDisabled();
    });

    it('enables resegment button when isProcessing is false', () => {
      render(<ImageActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={false} />);

      const resegmentButton = screen.getByTitle('Resegment image');
      expect(resegmentButton).not.toBeDisabled();
    });
  });
});
