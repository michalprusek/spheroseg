/**
 * Tests for geometry utilities
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  calculateArea,
  calculatePerimeter,
  calculateCentroid,
  isPointInPolygon,
  getBoundingBox,
  normalizePolygon,
} from '../geometryUtils';

describe('Geometry Utils', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const point1 = { x: 0, y: 0 };
      const point2 = { x: 3, y: 4 };
      
      const distance = calculateDistance(point1, point2);
      expect(distance).toBe(5); // 3-4-5 triangle
    });

    it('should return 0 for same points', () => {
      const point = { x: 5, y: 5 };
      const distance = calculateDistance(point, point);
      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const point1 = { x: -3, y: -4 };
      const point2 = { x: 0, y: 0 };
      
      const distance = calculateDistance(point1, point2);
      expect(distance).toBe(5);
    });
  });

  describe('calculateArea', () => {
    it('should calculate area of a rectangle', () => {
      const rectangle = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ];
      
      const area = calculateArea(rectangle);
      expect(area).toBe(12);
    });

    it('should calculate area of a triangle', () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 3 },
      ];
      
      const area = calculateArea(triangle);
      expect(area).toBe(6);
    });

    it('should return 0 for invalid polygons', () => {
      const invalidPolygon = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ];
      
      const area = calculateArea(invalidPolygon);
      expect(area).toBe(0);
    });
  });

  describe('calculatePerimeter', () => {
    it('should calculate perimeter of a rectangle', () => {
      const rectangle = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ];
      
      const perimeter = calculatePerimeter(rectangle);
      expect(perimeter).toBe(14); // 4 + 3 + 4 + 3
    });

    it('should calculate perimeter of a triangle', () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 0, y: 4 },
      ];
      
      const perimeter = calculatePerimeter(triangle);
      expect(perimeter).toBe(12); // 3 + 4 + 5
    });
  });

  describe('calculateCentroid', () => {
    it('should calculate centroid of a rectangle', () => {
      const rectangle = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 0, y: 2 },
      ];
      
      const centroid = calculateCentroid(rectangle);
      expect(centroid.x).toBe(2);
      expect(centroid.y).toBe(1);
    });

    it('should calculate centroid of a triangle', () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 3, y: 6 },
      ];
      
      const centroid = calculateCentroid(triangle);
      expect(centroid.x).toBe(3);
      expect(centroid.y).toBe(2);
    });
  });

  describe('isPointInPolygon', () => {
    const rectangle = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];

    it('should detect point inside polygon', () => {
      const insidePoint = { x: 2, y: 1.5 };
      expect(isPointInPolygon(insidePoint, rectangle)).toBe(true);
    });

    it('should detect point outside polygon', () => {
      const outsidePoint = { x: 5, y: 5 };
      expect(isPointInPolygon(outsidePoint, rectangle)).toBe(false);
    });

    it('should handle point on polygon edge', () => {
      const edgePoint = { x: 2, y: 0 };
      expect(isPointInPolygon(edgePoint, rectangle)).toBe(true);
    });

    it('should handle point at polygon vertex', () => {
      const vertexPoint = { x: 0, y: 0 };
      expect(isPointInPolygon(vertexPoint, rectangle)).toBe(true);
    });
  });

  describe('getBoundingBox', () => {
    it('should calculate bounding box of polygon', () => {
      const polygon = [
        { x: 1, y: 2 },
        { x: 5, y: 1 },
        { x: 4, y: 6 },
        { x: 0, y: 3 },
      ];
      
      const bbox = getBoundingBox(polygon);
      expect(bbox.minX).toBe(0);
      expect(bbox.maxX).toBe(5);
      expect(bbox.minY).toBe(1);
      expect(bbox.maxY).toBe(6);
      expect(bbox.width).toBe(5);
      expect(bbox.height).toBe(5);
    });

    it('should handle single point', () => {
      const singlePoint = [{ x: 3, y: 4 }];
      
      const bbox = getBoundingBox(singlePoint);
      expect(bbox.minX).toBe(3);
      expect(bbox.maxX).toBe(3);
      expect(bbox.minY).toBe(4);
      expect(bbox.maxY).toBe(4);
      expect(bbox.width).toBe(0);
      expect(bbox.height).toBe(0);
    });
  });

  describe('normalizePolygon', () => {
    it('should normalize polygon to unit square', () => {
      const polygon = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      
      const normalized = normalizePolygon(polygon);
      
      expect(normalized[0]).toEqual({ x: 0, y: 0 });
      expect(normalized[1]).toEqual({ x: 1, y: 0 });
      expect(normalized[2]).toEqual({ x: 1, y: 1 });
      expect(normalized[3]).toEqual({ x: 0, y: 1 });
    });

    it('should handle polygon with offset', () => {
      const polygon = [
        { x: 10, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 40 },
        { x: 10, y: 40 },
      ];
      
      const normalized = normalizePolygon(polygon);
      
      expect(normalized[0]).toEqual({ x: 0, y: 0 });
      expect(normalized[1]).toEqual({ x: 1, y: 0 });
      expect(normalized[2]).toEqual({ x: 1, y: 1 });
      expect(normalized[3]).toEqual({ x: 0, y: 1 });
    });

    it('should handle degenerate cases', () => {
      const singlePoint = [{ x: 5, y: 5 }];
      const normalized = normalizePolygon(singlePoint);
      
      expect(normalized).toEqual([{ x: 0, y: 0 }]);
    });
  });

  describe('Geometry utility integration', () => {
    it('should provide consistent calculations', () => {
      const square = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const area = calculateArea(square);
      const perimeter = calculatePerimeter(square);
      const centroid = calculateCentroid(square);
      const bbox = getBoundingBox(square);

      expect(area).toBe(100);
      expect(perimeter).toBe(40);
      expect(centroid).toEqual({ x: 5, y: 5 });
      expect(bbox.width).toBe(10);
      expect(bbox.height).toBe(10);
    });

    it('should handle complex polygon calculations', () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 3, y: 8 },
      ];

      const area = calculateArea(triangle);
      const perimeter = calculatePerimeter(triangle);
      const centroid = calculateCentroid(triangle);

      expect(area).toBe(24);
      expect(perimeter).toBe(20); // 6 + 10 + 10 (approximately)
      expect(centroid.x).toBe(3);
      
      // Test point inside triangle
      expect(isPointInPolygon(centroid, triangle)).toBe(true);
    });
  });
});