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

vi.mock('@/utils/indexedDBService', () => ({
  getImageBlob: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/hooks/useSocketConnection', () => ({
  default: () => ({
    socket: null,
    isConnected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  }),
}));

vi.mock('@/services/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('@/utils/memoryLeakFixes', () => ({
  useIsMounted: () => ({ current: true }),
  useTimer: () => ({
    setTimeout: (cb: Function, delay: number) => setTimeout(cb, delay),
    clearTimeout: (id: any) => clearTimeout(id),
  }),
  useBlobUrl: () => ({
    createObjectURL: (blob: Blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url: string) => URL.revokeObjectURL(url),
  }),
  useEventListener: vi.fn(),
}));

vi.mock('@/utils/pollingManager', () => ({
  pollingManager: {
    startPollingForImage: vi.fn(),
    stopPollingForImage: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/utils/debounce', () => ({
  debouncedCacheUpdate: vi.fn(),
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
    image: mockImage,
    onDelete: vi.fn(),
    onResegment: vi.fn(),
    onOpen: vi.fn(),
  };

  beforeEach(() => {
    imageActionsProps = null;
    imageListActionsProps = null;
  });

  it('passes isProcessing=true when segmentationStatus is queued', () => {
    const queuedImage = { ...mockImage, segmentationStatus: 'queued' as const };

    render(<ImageDisplay {...defaultProps} image={queuedImage} />);

    expect(imageActionsProps?.isProcessing).toBe(true);
  });

  it('passes isProcessing=true when segmentationStatus is processing', () => {
    const processingImage = { ...mockImage, segmentationStatus: 'processing' as const };

    render(<ImageDisplay {...defaultProps} image={processingImage} />);

    expect(imageActionsProps?.isProcessing).toBe(true);
  });

  it('passes isProcessing=false when segmentationStatus is completed', () => {
    const completedImage = { ...mockImage, segmentationStatus: 'completed' as const };

    render(<ImageDisplay {...defaultProps} image={completedImage} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });

  it('passes isProcessing=false when segmentationStatus is failed', () => {
    const failedImage = { ...mockImage, segmentationStatus: 'failed' as const };

    render(<ImageDisplay {...defaultProps} image={failedImage} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });

  it('passes isProcessing=false when segmentationStatus is without_segmentation', () => {
    const withoutSegImage = { ...mockImage, segmentationStatus: 'without_segmentation' as const };

    render(<ImageDisplay {...defaultProps} image={withoutSegImage} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });

  it('passes same isProcessing value to list view actions', () => {
    const processingImage = { ...mockImage, segmentationStatus: 'processing' as const };

    render(<ImageDisplay {...defaultProps} image={processingImage} viewMode="list" />);

    expect(imageListActionsProps?.isProcessing).toBe(true);
  });

  it('updates isProcessing when image status changes', () => {
    const { rerender } = render(<ImageDisplay {...defaultProps} />);

    expect(imageActionsProps?.isProcessing).toBe(false);

    // Update to processing status
    const processingImage = { ...mockImage, segmentationStatus: 'processing' as const };
    rerender(<ImageDisplay {...defaultProps} image={processingImage} />);

    expect(imageActionsProps?.isProcessing).toBe(true);

    // Update back to completed
    const completedImage = { ...mockImage, segmentationStatus: 'completed' as const };
    rerender(<ImageDisplay {...defaultProps} image={completedImage} />);

    expect(imageActionsProps?.isProcessing).toBe(false);
  });
});