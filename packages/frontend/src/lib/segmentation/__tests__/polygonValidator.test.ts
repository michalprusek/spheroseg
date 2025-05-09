import { validatePolygon, validatePolygons, MIN_POINTS_FOR_POLYGON } from '../polygonValidator';
import { Polygon } from '../types';

describe('polygonValidator', () => {
  describe('validatePolygon', () => {
    it('should validate a valid polygon', () => {
      const polygon: Polygon = {
        id: 'test-polygon',
        type: 'external',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ]
      };
      
      const result = validatePolygon(polygon);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject a polygon with too few points', () => {
      const polygon: Polygon = {
        id: 'test-polygon',
        type: 'external',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ]
      };
      
      const result = validatePolygon(polygon);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Polygon must have at least ${MIN_POINTS_FOR_POLYGON} points`);
    });
    
    it('should reject a polygon without an ID', () => {
      const polygon = {
        type: 'external',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 }
        ]
      } as Polygon;
      
      const result = validatePolygon(polygon);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Polygon must have an ID');
    });
    
    it('should reject a polygon with an invalid type', () => {
      const polygon = {
        id: 'test-polygon',
        type: 'invalid-type',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 }
        ]
      } as unknown as Polygon;
      
      const result = validatePolygon(polygon);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Polygon must have a valid type (external or internal)');
    });
    
    it('should detect duplicate points', () => {
      const polygon: Polygon = {
        id: 'test-polygon',
        type: 'external',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 0 } // Duplicate of the first point
        ]
      };
      
      const result = validatePolygon(polygon);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Polygon contains 1 duplicate point(s)');
    });
    
    it('should detect self-intersections', () => {
      const polygon: Polygon = {
        id: 'test-polygon',
        type: 'external',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 10, y: 0 }
        ]
      };
      
      const result = validatePolygon(polygon);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Polygon has self-intersections');
    });
  });
  
  describe('validatePolygons', () => {
    it('should validate a collection of valid polygons', () => {
      const polygons: Polygon[] = [
        {
          id: 'polygon-1',
          type: 'external',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ]
        },
        {
          id: 'polygon-2',
          type: 'internal',
          points: [
            { x: 20, y: 20 },
            { x: 30, y: 20 },
            { x: 30, y: 30 },
            { x: 20, y: 30 }
          ]
        }
      ];
      
      const result = validatePolygons(polygons);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect duplicate IDs', () => {
      const polygons: Polygon[] = [
        {
          id: 'duplicate-id',
          type: 'external',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ]
        },
        {
          id: 'duplicate-id', // Same ID as the first polygon
          type: 'internal',
          points: [
            { x: 20, y: 20 },
            { x: 30, y: 20 },
            { x: 30, y: 30 },
            { x: 20, y: 30 }
          ]
        }
      ];
      
      const result = validatePolygons(polygons);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Found 1 duplicate polygon ID(s): duplicate-id');
    });
    
    it('should report errors from individual polygons', () => {
      const polygons: Polygon[] = [
        {
          id: 'valid-polygon',
          type: 'external',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ]
        },
        {
          id: 'invalid-polygon',
          type: 'internal',
          points: [
            { x: 20, y: 20 },
            { x: 30, y: 20 } // Too few points
          ]
        }
      ];
      
      const result = validatePolygons(polygons);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Polygon #2 (invalid-polygon)');
      expect(result.errors[0]).toContain(`Polygon must have at least ${MIN_POINTS_FOR_POLYGON} points`);
    });
  });
});
