import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  calculatePolygonArea, 
  calculatePerimeter, 
  Point, 
  Polygon 
} from '@/lib/segmentation';

// Mock canvas and context for browser environment
const mockContext = {
  drawImage: vi.fn(),
  getImageData: vi.fn(),
};

const mockCanvas = {
  getContext: vi.fn().mockReturnValue(mockContext),
  width: 100,
  height: 100,
};

// Mock document.createElement
global.document.createElement = vi.fn().mockImplementation((tagName) => {
  if (tagName === 'canvas') {
    return mockCanvas;
  }
  return {};
});

// Mock Image
class MockImage {
  public onload: () => void = () => {};
  public onerror: (error: any) => void = () => {};
  public src: string = '';
  public width: number = 100;
  public height: number = 100;
  public crossOrigin: string = '';
}

global.Image = MockImage as any;

describe('Image Processing Utilities', () => {
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
    });
    
    it('returns zero for a polygon with less than 3 points', () => {
      const line: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ];
      
      const area = calculatePolygonArea(line);
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
    });
    
    it('returns zero for a polygon with less than 2 points', () => {
      const point: Point[] = [
        { x: 0, y: 0 }
      ];
      
      const perimeter = calculatePerimeter(point);
      expect(perimeter).toBe(0);
    });
  });
  
  describe('Polygon data structure', () => {
    it('supports all required properties', () => {
      const polygon: Polygon = {
        id: 'test-polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ],
        type: 'external',
        class: 'spheroid',
        color: '#FF5733',
        parentId: 'parent-polygon'
      };
      
      expect(polygon.id).toBe('test-polygon');
      expect(polygon.points).toHaveLength(4);
      expect(polygon.type).toBe('external');
      expect(polygon.class).toBe('spheroid');
      expect(polygon.color).toBe('#FF5733');
      expect(polygon.parentId).toBe('parent-polygon');
    });
    
    it('requires only id, points, and type properties', () => {
      const minimalPolygon: Polygon = {
        id: 'minimal-polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 }
        ],
        type: 'external'
      };
      
      expect(minimalPolygon.id).toBe('minimal-polygon');
      expect(minimalPolygon.points).toHaveLength(3);
      expect(minimalPolygon.type).toBe('external');
      expect(minimalPolygon.class).toBeUndefined();
      expect(minimalPolygon.color).toBeUndefined();
      expect(minimalPolygon.parentId).toBeUndefined();
    });
  });
});
