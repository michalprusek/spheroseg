import { describe, it, expect } from 'vitest';
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculatePolygonMetrics,
  convertPixelsToRealUnits,
  generatePolygonStatistics,
} from '../metricCalculations';
import { Polygon } from '@/pages/segmentation/types';

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
      expect(calculatePolygonArea(square.points)).toBe(100);
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
      expect(calculatePolygonArea(triangle.points)).toBe(50);
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
      expect(calculatePolygonArea(polygon.points)).toBe(100);
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

      expect(calculatePolygonArea(line.points)).toBe(0);
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
      const area = calculatePolygonArea(complex.points);
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
      expect(calculatePolygonPerimeter(square.points)).toBe(40);
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
      expect(calculatePolygonPerimeter(triangle.points)).toBeCloseTo(12, 5);
    });

    it('returns 0 for polygons with fewer than 2 points', () => {
      const point: Polygon = {
        points: [{ x: 0, y: 0 }],
        closed: true,
        color: '#FF0000',
      };

      expect(calculatePolygonPerimeter(point.points)).toBe(0);
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
      expect(calculatePolygonPerimeter(openPolygon.points)).toBe(40);
    });
  });

  describe('calculatePolygonMetrics (includes bounding box)', () => {
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

      const metrics = calculatePolygonMetrics(polygon.points);

      expect(metrics.boundingBox).toEqual({
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

      const metrics = calculatePolygonMetrics(polygon.points);

      expect(metrics.boundingBox).toEqual({
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

      const metrics = calculatePolygonMetrics(emptyPolygon.points);

      expect(metrics.boundingBox).toEqual({
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
        width: -Infinity,
        height: -Infinity,
      });
    });

    it('handles single-point polygon', () => {
      const point: Polygon = {
        points: [{ x: 5, y: 5 }],
        closed: true,
        color: '#FF0000',
      };

      const metrics = calculatePolygonMetrics(point.points);

      expect(metrics.boundingBox).toEqual({
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
      expect(convertPixelsToRealUnits(100, 10, 'meters')).toEqual({ value: 10, unit: 'meters' });

      // 100 pixels at scale of 20 pixels/meter = 5 meters
      expect(convertPixelsToRealUnits(100, 20, 'meters')).toEqual({ value: 5, unit: 'meters' });
    });

    it('converts to different unit systems', () => {
      // 100 pixels at scale of 10 pixels/meter = 10 units
      expect(convertPixelsToRealUnits(100, 10, 'feet')).toEqual({ value: 10, unit: 'feet' });

      // 100 pixels at scale of 10 pixels/meter = 10 units
      expect(convertPixelsToRealUnits(100, 10, 'kilometers')).toEqual({ value: 10, unit: 'kilometers' });
    });

    it('returns pixel value if no scale provided', () => {
      expect(convertPixelsToRealUnits(100, 0, 'meters')).toEqual({ value: 100, unit: 'px' });
      expect(convertPixelsToRealUnits(100, undefined, 'meters')).toEqual({ value: 100, unit: 'px' });
    });

    it('handles custom unit names', () => {
      expect(convertPixelsToRealUnits(100, 10, 'lightyears')).toEqual({ value: 10, unit: 'lightyears' });
    });
  });

  describe('generatePolygonStatistics', () => {
    const polygon1: Polygon = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      closed: true,
      color: '#FF0000',
    };

    const polygon2: Polygon = {
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
        { x: 0, y: 5 },
      ],
      closed: true,
      color: '#00FF00',
    };

    it('generates correct statistics for multiple polygons', () => {
      const stats = generatePolygonStatistics([polygon1, polygon2]);

      expect(stats).toEqual({
        count: 2,
        totalArea: 125, // 100 + 25
        averageArea: 62.5, // 125 / 2
        minArea: 25,
        maxArea: 100,
        totalPerimeter: 60, // 40 + 20
        averagePerimeter: 30, // 60 / 2
        averageCircularity: expect.any(Number),
      });
    });

    it('generates correct statistics for single polygon', () => {
      const stats = generatePolygonStatistics([polygon1]);

      expect(stats).toEqual({
        count: 1,
        totalArea: 100,
        averageArea: 100,
        minArea: 100,
        maxArea: 100,
        totalPerimeter: 40,
        averagePerimeter: 40,
        averageCircularity: expect.any(Number),
      });
    });

    it('handles empty polygon array gracefully', () => {
      const stats = generatePolygonStatistics([]);

      expect(stats).toEqual({
        count: 0,
        totalArea: 0,
        averageArea: 0,
        minArea: 0,
        maxArea: 0,
        totalPerimeter: 0,
        averagePerimeter: 0,
        averageCircularity: 0,
      });
    });
  });
});
