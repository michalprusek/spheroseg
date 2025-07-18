import { describe, it, expect } from 'vitest';
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculateBoundingBox,
  convertPixelsToRealUnits,
  generatePolygonStatistics,
} from '../metricCalculations';
import { Polygon } from '@spheroseg/types';

describe('Metric Calculations Utilities', () => {
  describe('calculatePolygonArea', () => {
    it('calculates area of a simple square', () => {
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

      // Area should be 100 square units
      expect(calculatePolygonArea(square)).toBe(100);
    });

    it('calculates area of a triangle', () => {
      const triangle: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Area should be 50 square units
      expect(calculatePolygonArea(triangle)).toBe(50);
    });

    it('handles polygon with negative coordinates', () => {
      const polygon: Polygon = {
        points: [
          { x: -5, y: -5 },
          { x: 5, y: -5 },
          { x: 5, y: 5 },
          { x: -5, y: 5 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Area should be 100 square units
      expect(calculatePolygonArea(polygon)).toBe(100);
    });

    it('returns 0 for polygons with fewer than 3 points', () => {
      const line: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      expect(calculatePolygonArea(line)).toBe(0);
    });

    it('calculates area of a complex polygon correctly', () => {
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
        color: '#FF0000',
      };

      // Area calculation for complex shape
      const area = calculatePolygonArea(complex);
      expect(area).toBeGreaterThan(0);
      // Specific expected value would depend on the exact formula used
      // Here we're just checking it's reasonable
      expect(area).toBeCloseTo(150, 0); // Approximately 150 square units
    });
  });

  describe('calculatePolygonPerimeter', () => {
    it('calculates perimeter of a square', () => {
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

      // Perimeter should be 40 units (4 sides of 10 units each)
      expect(calculatePolygonPerimeter(square)).toBe(40);
    });

    it('calculates perimeter of a triangle', () => {
      const triangle: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
          { x: 0, y: 4 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Sides are 3, 4, and 5 (Pythagorean triangle)
      // Perimeter should be 12 units
      expect(calculatePolygonPerimeter(triangle)).toBeCloseTo(12, 5);
    });

    it('returns 0 for polygons with fewer than 2 points', () => {
      const point: Polygon = {
        points: [{ x: 0, y: 0 }],
        closed: true,
        color: '#FF0000',
      };

      expect(calculatePolygonPerimeter(point)).toBe(0);
    });

    it('includes closing segment for open polygons', () => {
      const openPolygon: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: false, // Even though marked as not closed
        color: '#FF0000',
      };

      // Should still calculate as if closed
      expect(calculatePolygonPerimeter(openPolygon)).toBe(40);
    });
  });

  describe('calculateBoundingBox', () => {
    it('calculates correct bounding box for a polygon', () => {
      const polygon: Polygon = {
        points: [
          { x: 5, y: 5 },
          { x: 15, y: 5 },
          { x: 15, y: 15 },
          { x: 5, y: 15 },
        ],
        closed: true,
        color: '#FF0000',
      };

      const boundingBox = calculateBoundingBox(polygon);

      expect(boundingBox).toEqual({
        minX: 5,
        minY: 5,
        maxX: 15,
        maxY: 15,
        width: 10,
        height: 10,
      });
    });

    it('handles polygons with negative coordinates', () => {
      const polygon: Polygon = {
        points: [
          { x: -10, y: -10 },
          { x: 10, y: -10 },
          { x: 10, y: 10 },
          { x: -10, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      const boundingBox = calculateBoundingBox(polygon);

      expect(boundingBox).toEqual({
        minX: -10,
        minY: -10,
        maxX: 10,
        maxY: 10,
        width: 20,
        height: 20,
      });
    });

    it('returns zeroed bounding box for empty polygon', () => {
      const emptyPolygon: Polygon = {
        points: [],
        closed: true,
        color: '#FF0000',
      };

      const boundingBox = calculateBoundingBox(emptyPolygon);

      expect(boundingBox).toEqual({
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0,
      });
    });

    it('handles single-point polygon', () => {
      const point: Polygon = {
        points: [{ x: 5, y: 5 }],
        closed: true,
        color: '#FF0000',
      };

      const boundingBox = calculateBoundingBox(point);

      expect(boundingBox).toEqual({
        minX: 5,
        minY: 5,
        maxX: 5,
        maxY: 5,
        width: 0,
        height: 0,
      });
    });
  });

  describe('convertPixelsToRealUnits', () => {
    it('converts pixels to meters correctly with given scale', () => {
      // 100 pixels at scale of 10 pixels/meter = 10 meters
      expect(convertPixelsToRealUnits(100, 10, 'meters')).toBe(10);

      // 100 pixels at scale of 20 pixels/meter = 5 meters
      expect(convertPixelsToRealUnits(100, 20, 'meters')).toBe(5);
    });

    it('converts to different unit systems', () => {
      // 100 pixels at scale of 10 pixels/meter
      // = 10 meters
      // = 32.8084 feet (approx)
      expect(convertPixelsToRealUnits(100, 10, 'feet')).toBeCloseTo(32.8084, 2);

      // 100 pixels at scale of 10 pixels/meter
      // = 10 meters
      // = 0.01 kilometers
      expect(convertPixelsToRealUnits(100, 10, 'kilometers')).toBe(0.01);
    });

    it('returns pixel value if no scale provided', () => {
      expect(convertPixelsToRealUnits(100, 0, 'meters')).toBe(100);
      expect(convertPixelsToRealUnits(100, undefined, 'meters')).toBe(100);
    });

    it('handles invalid unit by defaulting to meters', () => {
      // @ts-expect-error - intentionally testing invalid unit
      expect(convertPixelsToRealUnits(100, 10, 'lightyears')).toBe(10);
    });
  });

  describe('generatePolygonStatistics', () => {
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

    it('generates correct statistics for a polygon without scale', () => {
      const stats = generatePolygonStatistics(polygon);

      expect(stats).toEqual({
        area: 100,
        perimeter: 40,
        boundingBox: {
          minX: 0,
          minY: 0,
          maxX: 10,
          maxY: 10,
          width: 10,
          height: 10,
        },
        vertexCount: 4,
        realArea: 100,
        realPerimeter: 40,
        realWidth: 10,
        realHeight: 10,
        unit: 'pixels',
      });
    });

    it('generates correct statistics with scale and unit', () => {
      const stats = generatePolygonStatistics(polygon, 10, 'meters');

      expect(stats).toEqual({
        area: 100,
        perimeter: 40,
        boundingBox: {
          minX: 0,
          minY: 0,
          maxX: 10,
          maxY: 10,
          width: 10,
          height: 10,
        },
        vertexCount: 4,
        realArea: 1, // 100 pixels² -> 1 meter²
        realPerimeter: 4, // 40 pixels -> 4 meters
        realWidth: 1, // 10 pixels -> 1 meter
        realHeight: 1, // 10 pixels -> 1 meter
        unit: 'meters',
      });
    });

    it('handles empty polygon gracefully', () => {
      const emptyPolygon: Polygon = {
        points: [],
        closed: true,
        color: '#FF0000',
      };

      const stats = generatePolygonStatistics(emptyPolygon);

      expect(stats).toEqual({
        area: 0,
        perimeter: 0,
        boundingBox: {
          minX: 0,
          minY: 0,
          maxX: 0,
          maxY: 0,
          width: 0,
          height: 0,
        },
        vertexCount: 0,
        realArea: 0,
        realPerimeter: 0,
        realWidth: 0,
        realHeight: 0,
        unit: 'pixels',
      });
    });
  });
});
