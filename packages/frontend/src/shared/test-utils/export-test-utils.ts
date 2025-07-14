/**
 * Export Test Utilities
 *
 * Common utilities for testing export functionality
 */

import { vi } from 'vitest';
import { ProjectImage } from '@/pages/segmentation/types';

/**
 * Generate mock export options for ExportOptionsCard component
 */
export function createMockExportOptions() {
  return {
    includeImages: true,
    includeMetadata: true,
    includeSegmentation: true,
    includeObjectMetrics: true,
    annotationFormat: 'COCO' as const,
    metricsFormat: 'EXCEL' as const,
    setIncludeImages: vi.fn(),
    setIncludeMetadata: vi.fn(),
    setIncludeSegmentation: vi.fn(),
    setIncludeObjectMetrics: vi.fn(),
    setAnnotationFormat: vi.fn(),
    setMetricsFormat: vi.fn(),
    handleExportMetricsAsXlsx: vi.fn(),
    getSelectedCount: vi.fn(() => 5),
    isExporting: false,
  };
}

/**
 * Generate mock project images for export tests
 */
export function createMockProjectImages(count: number = 3): ProjectImage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `image-${i + 1}`,
    name: `test-image-${i + 1}.jpg`,
    url: `/images/test-${i + 1}.jpg`,
    thumbnailUrl: `/thumbnails/test-${i + 1}.jpg`,
    width: 800,
    height: 600,
    createdAt: new Date(`2023-01-0${i + 1}`),
    updatedAt: new Date(`2023-01-0${i + 1}`),
    segmentationStatus: i === 0 ? 'completed' : 'pending',
    segmentationResult:
      i === 0
        ? JSON.stringify({
            polygons: [
              {
                id: 'polygon-1',
                type: 'external',
                points: [
                  { x: 100, y: 100 },
                  { x: 200, y: 100 },
                  { x: 200, y: 200 },
                  { x: 100, y: 200 },
                ],
              },
            ],
          })
        : null,
  }));
}

/**
 * Mock export metrics data
 */
export function createMockExportMetrics() {
  return {
    totalImages: 10,
    segmentedImages: 8,
    totalCells: 150,
    averageCellArea: 234.5,
    averageCellPerimeter: 56.7,
    averageCellCircularity: 0.85,
  };
}
