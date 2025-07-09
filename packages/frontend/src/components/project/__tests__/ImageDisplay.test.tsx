import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ImageDisplay } from '../ImageDisplay';
import '@testing-library/jest-dom';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock ImageActions component
vi.mock('../ImageActions', () => ({
  default: ({ onDelete, onResegment }: { onDelete: () => void; onResegment: () => void }) => (
    <div data-testid="image-actions">
      <button onClick={onDelete} data-testid="delete-button">
        Delete
      </button>
      <button onClick={onResegment} data-testid="resegment-button">
        Resegment
      </button>
    </div>
  ),
}));

// Mock ImageListActions component
vi.mock('../ImageListActions', () => ({
  default: ({ onDelete, onResegment }: { onDelete: () => void; onResegment: () => void }) => (
    <div data-testid="image-list-actions">
      <button onClick={onDelete} data-testid="delete-list-button">
        Delete
      </button>
      <button onClick={onResegment} data-testid="resegment-list-button">
        Resegment
      </button>
    </div>
  ),
}));

// Mock useTranslations hook
vi.mock('@/hooks/useTranslations', () => ({
  useTranslations: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'segmentation.status.completed': 'Zpracováno',
        'segmentation.status.processing': 'Zpracovává se',
        'segmentation.status.queued': 'Ve frontě',
        'segmentation.status.failed': 'Selhalo',
        'segmentation.status.pending': 'Čeká',
        'common.error': 'Chyba',
        'imageStatus.noImage': 'Žádný obrázek',
        'imageStatus.untitledImage': 'Nepojmenovaný obrázek',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock useSocketConnection hook
vi.mock('@/hooks/useSocketConnection', () => ({
  default: () => ({
    socket: null,
    isConnected: false,
  }),
}));

// Mock other dependencies
vi.mock('@/utils/indexedDBService', () => ({
  getImageBlob: vi.fn(),
  storeImageBlob: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('ImageDisplay Component', () => {
  const mockImage = {
    id: 'image-123',
    project_id: 'project-123',
    name: 'test-image.jpg',
    url: 'https://example.com/image.jpg',
    thumbnail_url: 'https://example.com/thumbnail.jpg',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    segmentationStatus: 'completed' as const,
  };

  const mockProps = {
    image: mockImage,
    onDelete: vi.fn(),
    onOpen: vi.fn(),
    onResegment: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Grid View Mode', () => {
    it('renders the image card with thumbnail in grid view', () => {
      render(<ImageDisplay {...mockProps} viewMode="grid" />);

      // Check if the image is rendered
      const image = screen.getByAltText('test-image.jpg');
      expect(image).toBeInTheDocument();

      // Check if the image name is displayed
      expect(screen.getByText('test-image.jpg')).toBeInTheDocument();

      // Check if the date is displayed
      const dateElement = screen.getByText(/January 1/i);
      expect(dateElement).toBeInTheDocument();

      // Check if the status badge is displayed
      expect(screen.getByText('Zpracováno')).toBeInTheDocument();
    });

    it('calls onOpen when clicked in normal mode (grid)', () => {
      render(<ImageDisplay {...mockProps} viewMode="grid" />);

      // Click on the card
      fireEvent.click(screen.getByText('test-image.jpg'));

      // Check if onOpen was called with the correct image ID
      expect(mockProps.onOpen).toHaveBeenCalledWith('image-123');
    });

    it('calls onDelete when delete button is clicked (grid)', () => {
      render(<ImageDisplay {...mockProps} viewMode="grid" />);

      // Click on the delete button
      fireEvent.click(screen.getByTestId('delete-button'));

      // Check if onDelete was called with the correct image ID
      expect(mockProps.onDelete).toHaveBeenCalledWith('image-123');
    });

    it('renders in selection mode with checkbox (grid)', () => {
      const onToggleSelection = vi.fn();

      render(
        <ImageDisplay
          {...mockProps}
          viewMode="grid"
          selectionMode={true}
          isSelected={false}
          onToggleSelection={onToggleSelection}
        />,
      );

      // Check if the checkbox is rendered
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();

      // Check if ImageActions is not rendered in selection mode
      expect(screen.queryByTestId('image-actions')).not.toBeInTheDocument();
    });
  });

  describe('List View Mode', () => {
    it('renders the image item with thumbnail in list view', () => {
      render(<ImageDisplay {...mockProps} viewMode="list" />);

      // Check if the image name is displayed
      expect(screen.getByText('test-image.jpg')).toBeInTheDocument();

      // Check if the date is displayed
      const dateElement = screen.getByText(/January 1/i);
      expect(dateElement).toBeInTheDocument();

      // Check if the status badge is displayed
      expect(screen.getByText('Zpracováno')).toBeInTheDocument();
    });

    it('calls onOpen when clicked in normal mode (list)', () => {
      render(<ImageDisplay {...mockProps} viewMode="list" />);

      // Click on the item
      fireEvent.click(screen.getByText('test-image.jpg'));

      // Check if onOpen was called with the correct image ID
      expect(mockProps.onOpen).toHaveBeenCalledWith('image-123');
    });

    it('calls onDelete when delete button is clicked (list)', () => {
      render(<ImageDisplay {...mockProps} viewMode="list" />);

      // Click on the delete button
      fireEvent.click(screen.getByTestId('delete-list-button'));

      // Check if onDelete was called with the correct image ID
      expect(mockProps.onDelete).toHaveBeenCalledWith('image-123');
    });

    it('renders in selection mode with checkbox (list)', () => {
      const onToggleSelection = vi.fn();

      render(
        <ImageDisplay
          {...mockProps}
          viewMode="list"
          selectionMode={true}
          isSelected={false}
          onToggleSelection={onToggleSelection}
        />,
      );

      // Check if the checkbox is rendered
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();

      // Check if ImageListActions is not rendered in selection mode
      expect(screen.queryByTestId('image-list-actions')).not.toBeInTheDocument();
    });
  });

  describe('Common functionality', () => {
    it('renders a placeholder when no image URLs are available', () => {
      const imageWithoutUrls = {
        ...mockImage,
        url: null,
        thumbnail_url: null,
      };

      render(<ImageDisplay {...mockProps} image={imageWithoutUrls} viewMode="grid" />);

      // Check if the placeholder is displayed
      expect(screen.getByText('No preview')).toBeInTheDocument();
    });

    it('shows selected state in selection mode', () => {
      render(
        <ImageDisplay
          {...mockProps}
          viewMode="grid"
          selectionMode={true}
          isSelected={true}
          onToggleSelection={vi.fn()}
        />,
      );

      // Check if the checkbox is checked
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();

      // Check if the card has the selected styling
      const card = checkbox.closest('.ring-2');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('ring-blue-500');
    });

    it('renders different status badges based on segmentation status', () => {
      // Test processing status
      const processingImage = {
        ...mockImage,
        segmentationStatus: 'processing' as const,
      };

      const { rerender } = render(<ImageDisplay {...mockProps} image={processingImage} viewMode="grid" />);
      expect(screen.getByText('Zpracovává se')).toBeInTheDocument();

      // Test pending status
      const pendingImage = {
        ...mockImage,
        segmentationStatus: 'pending' as const,
      };

      rerender(<ImageDisplay {...mockProps} image={pendingImage} viewMode="grid" />);
      expect(screen.getByText('Čeká')).toBeInTheDocument();

      // Test queued status
      const queuedImage = {
        ...mockImage,
        segmentationStatus: 'queued' as const,
      };

      rerender(<ImageDisplay {...mockProps} image={queuedImage} viewMode="grid" />);
      expect(screen.getByText('Ve frontě')).toBeInTheDocument();

      // Test failed status
      const failedImage = {
        ...mockImage,
        segmentationStatus: 'failed' as const,
        error: 'Segmentation failed due to an error',
      };

      rerender(<ImageDisplay {...mockProps} image={failedImage} viewMode="grid" />);
      expect(screen.getByText('Selhalo')).toBeInTheDocument();
      expect(screen.getByText(/Segmentation failed/)).toBeInTheDocument();
    });

    it('calls onToggleSelection when checkbox is changed', () => {
      const onToggleSelection = vi.fn();

      render(
        <ImageDisplay
          {...mockProps}
          viewMode="grid"
          selectionMode={true}
          isSelected={false}
          onToggleSelection={onToggleSelection}
        />,
      );

      // Change the checkbox
      const checkbox = screen.getByRole('checkbox');
      fireEvent.change(checkbox, { target: { checked: true } });

      // Check if onToggleSelection was called
      expect(onToggleSelection).toHaveBeenCalled();
    });
  });
});
