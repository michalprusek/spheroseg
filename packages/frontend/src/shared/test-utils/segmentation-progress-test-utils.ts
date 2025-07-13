/**
 * Segmentation Progress Test Utilities
 */

import { vi } from 'vitest';

export const createMockSegmentationProgress = () => ({
  imageId: 'test-image-123',
  status: 'processing' as const,
  progress: 50,
  startedAt: new Date().toISOString(),
  completedAt: null,
  error: null,
});

export const createMockWebSocketEvents = () => ({
  onSegmentationProgress: vi.fn(),
  onSegmentationComplete: vi.fn(),
  onSegmentationError: vi.fn(),
  onSegmentationQueued: vi.fn(),
});

export const mockSegmentationStatuses = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  WITHOUT_SEGMENTATION: 'without_segmentation',
} as const;

export const createMockImage = (overrides = {}) => ({
  id: 'image-123',
  name: 'test-image.jpg',
  url: '/images/test.jpg',
  thumbnailUrl: '/thumbnails/test.jpg',
  segmentationStatus: 'without_segmentation',
  segmentationProgress: 0,
  ...overrides,
});
