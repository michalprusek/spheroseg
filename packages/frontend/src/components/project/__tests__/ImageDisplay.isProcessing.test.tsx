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
    project_id: 'project-id',
    imageUuid: 'test-id',
    name: 'test.jpg',
    url: 'http://test.com/test.jpg',
    thumbnail_url: 'http://test.com/thumb.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
    width: 800,
    height: 600,
    segmentationStatus: 'completed' as const,
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

  it('passes isProcessing=true when segmentationStatus is queued', () => {
    const queuedImage = { ...mockImage, segmentationStatus: 'queued' as const };

    render(<ImageDisplay {...defaultProps} images={[queuedImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(true);
  });

  it('passes isProcessing=true when segmentationStatus is processing', () => {
    const processingImage = { ...mockImage, segmentationStatus: 'processing' as const };

    render(<ImageDisplay {...defaultProps} images={[processingImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(true);
  });

  it('passes isProcessing=false when segmentationStatus is completed', () => {
    const completedImage = { ...mockImage, segmentationStatus: 'completed' as const };

    render(<ImageDisplay {...defaultProps} images={[completedImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });

  it('passes isProcessing=false when segmentationStatus is failed', () => {
    const failedImage = { ...mockImage, segmentationStatus: 'failed' as const };

    render(<ImageDisplay {...defaultProps} images={[failedImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });

  it('passes isProcessing=false when segmentationStatus is without_segmentation', () => {
    const withoutSegImage = { ...mockImage, segmentationStatus: 'without_segmentation' as const };

    render(<ImageDisplay {...defaultProps} images={[withoutSegImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });

  it('passes same isProcessing value to list view actions', () => {
    const processingImage = { ...mockImage, segmentationStatus: 'processing' as const };

    render(<ImageDisplay {...defaultProps} images={[processingImage]} viewMode="list" />);

    expect(imageListActionsProps?.isProcessing).toBe(true);
  });

  it('updates isProcessing when image status changes', () => {
    const { rerender } = render(<ImageDisplay {...defaultProps} />);

    expect(imageActionsProps?.isProcessing).toBe(false);

    // Update to processing status
    const processingImage = { ...mockImage, segmentationStatus: 'processing' as const };
    rerender(<ImageDisplay {...defaultProps} images={[processingImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(true);

    // Update back to completed
    const completedImage = { ...mockImage, segmentationStatus: 'completed' as const };
    rerender(<ImageDisplay {...defaultProps} images={[completedImage]} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });
});
