import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ImageSelectionCard from '../ImageSelectionCard';

// Mock format from date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(() => '2023-05-15')
}));

describe('ImageSelectionCard Component', () => {
  const mockImages = [
    {
      id: 'image-1',
      name: 'Test Image 1.jpg',
      thumbnail_url: 'http://example.com/thumb1.jpg',
      segmentationStatus: 'completed',
      createdAt: new Date()
    },
    {
      id: 'image-2',
      name: 'Test Image 2.jpg',
      thumbnail_url: null,
      segmentationStatus: 'in_progress',
      createdAt: new Date()
    },
    {
      id: 'image-3',
      name: 'Test Image 3.jpg',
      thumbnail_url: 'http://example.com/thumb3.jpg',
      segmentationStatus: 'failed',
      createdAt: new Date()
    }
  ];

  const defaultProps = {
    images: mockImages,
    loading: false,
    selectedImages: {
      'image-1': true,
      'image-2': false,
      'image-3': true
    },
    handleSelectAll: vi.fn(),
    handleSelectImage: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with images', () => {
    render(<ImageSelectionCard {...defaultProps} />);
    
    // Check title and button
    expect(screen.getByText('Vyberte obrázky k exportu')).toBeInTheDocument();
    expect(screen.getByText('Odznačit vše')).toBeInTheDocument();
    
    // Check if all images are rendered
    expect(screen.getByText('Test Image 1.jpg')).toBeInTheDocument();
    expect(screen.getByText('Test Image 2.jpg')).toBeInTheDocument();
    expect(screen.getByText('Test Image 3.jpg')).toBeInTheDocument();
    
    // Check checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toBeChecked(); // image-1 is selected
    expect(checkboxes[1]).not.toBeChecked(); // image-2 is not selected
    expect(checkboxes[2]).toBeChecked(); // image-3 is selected
  });

  it('shows loading spinner when loading is true', () => {
    render(<ImageSelectionCard {...defaultProps} loading={true} />);
    
    // Check loading spinner
    expect(screen.getByRole('status')).toBeInTheDocument();
    
    // Images should not be rendered
    expect(screen.queryByText('Test Image 1.jpg')).not.toBeInTheDocument();
  });

  it('shows message when no images are available', () => {
    render(<ImageSelectionCard {...defaultProps} images={[]} />);
    
    // Check empty message
    expect(screen.getByText('Žádné obrázky nejsou k dispozici')).toBeInTheDocument();
  });

  it('calls handleSelectAll when select all button is clicked', () => {
    render(<ImageSelectionCard {...defaultProps} />);
    
    // Click select all button
    fireEvent.click(screen.getByText('Odznačit vše'));
    
    // Check if handleSelectAll was called
    expect(defaultProps.handleSelectAll).toHaveBeenCalledTimes(1);
  });

  it('shows "Vybrat vše" button text when no images are selected', () => {
    render(
      <ImageSelectionCard 
        {...defaultProps} 
        selectedImages={{
          'image-1': false,
          'image-2': false,
          'image-3': false
        }} 
      />
    );
    
    expect(screen.getByText('Vybrat vše')).toBeInTheDocument();
  });

  it('calls handleSelectImage when an image item is clicked', () => {
    render(<ImageSelectionCard {...defaultProps} />);
    
    // Click on first image
    fireEvent.click(screen.getByText('Test Image 1.jpg').closest('div'));
    
    // Check if handleSelectImage was called with correct ID
    expect(defaultProps.handleSelectImage).toHaveBeenCalledTimes(1);
    expect(defaultProps.handleSelectImage).toHaveBeenCalledWith('image-1');
  });

  it('calls handleSelectImage when a checkbox is clicked', () => {
    render(<ImageSelectionCard {...defaultProps} />);
    
    // Get all checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    
    // Click second checkbox
    fireEvent.click(checkboxes[1]);
    
    // Check if handleSelectImage was called with correct ID
    expect(defaultProps.handleSelectImage).toHaveBeenCalledTimes(1);
    expect(defaultProps.handleSelectImage).toHaveBeenCalledWith('image-2');
  });

  it('displays appropriate status icons for images', () => {
    render(<ImageSelectionCard {...defaultProps} />);
    
    // Check for check icon (completed)
    const checkIcons = screen.getAllByTestId('check');
    expect(checkIcons).toHaveLength(1);
    
    // Check for x icon (failed)
    const xIcons = screen.getAllByTestId('x');
    expect(xIcons).toHaveLength(1);
  });

  it('displays placeholder for missing thumbnails', () => {
    render(<ImageSelectionCard {...defaultProps} />);
    
    // Check for "No preview" text in the second image (no thumbnail)
    expect(screen.getByText('No preview')).toBeInTheDocument();
  });
});
EOF < /dev/null