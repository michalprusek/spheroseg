import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ProjectImages from '../project/ProjectImages';
import { constructUrl } from '@/lib/urlUtils';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/lib/urlUtils');
vi.mock('sonner');

// Mock intersection observer
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver as any;

describe('ProjectImages', () => {
  const mockImages = [
    {
      id: '1',
      name: 'test-image-1.jpg',
      url: 'http://example.com/test-image-1.jpg',
      thumbnailUrl: 'http://example.com/thumb-1.jpg',
      segmentationStatus: 'completed',
      uploadedAt: '2024-01-01T10:00:00Z',
      width: 1920,
      height: 1080,
      fileSize: 2048000,
    },
    {
      id: '2',
      name: 'test-image-2.png',
      url: 'http://example.com/test-image-2.png',
      thumbnailUrl: 'http://example.com/thumb-2.jpg',
      segmentationStatus: 'processing',
      uploadedAt: '2024-01-02T11:00:00Z',
      width: 1280,
      height: 720,
      fileSize: 1024000,
    },
    {
      id: '3',
      name: 'test-image-3.tiff',
      url: 'http://example.com/test-image-3.tiff',
      thumbnailUrl: null,
      segmentationStatus: 'queued',
      uploadedAt: '2024-01-03T12:00:00Z',
      width: 3840,
      height: 2160,
      fileSize: 5120000,
    },
  ];

  const mockOnImageClick = vi.fn();
  const mockOnImageDelete = vi.fn();
  const mockOnBatchDelete = vi.fn();
  const mockOnBatchSegment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(constructUrl).mockImplementation((path) => `http://example.com${path}`);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders image gallery with images', () => {
    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    expect(screen.getByText('test-image-1.jpg')).toBeInTheDocument();
    expect(screen.getByText('test-image-2.png')).toBeInTheDocument();
    expect(screen.getByText('test-image-3.tiff')).toBeInTheDocument();
  });

  it('shows loading skeleton for images with loading status', () => {
    const loadingImages = mockImages.map(img => ({
      ...img,
      segmentationStatus: 'processing' as const,
    }));

    render(
      <ProjectImages
        images={loadingImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    // Check for processing indicators
    expect(screen.getAllByText(/processing/i).length).toBeGreaterThan(0);
  });

  it('shows images with failed status', () => {
    const failedImages = mockImages.map(img => ({
      ...img,
      segmentationStatus: 'failed' as const,
    }));

    render(
      <ProjectImages
        images={failedImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    // Check for failed indicators
    expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0);
  });

  it('shows empty state', () => {
    render(
      <ProjectImages
        images={[]}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    // The component might not have a specific empty state message
    // Let's check that no images are rendered
    expect(screen.queryByText('test-image-1.jpg')).not.toBeInTheDocument();
    expect(screen.queryByText('test-image-2.png')).not.toBeInTheDocument();
  });

  it('handles image click', async () => {
    const user = userEvent.setup();
    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    const firstImage = screen.getByText('test-image-1.jpg').closest('.group');
    await user.click(firstImage!);

    expect(mockOnImageClick).toHaveBeenCalledWith('1');
  });

  it('handles image deletion', async () => {
    const user = userEvent.setup();
    mockOnImageDelete.mockResolvedValue(undefined);

    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    // Find and click delete button for first image
    const firstImageCard = screen.getByText('test-image-1.jpg').closest('.relative');
    const deleteButton = within(firstImageCard!).getByTestId('Trash2-icon').closest('button');
    
    await user.click(deleteButton!);

    // Confirm deletion in dialog
    const confirmButton = screen.getByText('Delete');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnImageDelete).toHaveBeenCalledWith('1');
      expect(toast.success).toHaveBeenCalledWith('Image deleted successfully');
    });
  });

  it('handles view mode switching', async () => {
    const user = userEvent.setup();
    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    // Default should be grid view
    expect(screen.getByTestId('LayoutGrid-icon')).toHaveClass('text-blue-600');

    // Switch to list view
    const listViewButton = screen.getByTestId('LayoutList-icon').closest('button');
    await user.click(listViewButton!);

    expect(screen.getByTestId('LayoutList-icon')).toHaveClass('text-blue-600');
    expect(screen.getByTestId('LayoutGrid-icon')).not.toHaveClass('text-blue-600');
  });

  it('handles search functionality', async () => {
    const user = userEvent.setup();
    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search images/i);
    await user.type(searchInput, 'test-image-1');

    // Should only show matching image
    expect(screen.getByText('test-image-1.jpg')).toBeInTheDocument();
    expect(screen.queryByText('test-image-2.png')).not.toBeInTheDocument();
    expect(screen.queryByText('test-image-3.tiff')).not.toBeInTheDocument();
  });

  it('handles filter by status', async () => {
    const user = userEvent.setup();
    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    // Open filter dropdown
    const filterButton = screen.getByTestId('Filter-icon').closest('button');
    await user.click(filterButton!);

    // Select "Completed" status
    const completedOption = screen.getByText('Completed');
    await user.click(completedOption);

    // Should only show completed images
    expect(screen.getByText('test-image-1.jpg')).toBeInTheDocument();
    expect(screen.queryByText('test-image-2.png')).not.toBeInTheDocument();
    expect(screen.queryByText('test-image-3.tiff')).not.toBeInTheDocument();
  });

  it('handles sorting', async () => {
    const user = userEvent.setup();
    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    // Open sort dropdown
    const sortButton = screen.getByTestId('ArrowUpDown-icon').closest('button');
    await user.click(sortButton!);

    // Select "Name (A-Z)"
    const nameAscOption = screen.getByText('Name (A-Z)');
    await user.click(nameAscOption);

    // Images should be sorted alphabetically
    const imageNames = screen.getAllByText(/test-image-\d\.(jpg|png|tiff)/);
    expect(imageNames[0]).toHaveTextContent('test-image-1.jpg');
    expect(imageNames[1]).toHaveTextContent('test-image-2.png');
    expect(imageNames[2]).toHaveTextContent('test-image-3.tiff');
  });

  it('handles batch selection', async () => {
    const user = userEvent.setup();
    render(
      <ImageGallery
        projectId="test-project"
        onImageClick={mockOnImageClick}
        onImageDelete={mockOnImageDelete}
        onBatchDelete={mockOnBatchDelete}
        allowSelection
      />
    );

    // Select first two images
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // First image checkbox (0 is select all)
    await user.click(checkboxes[2]); // Second image checkbox

    // Should show batch actions
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('Delete Selected')).toBeInTheDocument();
  });

  it('handles select all functionality', async () => {
    const user = userEvent.setup();
    render(
      <ImageGallery
        projectId="test-project"
        onImageClick={mockOnImageClick}
        onImageDelete={mockOnImageDelete}
        onBatchDelete={mockOnBatchDelete}
        allowSelection
      />
    );

    // Click select all checkbox
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    await user.click(selectAllCheckbox);

    // All images should be selected
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('handles batch deletion', async () => {
    const user = userEvent.setup();
    mockOnBatchDelete.mockResolvedValue(undefined);

    render(
      <ImageGallery
        projectId="test-project"
        onImageClick={mockOnImageClick}
        onImageDelete={mockOnImageDelete}
        onBatchDelete={mockOnBatchDelete}
        allowSelection
      />
    );

    // Select images
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);

    // Click batch delete
    const batchDeleteButton = screen.getByText('Delete Selected');
    await user.click(batchDeleteButton);

    // Confirm in dialog
    const confirmButton = screen.getByText('Delete');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnBatchDelete).toHaveBeenCalledWith(['1', '2']);
      expect(toast.success).toHaveBeenCalledWith('2 images deleted successfully');
    });
  });

  it('handles batch segmentation', async () => {
    const user = userEvent.setup();
    mockOnBatchSegment.mockResolvedValue(undefined);

    render(
      <ImageGallery
        projectId="test-project"
        onImageClick={mockOnImageClick}
        onImageDelete={mockOnImageDelete}
        onBatchSegment={mockOnBatchSegment}
        allowSelection
      />
    );

    // Select image without segmentation
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[3]); // Third image (queued status)

    // Click batch segment
    const batchSegmentButton = screen.getByText('Segment Selected');
    await user.click(batchSegmentButton);

    await waitFor(() => {
      expect(mockOnBatchSegment).toHaveBeenCalledWith(['3']);
      expect(toast.success).toHaveBeenCalledWith('Segmentation started for 1 image');
    });
  });

  it('displays image metadata correctly', () => {
    render(
      <ImageGallery
        projectId="test-project"
        onImageClick={mockOnImageClick}
        onImageDelete={mockOnImageDelete}
        viewMode="list"
      />
    );

    // Check first image metadata
    const firstImageRow = screen.getByText('test-image-1.jpg').closest('tr');
    expect(within(firstImageRow!).getByText('1920x1080')).toBeInTheDocument();
    expect(within(firstImageRow!).getByText('2.0 MB')).toBeInTheDocument();
    expect(within(firstImageRow!).getByText('Completed')).toBeInTheDocument();
  });

  it('handles image preview on hover', async () => {
    const user = userEvent.setup();
    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    const firstImage = screen.getByText('test-image-1.jpg').closest('[role="button"]');
    
    // Hover over image
    await user.hover(firstImage!);

    // Should show preview overlay with view button
    await waitFor(() => {
      expect(screen.getByTestId('Eye-icon')).toBeInTheDocument();
    });
  });

  // Note: Pagination is handled by the parent component that uses useProjectImages hook
  // ProjectImages only displays the images it receives as props

  it('handles image loading errors', () => {
    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    const images = screen.getAllByRole('img');
    
    // Simulate image load error
    fireEvent.error(images[0]);

    // Should show fallback image
    expect(images[0]).toHaveAttribute('src', expect.stringContaining('placeholder'));
  });

  it('respects readOnly mode', () => {
    render(
      <ImageGallery
        projectId="test-project"
        onImageClick={mockOnImageClick}
        onImageDelete={mockOnImageDelete}
        readOnly
      />
    );

    // Should not show delete buttons
    expect(screen.queryByTestId('Trash2-icon')).not.toBeInTheDocument();
    
    // Should not show selection checkboxes even if allowSelection is true
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('filters images correctly with multiple criteria', async () => {
    const user = userEvent.setup();
    render(
      <ProjectImages
        images={mockImages}
        onOpen={mockOnImageClick}
        onDelete={mockOnImageDelete}
        onResegment={vi.fn()}
        viewMode="grid"
      />
    );

    // Search for "test"
    const searchInput = screen.getByPlaceholderText(/Search images/i);
    await user.type(searchInput, 'test');

    // All images should still be visible
    expect(screen.getAllByText(/test-image-\d\.(jpg|png|tiff)/)).toHaveLength(3);

    // Now search for "png"
    await user.clear(searchInput);
    await user.type(searchInput, 'png');

    // Only PNG image should be visible
    expect(screen.getByText('test-image-2.png')).toBeInTheDocument();
    expect(screen.queryByText('test-image-1.jpg')).not.toBeInTheDocument();
  });
});