import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { ImageDisplay } from '../ImageDisplay';
import '@testing-library/jest-dom';

// Mock components to capture props
let imageActionsProps: any = null;
let imageListActionsProps: any = null;

vi.mock('../ImageActions', () => ({
  default: (props: any) => {
    imageActionsProps = props;
    return <div data-testid="image-actions" />;
  },
}));

vi.mock('../ImageListActions', () => ({
  default: (props: any) => {
    imageListActionsProps = props;
    return <div data-testid="image-list-actions" />;
  },
}));

// Mock other dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/hooks/useTranslations', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../SegmentationProgress', () => ({
  default: () => <div data-testid="segmentation-progress" />,
}));

vi.mock('../SegmentationThumbnail', () => ({
  default: () => <div data-testid="segmentation-thumbnail" />,
}));

describe('ImageDisplay - isProcessing prop', () => {
  const mockImage = {
    id: 'test-id',
    filename: 'test.jpg',
    originalName: 'test.jpg',
    url: 'http://test.com/test.jpg',
    thumbnailUrl: 'http://test.com/thumb.jpg',
    uploadedAt: new Date().toISOString(),
    size: 1000,
    segmentation_status: 'completed' as const,
    status: 'completed' as const,
  };

  const defaultProps = {
    images: [mockImage],
    loading: false,
    viewMode: 'grid' as const,
    onViewModeChange: vi.fn(),
    currentPage: 1,
    totalPages: 1,
    onPageChange: vi.fn(),
    onSelectImage: vi.fn(),
    selectedImages: [],
    onDelete: vi.fn(),
    onResegment: vi.fn(),
    projectId: 'project-id',
  };

  beforeEach(() => {
    imageActionsProps = null;
    imageListActionsProps = null;
  });

  it('passes isProcessing=true when segmentation_status is queued', () => {
    const queuedImage = { ...mockImage, segmentation_status: 'queued' as const };
    
    render(<ImageDisplay {...defaultProps} images={[queuedImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(true);
  });

  it('passes isProcessing=true when segmentation_status is processing', () => {
    const processingImage = { ...mockImage, segmentation_status: 'processing' as const };
    
    render(<ImageDisplay {...defaultProps} images={[processingImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(true);
  });

  it('passes isProcessing=false when segmentation_status is completed', () => {
    const completedImage = { ...mockImage, segmentation_status: 'completed' as const };
    
    render(<ImageDisplay {...defaultProps} images={[completedImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });

  it('passes isProcessing=false when segmentation_status is failed', () => {
    const failedImage = { ...mockImage, segmentation_status: 'failed' as const };
    
    render(<ImageDisplay {...defaultProps} images={[failedImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });

  it('passes isProcessing=false when segmentation_status is without_segmentation', () => {
    const withoutSegImage = { ...mockImage, segmentation_status: 'without_segmentation' as const };
    
    render(<ImageDisplay {...defaultProps} images={[withoutSegImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });

  it('passes same isProcessing value to list view actions', () => {
    const processingImage = { ...mockImage, segmentation_status: 'processing' as const };
    
    render(<ImageDisplay {...defaultProps} images={[processingImage]} viewMode="list" />);

    expect(imageListActionsProps?.isProcessing).toBe(true);
  });

  it('updates isProcessing when image status changes', () => {
    const { rerender } = render(<ImageDisplay {...defaultProps} />);
    
    expect(imageActionsProps?.isProcessing).toBe(false);

    // Update to processing status
    const processingImage = { ...mockImage, segmentation_status: 'processing' as const };
    rerender(<ImageDisplay {...defaultProps} images={[processingImage]} />);
    
    expect(imageActionsProps?.isProcessing).toBe(true);

    // Update back to completed
    const completedImage = { ...mockImage, segmentation_status: 'completed' as const };
    rerender(<ImageDisplay {...defaultProps} images={[completedImage]} />);
    
    expect(imageActionsProps?.isProcessing).toBe(false);
  });
});