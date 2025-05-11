import { describe, it, expect, vi } from 'vitest';
import { slicePolygon, findIntersectionPoint } from '../slicePolygon';
import { Polygon, Point } from '@spheroseg/types';

describe('Polygon Slicing Utilities', () => {
  describe('findIntersectionPoint', () => {
    it('finds intersection between two line segments', () => {
      // Horizontal line from (0,5) to (10,5)
      const line1Start: Point = { x: 0, y: 5 };
      const line1End: Point = { x: 10, y: 5 };

      // Vertical line from (5,0) to (5,10)
      const line2Start: Point = { x: 5, y: 0 };
      const line2End: Point = { x: 5, y: 10 };

      // Intersection should be at (5,5)
      const intersection = findIntersectionPoint(line1Start, line1End, line2Start, line2End);

      expect(intersection).toEqual({ x: 5, y: 5 });
    });

    it('returns null for parallel lines', () => {
      // Two horizontal lines
      const line1Start: Point = { x: 0, y: 5 };
      const line1End: Point = { x: 10, y: 5 };

      const line2Start: Point = { x: 0, y: 10 };
      const line2End: Point = { x: 10, y: 10 };

      // No intersection
      const intersection = findIntersectionPoint(line1Start, line1End, line2Start, line2End);

      expect(intersection).toBeNull();
    });

    it('returns null when lines do not intersect within segments', () => {
      // Line from (0,0) to (5,5)
      const line1Start: Point = { x: 0, y: 0 };
      const line1End: Point = { x: 5, y: 5 };

      // Line from (6,0) to (10,5) - would intersect if extended, but not within segments
      const line2Start: Point = { x: 6, y: 0 };
      const line2End: Point = { x: 10, y: 5 };

      // No intersection within segments
      const intersection = findIntersectionPoint(line1Start, line1End, line2Start, line2End);

      expect(intersection).toBeNull();
    });

    it('handles edge case of overlapping line segments', () => {
      // Two overlapping lines
      const line1Start: Point = { x: 0, y: 0 };
      const line1End: Point = { x: 10, y: 10 };

      const line2Start: Point = { x: 5, y: 5 };
      const line2End: Point = { x: 15, y: 15 };

      // Should return the first overlapping point
      const intersection = findIntersectionPoint(line1Start, line1End, line2Start, line2End);

      expect(intersection).toEqual({ x: 5, y: 5 });
    });

    it('handles lines that touch at endpoints', () => {
      // Two lines that touch at endpoints
      const line1Start: Point = { x: 0, y: 0 };
      const line1End: Point = { x: 5, y: 5 };

      const line2Start: Point = { x: 5, y: 5 };
      const line2End: Point = { x: 10, y: 0 };

      // Should return the touching point
      const intersection = findIntersectionPoint(line1Start, line1End, line2Start, line2End);

      expect(intersection).toEqual({ x: 5, y: 5 });
    });
  });

  describe('slicePolygon', () => {
    // Simple square polygon
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

    it('slices a polygon into two parts at specified vertices', () => {
      // Split square from vertex 0 to vertex 2
      const result = slicePolygon(square, 0, 2);

      // Should return two polygons
      expect(result).toHaveLength(2);

      // First polygon should have vertices 0, 1, 2
      expect(result[0].points).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]);

      // Second polygon should have vertices 0, 2, 3
      expect(result[1].points).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]);

      // Both should inherit the color
      expect(result[0].color).toBe('#FF0000');
      expect(result[1].color).toBe('#FF0000');
    });

    it('handles adjacent vertices by creating a single polygon', () => {
      // Split square from vertex 0 to vertex 1 (adjacent)
      const result = slicePolygon(square, 0, 1);

      // Should return a single polygon (no actual split)
      expect(result).toHaveLength(1);
      expect(result[0].points).toEqual(square.points);
    });

    it('returns empty array for invalid inputs', () => {
      // Invalid vertex indices
      expect(slicePolygon(square, -1, 2)).toEqual([]);
      expect(slicePolygon(square, 0, 5)).toEqual([]);
      expect(slicePolygon(square, 5, 2)).toEqual([]);

      // Empty polygon
      const emptyPolygon: Polygon = {
        points: [],
        closed: true,
        color: '#FF0000',
      };
      expect(slicePolygon(emptyPolygon, 0, 1)).toEqual([]);
    });

    it('handles triangle correctly', () => {
      const triangle: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 },
        ],
        closed: true,
        color: '#00FF00',
      };

      // Split from vertex 0 to vertex 2
      const result = slicePolygon(triangle, 0, 2);

      // Should return two polygons
      expect(result).toHaveLength(2);

      // First polygon should have vertices 0, 1, 2
      expect(result[0].points).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ]);

      // Second polygon should have vertices 0, 2 only (a line, not a valid polygon)
      expect(result[1].points).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 10 },
      ]);
    });

    it('handles complex polygons correctly', () => {
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

      // Split from vertex 0 to vertex 3
      const result = slicePolygon(complex, 0, 3);

      // Should return two polygons
      expect(result).toHaveLength(2);

      // First polygon should have vertices 0, 1, 2, 3
      expect(result[0].points).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 15, y: 5 },
        { x: 10, y: 10 },
      ]);

      // Second polygon should have vertices 0, 3, 4, 5
      expect(result[1].points).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: -5, y: 5 },
      ]);
    });

    it('preserves additional polygon properties', () => {
      // Polygon with additional properties
      const polygonWithProps: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
        id: 'test-polygon',
        label: 'Test Label',
        metadata: { category: 'test' },
      };

      // Split polygon
      const result = slicePolygon(polygonWithProps, 0, 2);

      // Should preserve additional properties
      expect(result[0].id).toBe('test-polygon');
      expect(result[0].label).toBe('Test Label');
      expect(result[0].metadata).toEqual({ category: 'test' });

      // Second polygon should also have these properties
      expect(result[1].id).toBe('test-polygon');
      expect(result[1].label).toBe('Test Label');
      expect(result[1].metadata).toEqual({ category: 'test' });
    });

    it('handles self-intersecting polygons correctly', () => {
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

      // Split from vertex 0 to vertex 2
      const result = slicePolygon(hourglass, 0, 2);

      // Should return two polygons
      expect(result).toHaveLength(2);
    });
  });
});
