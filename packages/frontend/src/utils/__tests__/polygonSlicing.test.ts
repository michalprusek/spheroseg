import { describe, it, expect, vi } from 'vitest';
import {
  createSliceFromVertices,
  slicePolygonByLine,
  slicePolygonAtVertex,
  checkPolygonSelfIntersection,
} from '../polygonSlicing';
import { Polygon, Point } from '@spheroseg/types';

// Mock the polygon utilities
vi.mock('../polygonUtils', () => ({
  isPointInsidePolygon: vi.fn((polygon, point) => {
    // Simple mock implementation
    const xPoints = polygon.points.map((p) => p.x);
    const yPoints = polygon.points.map((p) => p.y);
    const minX = Math.min(...xPoints);
    const maxX = Math.max(...xPoints);
    const minY = Math.min(...yPoints);
    const maxY = Math.max(...yPoints);

    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }),
  calculateDistance: vi.fn((p1, p2) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }),
  generatePolygonColor: vi.fn(() => '#00FF00'),
}));

describe('Polygon Slicing Utilities', () => {
  describe('createSliceFromVertices', () => {
    it('creates a slice between two vertices of a polygon', () => {
      const polygon: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Create slice from vertex 0 to vertex 2
      const slice = createSliceFromVertices(polygon, 0, 2);

      expect(slice).toEqual({
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
      });
    });

    it('handles invalid vertex indices', () => {
      const polygon: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Invalid vertex indices
      expect(() => createSliceFromVertices(polygon, -1, 2)).toThrow();
      expect(() => createSliceFromVertices(polygon, 0, 4)).toThrow();
      expect(() => createSliceFromVertices(polygon, 5, 2)).toThrow();
    });

    it('handles empty polygon', () => {
      const emptyPolygon: Polygon = {
        points: [],
        closed: true,
        color: '#FF0000',
      };

      expect(() => createSliceFromVertices(emptyPolygon, 0, 1)).toThrow();
    });
  });

  describe('slicePolygonByLine', () => {
    it('slices a polygon with a line into two parts', () => {
      const square: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Slice with diagonal line from (0,0) to (10,10)
      const sliceLine = {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
      };

      const result = slicePolygonByLine(square, sliceLine);

      // Should return two polygons
      expect(result).toHaveLength(2);

      // Both should have the same color as original
      expect(result[0].color).toBe('#FF0000');
      expect(result[1].color).toBe('#FF0000');
    });

    it('handles case where line does not intersect polygon', () => {
      const square: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Line outside the polygon
      const sliceLine = {
        start: { x: 20, y: 0 },
        end: { x: 20, y: 10 },
      };

      const result = slicePolygonByLine(square, sliceLine);

      // Should return original polygon (no slice)
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(square);
    });

    it('handles line that only touches polygon at a vertex', () => {
      const square: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Line that touches only at vertex (0,0)
      const sliceLine = {
        start: { x: 0, y: 0 },
        end: { x: -10, y: -10 },
      };

      const result = slicePolygonByLine(square, sliceLine);

      // Should return original polygon (no effective slice)
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(square);
    });

    it('slices complex polygon correctly', () => {
      const complex: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 15, y: 5 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: -5, y: 5 },
        ],
        closed: true,
        color: '#0000FF',
      };

      // Horizontal slice through the middle
      const sliceLine = {
        start: { x: -10, y: 5 },
        end: { x: 20, y: 5 },
      };

      const result = slicePolygonByLine(complex, sliceLine);

      // Should return two polygons
      expect(result).toHaveLength(2);

      // One polygon should contain the top points, one the bottom points
      const topPolygon = result.find((p) => p.points.some((point) => point.y === 10));
      const bottomPolygon = result.find((p) => p.points.some((point) => point.y === 0));

      expect(topPolygon).toBeDefined();
      expect(bottomPolygon).toBeDefined();
    });
  });

  describe('slicePolygonAtVertex', () => {
    it('slices a polygon at a specified vertex', () => {
      const square: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Slice at vertex 0 with diagonal direction
      const result = slicePolygonAtVertex(square, 0, { x: 10, y: 10 });

      // Should return two polygons
      expect(result).toHaveLength(2);
    });

    it('handles invalid vertex index', () => {
      const square: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Invalid vertex index
      expect(slicePolygonAtVertex(square, -1, { x: 10, y: 10 })).toEqual([]);
      expect(slicePolygonAtVertex(square, 4, { x: 10, y: 10 })).toEqual([]);
    });

    it('handles case where slice direction does not intersect polygon', () => {
      const square: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Direction away from polygon
      const result = slicePolygonAtVertex(square, 0, { x: -10, y: -10 });

      // Should return original polygon (no effective slice)
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(square);
    });
  });

  describe('checkPolygonSelfIntersection', () => {
    it('detects self-intersection in a polygon', () => {
      // Self-intersecting polygon (hourglass shape)
      const hourglass: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 },
          { x: 10, y: 10 },
        ],
        closed: true,
        color: '#FF00FF',
      };

      const intersections = checkPolygonSelfIntersection(hourglass);

      // Should find intersection point
      expect(intersections.length).toBeGreaterThan(0);

      // Intersection should be at approximately (5, 5)
      const intersection = intersections[0];
      expect(intersection.x).toBeCloseTo(5, 0);
      expect(intersection.y).toBeCloseTo(5, 0);
    });

    it('returns empty array for non-self-intersecting polygon', () => {
      const square: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      const intersections = checkPolygonSelfIntersection(square);

      // Should not find any intersections
      expect(intersections).toEqual([]);
    });

    it('handles polygons with fewer than 4 points', () => {
      // Triangle cannot self-intersect
      const triangle: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 },
        ],
        closed: true,
        color: '#00FF00',
      };

      const intersections = checkPolygonSelfIntersection(triangle);

      // Should not find any intersections
      expect(intersections).toEqual([]);

      // Line or point cannot self-intersect
      const line: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        closed: true,
        color: '#0000FF',
      };

      expect(checkPolygonSelfIntersection(line)).toEqual([]);

      const point: Polygon = {
        points: [{ x: 0, y: 0 }],
        closed: true,
        color: '#FF00FF',
      };

      expect(checkPolygonSelfIntersection(point)).toEqual([]);
    });

    it('handles complex self-intersecting polygons', () => {
      // Star shape with multiple self-intersections
      const star: Polygon = {
        points: [
          { x: 50, y: 0 },
          { x: 61, y: 35 },
          { x: 98, y: 35 },
          { x: 68, y: 57 },
          { x: 79, y: 91 },
          { x: 50, y: 70 },
          { x: 21, y: 91 },
          { x: 32, y: 57 },
          { x: 2, y: 35 },
          { x: 39, y: 35 },
        ],
        closed: true,
        color: '#FFFF00',
      };

      const intersections = checkPolygonSelfIntersection(star);

      // Star should have multiple self-intersections
      expect(intersections.length).toBeGreaterThan(1);
    });
  });
});
