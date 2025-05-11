import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ImageCard } from '../ImageCard';
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

describe('ImageCard Component', () => {
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

  it('renders the image card with thumbnail', () => {
    render(<ImageCard {...mockProps} />);

    // Check if the image is rendered with the correct src
    const image = screen.getByAltText('test-image.jpg');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/api' + mockImage.thumbnail_url);

    // Check if the image name is displayed
    expect(screen.getByText('test-image.jpg')).toBeInTheDocument();

    // Check if the date is displayed - format may vary based on locale
    const dateElement = screen.getByText(/January 1/i);
    expect(dateElement).toBeInTheDocument();

    // Check if the status badge is displayed
    expect(screen.getByText('Zpracováno')).toBeInTheDocument();
  });

  it('renders with main image URL when thumbnail is not available', () => {
    const imageWithoutThumbnail = {
      ...mockImage,
      thumbnail_url: null,
    };

    render(<ImageCard {...mockProps} image={imageWithoutThumbnail} />);

    // Check if the main image is used as fallback
    const image = screen.getByAltText('test-image.jpg');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/api' + mockImage.url);
  });

  it('renders a placeholder when no image URLs are available', () => {
    const imageWithoutUrls = {
      ...mockImage,
      url: null,
      thumbnail_url: null,
    };

    render(<ImageCard {...mockProps} image={imageWithoutUrls} />);

    // Check if the placeholder is displayed
    expect(screen.getByText('No preview')).toBeInTheDocument();
  });

  it('calls onOpen when clicked in normal mode', () => {
    render(<ImageCard {...mockProps} />);

    // Click on the card
    fireEvent.click(screen.getByText('test-image.jpg'));

    // Check if onOpen was called with the correct image ID
    expect(mockProps.onOpen).toHaveBeenCalledWith('image-123');
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<ImageCard {...mockProps} />);

    // Click on the delete button
    fireEvent.click(screen.getByTestId('delete-button'));

    // Check if onDelete was called with the correct image ID
    expect(mockProps.onDelete).toHaveBeenCalledWith('image-123');
  });

  it('calls onResegment when resegment button is clicked', () => {
    render(<ImageCard {...mockProps} />);

    // Click on the resegment button
    fireEvent.click(screen.getByTestId('resegment-button'));

    // Check if onResegment was called with the correct image ID
    expect(mockProps.onResegment).toHaveBeenCalledWith('image-123');
  });

  it('renders in selection mode with checkbox', () => {
    const onToggleSelection = vi.fn();

    render(<ImageCard {...mockProps} selectionMode={true} isSelected={false} onToggleSelection={onToggleSelection} />);

    // Check if the checkbox is rendered
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    // Check if ImageActions is not rendered in selection mode
    expect(screen.queryByTestId('image-actions')).not.toBeInTheDocument();
  });

  it('shows selected state in selection mode', () => {
    render(<ImageCard {...mockProps} selectionMode={true} isSelected={true} onToggleSelection={vi.fn()} />);

    // Check if the checkbox is checked
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    // Check if the card has the selected styling
    const card = checkbox.closest('.ring-2');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('ring-blue-500');
  });

  it('calls onToggleSelection when clicked in selection mode', () => {
    const onToggleSelection = vi.fn();

    render(<ImageCard {...mockProps} selectionMode={true} isSelected={false} onToggleSelection={onToggleSelection} />);

    // Click on the card
    fireEvent.click(screen.getByText('test-image.jpg'));

    // Check if onToggleSelection was called
    expect(onToggleSelection).toHaveBeenCalled();

    // Check that onOpen was not called
    expect(mockProps.onOpen).not.toHaveBeenCalled();
  });

  it('renders different status badges based on segmentation status', () => {
    // Test processing status
    const processingImage = {
      ...mockImage,
      segmentationStatus: 'processing' as const,
    };

    const { rerender } = render(<ImageCard {...mockProps} image={processingImage} />);
    expect(screen.getByText('Zpracovává se')).toBeInTheDocument();

    // Test pending status
    const pendingImage = {
      ...mockImage,
      segmentationStatus: 'pending' as const,
    };

    rerender(<ImageCard {...mockProps} image={pendingImage} />);
    expect(screen.getByText('Čeká')).toBeInTheDocument();
  });
});
