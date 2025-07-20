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

import ImageListActions from '../ImageListActions';

describe('ImageListActions', () => {
  const mockOnDelete = vi.fn();
  const mockOnResegment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both action buttons', () => {
    render(<ImageListActions onDelete={mockOnDelete} onResegment={mockOnResegment} />);

    expect(screen.getByTitle('Delete image')).toBeInTheDocument();
    expect(screen.getByTitle('Resegment image')).toBeInTheDocument();
  });

  describe('isProcessing prop', () => {
    it('shows spinner animation when isProcessing is true', () => {
      render(<ImageListActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={true} />);

      const resegmentIcon = screen.getByTitle('Processing image').querySelector('svg');
      expect(resegmentIcon).toHaveClass('animate-spin');
    });

    it('does not show spinner animation when isProcessing is false', () => {
      render(<ImageListActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={false} />);

      const resegmentIcon = screen.getByTitle('Resegment image').querySelector('svg');
      expect(resegmentIcon).not.toHaveClass('animate-spin');
    });

    it('disables resegment button during processing', () => {
      render(<ImageListActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={true} />);

      const resegmentButton = screen.getByTitle('Processing image');
      expect(resegmentButton).toBeDisabled();
    });

    it('prevents click events when processing', () => {
      render(<ImageListActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={true} />);

      const resegmentButton = screen.getByTitle('Processing image');
      fireEvent.click(resegmentButton);

      expect(mockOnResegment).not.toHaveBeenCalled();
    });
  });

  it('maintains visual consistency with ImageActions component', () => {
    const { container } = render(
      <ImageListActions onDelete={mockOnDelete} onResegment={mockOnResegment} isProcessing={true} />,
    );

    // Check that the same classes are applied for spinner animation
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
