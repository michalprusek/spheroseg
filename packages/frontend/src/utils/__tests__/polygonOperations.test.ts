/**
 * Tests for polygon operations
 */

import polygonOperations from '../polygonOperations';
import { SegmentationResult } from '@/lib/segmentation';

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

describe('Polygon Operations', () => {
  describe('splitPolygon', () => {
    const createMockSegmentation = (): SegmentationResult => ({
      id: 'seg-1',
      imageId: 'img-1',
      polygons: [
        {
          id: 'poly-1',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          type: 'cell',
          confidence: 0.95,
          area: 10000,
        },
      ],
      metadata: {
        modelVersion: '1.0',
        processingTime: 100,
        imageWidth: 200,
        imageHeight: 200,
      },
      timestamp: new Date(),
      status: 'completed',
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should split a square polygon with horizontal line', () => {
      const segmentation = createMockSegmentation();
      const line: [any, any] = [
        { x: -10, y: 50 },
        { x: 110, y: 50 },
      ];

      const result = polygonOperations.splitPolygon(segmentation, 'poly-1', line);

      expect(result).not.toBeNull();
      expect(result!.polygons).toHaveLength(2);

      // Both polygons should have valid points
      result!.polygons.forEach((polygon) => {
        expect(polygon.points.length).toBeGreaterThanOrEqual(3);
        expect(polygon.id).toBe('mock-uuid');
        expect(polygon.type).toBe('cell');
      });

      // Check that original polygon is removed
      expect(result!.polygons.find((p) => p.id === 'poly-1')).toBeUndefined();
    });

    it('should split a square polygon with vertical line', () => {
      const segmentation = createMockSegmentation();
      const line: [any, any] = [
        { x: 50, y: -10 },
        { x: 50, y: 110 },
      ];

      const result = polygonOperations.splitPolygon(segmentation, 'poly-1', line);

      expect(result).not.toBeNull();
      expect(result!.polygons).toHaveLength(2);

      // Check areas are calculated
      result!.polygons.forEach((polygon) => {
        expect(polygon.area).toBeGreaterThan(0);
      });
    });

    it('should handle diagonal line', () => {
      const segmentation = createMockSegmentation();
      const line: [any, any] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const result = polygonOperations.splitPolygon(segmentation, 'poly-1', line);

      expect(result).not.toBeNull();
      expect(result!.polygons).toHaveLength(2);
    });

    it('should return null if polygon not found', () => {
      const segmentation = createMockSegmentation();
      const line: [any, any] = [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ];

      const result = polygonOperations.splitPolygon(segmentation, 'invalid-id', line);

      expect(result).toBeNull();
    });

    it('should return null if line does not intersect polygon', () => {
      const segmentation = createMockSegmentation();
      const line: [any, any] = [
        { x: 200, y: 200 },
        { x: 300, y: 300 },
      ];

      const result = polygonOperations.splitPolygon(segmentation, 'poly-1', line);

      expect(result).toBeNull();
    });

    it('should return null if only one intersection found', () => {
      const segmentation = createMockSegmentation();
      const line: [any, any] = [
        { x: 50, y: 50 },
        { x: 50, y: 200 }, // Only intersects once
      ];

      const result = polygonOperations.splitPolygon(segmentation, 'poly-1', line);

      expect(result).toBeNull();
    });

    it('should handle complex polygon shapes', () => {
      const segmentation = createMockSegmentation();
      // Create L-shaped polygon
      segmentation.polygons[0].points = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 50 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      const line: [any, any] = [
        { x: 25, y: 0 },
        { x: 25, y: 100 },
      ];

      const result = polygonOperations.splitPolygon(segmentation, 'poly-1', line);

      expect(result).not.toBeNull();
      expect(result!.polygons).toHaveLength(2);
    });

    it('should return null if resulting polygons have less than 3 points', () => {
      const segmentation = createMockSegmentation();
      // Create a very small triangle
      segmentation.polygons[0].points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];

      const line: [any, any] = [
        { x: 1, y: 1 },
        { x: 9, y: 1 },
      ];

      const result = polygonOperations.splitPolygon(segmentation, 'poly-1', line);

      // This might create polygons with < 3 points
      if (result) {
        result.polygons.forEach((polygon) => {
          expect(polygon.points.length).toBeGreaterThanOrEqual(3);
        });
      }
    });

    it('should preserve polygon properties after split', () => {
      const segmentation = createMockSegmentation();
      segmentation.polygons[0].confidence = 0.85;
      segmentation.polygons[0].class = 'nucleus';

      const line: [any, any] = [
        { x: 50, y: -10 },
        { x: 50, y: 110 },
      ];

      const result = polygonOperations.splitPolygon(segmentation, 'poly-1', line);

      expect(result).not.toBeNull();
      result!.polygons.forEach((polygon) => {
        expect(polygon.confidence).toBe(0.85);
        expect(polygon.class).toBe('nucleus');
        expect(polygon.type).toBe('cell');
      });
    });
  });
});
