import { describe, it, expect } from 'vitest';
import {
  isPointInPolygon,
  distance,
  simplifyPolygon,
  createPolygon,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculateBoundingBox,
  doPolygonsIntersect,
} from '../polygonUtils';
import { Point } from '@spheroseg/types';

describe('Polygon Utilities', () => {
  describe('isPointInPolygon', () => {
    it('detects point inside a simple polygon', () => {
      const squarePoints: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      // Point inside
      const insidePoint: Point = { x: 5, y: 5 };
      expect(isPointInPolygon(insidePoint, squarePoints)).toBe(true);

      // Point outside
      const outsidePoint: Point = { x: 15, y: 15 };
      expect(isPointInPolygon(outsidePoint, squarePoints)).toBe(false);

      // Point on edge
      const edgePoint: Point = { x: 10, y: 5 };
      expect(isPointInPolygon(edgePoint, squarePoints)).toBe(true);
    });

    it('handles complex polygon shapes correctly', () => {
      // Concave polygon (L-shape)
      const lShapePoints: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 10 },
        { x: 0, y: 10 },
      ];

      // Point in the main body
      expect(isPointInPolygon({ x: 2, y: 2 }, lShapePoints)).toBe(true);

      // Point in the concave area (outside the L)
      expect(isPointInPolygon({ x: 7, y: 7 }, lShapePoints)).toBe(false);
    });
  });

  describe('distance', () => {
    it('calculates distance between two points correctly', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 3, y: 4 };

      expect(distance(p1, p2)).toBe(5); // 3-4-5 triangle
    });

    it('handles zero distance', () => {
      const p1: Point = { x: 5, y: 5 };
      const p2: Point = { x: 5, y: 5 };

      expect(distance(p1, p2)).toBe(0);
    });
  });

  describe('simplifyPolygon', () => {
    it('simplifies a polygon with many points', () => {
      // Create a polygon with many points along a line
      const points: Point[] = [];
      for (let i = 0; i <= 100; i++) {
        points.push({ x: i, y: 0 });
      }

      const simplified = simplifyPolygon(points, 10);

      // Should reduce to just the endpoints
      expect(simplified.length).toBeLessThan(points.length);
      expect(simplified[0]).toEqual({ x: 0, y: 0 });
      expect(simplified[simplified.length - 1]).toEqual({ x: 100, y: 0 });
    });

    it('preserves important vertices', () => {
      const trianglePoints: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];

      const simplified = simplifyPolygon(trianglePoints, 1);

      // Should preserve all vertices of the triangle
      expect(simplified.length).toBe(3);
    });
  });

  describe('createPolygon', () => {
    it('creates a polygon with unique ID', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const polygon1 = createPolygon(points);
      const polygon2 = createPolygon(points);

      expect(polygon1.id).toBeDefined();
      expect(polygon2.id).toBeDefined();
      expect(polygon1.id).not.toBe(polygon2.id);
      expect(polygon1.type).toBe('external');
    });

    it('creates internal polygon when specified', () => {
      const points: Point[] = [
        { x: 2, y: 2 },
        { x: 8, y: 2 },
        { x: 8, y: 8 },
        { x: 2, y: 8 },
      ];

      const polygon = createPolygon(points, 'internal');

      expect(polygon.type).toBe('internal');
    });
  });

  describe('calculatePolygonArea', () => {
    it('calculates area of a square correctly', () => {
      const squarePoints: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      expect(calculatePolygonArea(squarePoints)).toBe(100);
    });

    it('calculates area of a triangle correctly', () => {
      const trianglePoints: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];

      expect(calculatePolygonArea(trianglePoints)).toBe(50);
    });
  });

  describe('calculatePolygonPerimeter', () => {
    it('calculates perimeter of a square correctly', () => {
      const squarePoints: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      expect(calculatePolygonPerimeter(squarePoints)).toBe(40);
    });
  });

  describe('calculateBoundingBox', () => {
    it('calculates bounding box correctly', () => {
      const points: Point[] = [
        { x: 5, y: 5 },
        { x: 15, y: 5 },
        { x: 15, y: 15 },
        { x: 5, y: 15 },
      ];

      const bbox = calculateBoundingBox(points);

      expect(bbox).toEqual({
        minX: 5,
        minY: 5,
        maxX: 15,
        maxY: 15,
      });
    });

    it('handles empty points array', () => {
      const bbox = calculateBoundingBox([]);

      expect(bbox).toEqual({
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
      });
    });
  });

  describe('doPolygonsIntersect', () => {
    it('detects intersecting polygons', () => {
      const poly1: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const poly2: Point[] = [
        { x: 5, y: 5 },
        { x: 15, y: 5 },
        { x: 15, y: 15 },
        { x: 5, y: 15 },
      ];

      expect(doPolygonsIntersect(poly1, poly2)).toBe(true);
    });

    it('detects non-intersecting polygons', () => {
      const poly1: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const poly2: Point[] = [
        { x: 20, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 30 },
        { x: 20, y: 30 },
      ];

      expect(doPolygonsIntersect(poly1, poly2)).toBe(false);
    });

    it('detects polygon fully contained within another', () => {
      const outer: Point[] = [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
      ];

      const inner: Point[] = [
        { x: 5, y: 5 },
        { x: 15, y: 5 },
        { x: 15, y: 15 },
        { x: 5, y: 15 },
      ];

      expect(doPolygonsIntersect(outer, inner)).toBe(true);
    });
  });
});
