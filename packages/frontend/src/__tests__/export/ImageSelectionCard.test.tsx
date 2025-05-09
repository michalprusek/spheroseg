import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageSelectionCard from '@/pages/export/components/ImageSelectionCard';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock language context
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  })
}));

describe('ImageSelectionCard', () => {
  const mockImages = [
    {
      id: 'image1',
      name: 'test1.jpg',
      url: '/images/test1.jpg',
      thumbnail_url: '/thumbnails/test1.jpg',
      width: 800,
      height: 600,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      segmentationStatus: 'completed',
      segmentationResult: JSON.stringify({
        polygons: [
          {
            id: 'polygon1',
            type: 'external',
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 },
              { x: 200, y: 200 },
              { x: 100, y: 200 },
            ],
          },
        ],
      }),
    },
    {
      id: 'image2',
      name: 'test2.jpg',
      url: '/images/test2.jpg',
      thumbnail_url: null,
      width: 800,
      height: 600,
      createdAt: new Date('2023-01-02'),
      updatedAt: new Date('2023-01-02'),
      segmentationStatus: 'pending',
      segmentationResult: null,
    },
  ];

  const mockProps = {
    images: mockImages,
    loading: false,
    selectedImages: { image1: true, image2: false },
    handleSelectAll: vi.fn(),
    handleSelectImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the image selection card with images', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Check if images are rendered
    expect(screen.getByText('test1.jpg')).toBeInTheDocument();
    expect(screen.getByText('test2.jpg')).toBeInTheDocument();
  });

  it('shows loading state when loading is true', () => {
    render(<ImageSelectionCard {...mockProps} loading={true} />);

    // Check for loading spinner
    const loadingSpinner = document.querySelector('.animate-spin');
    expect(loadingSpinner).toBeInTheDocument();
  });

  it('shows empty state when no images are available', () => {
    render(<ImageSelectionCard {...mockProps} images={[]} />);

    expect(screen.getByText('Žádné obrázky nejsou k dispozici')).toBeInTheDocument();
  });

  it('calls handleSelectAll when select all button is clicked', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Find the select all button
    const selectAllButton = screen.getByText('Vybrat vše');
    fireEvent.click(selectAllButton);

    expect(mockProps.handleSelectAll).toHaveBeenCalled();
  });

  it('calls handleSelectImage when an image checkbox is clicked', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Find the image checkbox
    const imageCheckbox = document.getElementById('check-image2');
    fireEvent.click(imageCheckbox);

    expect(mockProps.handleSelectImage).toHaveBeenCalledWith('image2');
  });

  it('shows correct segmentation status icons', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Check if status icons are displayed
    const checkIcon = document.querySelector('.text-green-500');
    expect(checkIcon).toBeInTheDocument(); // For completed image
  });

  it('renders image thumbnails and "No preview" for missing thumbnails', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Check if image names are displayed
    expect(screen.getByText('test1.jpg')).toBeInTheDocument();
    expect(screen.getByText('test2.jpg')).toBeInTheDocument();

    // Check if "No preview" is displayed for the second image
    expect(screen.getByText('No preview')).toBeInTheDocument();
  });
});
