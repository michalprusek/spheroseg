import { describe, it, expect } from 'vitest';
import { calculatePolygonArea, calculatePerimeter, Point } from '../segmentation';

describe('Segmentation Utilities', () => {
  describe('calculatePolygonArea', () => {
    it('calculates the area of a square correctly', () => {
      const square: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      
      const area = calculatePolygonArea(square);
      expect(area).toBe(100); // 10x10 square
    });
    
    it('calculates the area of a triangle correctly', () => {
      const triangle: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 }
      ];
      
      const area = calculatePolygonArea(triangle);
      expect(area).toBe(50); // Base 10, height 10, area = (10*10)/2 = 50
    });
    
    it('calculates the area of a complex polygon correctly', () => {
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 15, y: 5 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      
      const area = calculatePolygonArea(polygon);
      expect(area).toBeGreaterThan(0);
      expect(area).toBeLessThan(200); // Rough estimate for this shape
      expect(area).toBeCloseTo(125, 0); // Expected area is 125
    });
    
    it('returns zero for a polygon with less than 3 points', () => {
      const line: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ];
      
      const area = calculatePolygonArea(line);
      expect(area).toBe(0);
    });
    
    it('handles an empty array', () => {
      const empty: Point[] = [];
      const area = calculatePolygonArea(empty);
      expect(area).toBe(0);
    });
  });
  
  describe('calculatePerimeter', () => {
    it('calculates the perimeter of a square correctly', () => {
      const square: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      
      const perimeter = calculatePerimeter(square);
      expect(perimeter).toBe(40); // 4 sides of length 10
    });
    
    it('calculates the perimeter of a triangle correctly', () => {
      const triangle: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 }
      ];
      
      const perimeter = calculatePerimeter(triangle);
      
      // Side lengths: 10, sqrt(25 + 100) ≈ 11.18, sqrt(25 + 100) ≈ 11.18
      // Total: 10 + 11.18 + 11.18 ≈ 32.36
      expect(perimeter).toBeCloseTo(32.36, 1);
    });
    
    it('calculates the perimeter of a complex polygon correctly', () => {
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 15, y: 5 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      
      const perimeter = calculatePerimeter(polygon);
      expect(perimeter).toBeGreaterThan(0);
      
      // Expected perimeter: 10 + 7.07 + 7.07 + 10 + 10 = 44.14
      expect(perimeter).toBeCloseTo(44.14, 1);
    });
    
    it('returns zero for a polygon with less than 2 points', () => {
      const point: Point[] = [
        { x: 0, y: 0 }
      ];
      
      const perimeter = calculatePerimeter(point);
      expect(perimeter).toBe(0);
    });
    
    it('handles an empty array', () => {
      const empty: Point[] = [];
      const perimeter = calculatePerimeter(empty);
      expect(perimeter).toBe(0);
    });
  });
});
