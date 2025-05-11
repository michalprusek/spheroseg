import { describe, it, expect, vi } from 'vitest';
import {
  isPointInsidePolygon,
  calculateDistance,
  generatePolygonColor,
  simplifyPolygon,
  smoothPolygon,
  mergePolygons,
  polygonToGeoJSON,
  polygonFromGeoJSON,
} from '../polygonUtils';
import { Polygon, Point } from '@spheroseg/types';

describe('Polygon Utilities', () => {
  describe('isPointInsidePolygon', () => {
    it('detects point inside a simple polygon', () => {
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

      // Point inside
      const insidePoint: Point = { x: 5, y: 5 };
      expect(isPointInsidePolygon(square, insidePoint)).toBe(true);

      // Point outside
      const outsidePoint: Point = { x: 15, y: 15 };
      expect(isPointInsidePolygon(square, outsidePoint)).toBe(false);

      // Point on edge (implementation-dependent, but generally considered inside)
      const edgePoint: Point = { x: 10, y: 5 };
      expect(isPointInsidePolygon(square, edgePoint)).toBe(true);
    });

    it('handles complex polygon shapes correctly', () => {
      // Concave polygon (L-shape)
      const lShape: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 5 },
          { x: 5, y: 5 },
          { x: 5, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Points inside different regions
      expect(isPointInsidePolygon(lShape, { x: 2, y: 2 })).toBe(true);
      expect(isPointInsidePolygon(lShape, { x: 8, y: 2 })).toBe(true);
      expect(isPointInsidePolygon(lShape, { x: 2, y: 8 })).toBe(true);

      // Point in concave "notch" (outside)
      expect(isPointInsidePolygon(lShape, { x: 8, y: 8 })).toBe(false);
    });

    it('handles edge cases correctly', () => {
      // Triangle
      const triangle: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Point exactly on a vertex
      expect(isPointInsidePolygon(triangle, { x: 0, y: 0 })).toBe(true);

      // Point very close to edge (internally implementation-dependent)
      const nearEdgePoint: Point = { x: 5, y: 0.001 };

      // We don't care about the exact result here, just that it doesn't throw
      expect(() => isPointInsidePolygon(triangle, nearEdgePoint)).not.toThrow();

      // Empty polygon
      const emptyPolygon: Polygon = {
        points: [],
        closed: true,
        color: '#FF0000',
      };

      expect(isPointInsidePolygon(emptyPolygon, { x: 0, y: 0 })).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('calculates distance between two points correctly', () => {
      const point1: Point = { x: 0, y: 0 };
      const point2: Point = { x: 3, y: 4 };

      // Pythagorean triangle: 3-4-5
      expect(calculateDistance(point1, point2)).toBe(5);
    });

    it('returns 0 for identical points', () => {
      const point: Point = { x: 10, y: 20 };
      expect(calculateDistance(point, point)).toBe(0);
    });

    it('handles negative coordinates', () => {
      const point1: Point = { x: -1, y: -1 };
      const point2: Point = { x: 2, y: 3 };

      // Distance should be sqrt(3^2 + 4^2) = 5
      expect(calculateDistance(point1, point2)).toBeCloseTo(5, 5);
    });
  });

  describe('generatePolygonColor', () => {
    it('generates a valid hex color string', () => {
      // Mock Math.random to get predictable colors
      const randomMock = vi.spyOn(Math, 'random');

      // Set to return values that will give us #FF0000 (red)
      randomMock.mockReturnValueOnce(1.0); // r = 255
      randomMock.mockReturnValueOnce(0.0); // g = 0
      randomMock.mockReturnValueOnce(0.0); // b = 0

      const color = generatePolygonColor();
      expect(color).toBe('#FF0000');

      randomMock.mockRestore();
    });

    it('generates different colors on successive calls', () => {
      const color1 = generatePolygonColor();
      const color2 = generatePolygonColor();

      expect(color1).not.toBe(color2);
    });

    it('always returns a valid hex color format', () => {
      for (let i = 0; i < 10; i++) {
        const color = generatePolygonColor();

        // Should match #RRGGBB format
        expect(color).toMatch(/^#[0-9A-F]{6}$/);
      }
    });
  });

  describe('simplifyPolygon', () => {
    it('simplifies a polygon by reducing the number of points', () => {
      // Complex polygon with unnecessary points
      const complex: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }, // Almost collinear with neighbors
          { x: 2, y: 0 },
          { x: 3, y: 0 }, // Almost collinear with neighbors
          { x: 4, y: 0 },
          { x: 4, y: 1 }, // Almost collinear with neighbors
          { x: 4, y: 2 },
          { x: 4, y: 3 }, // Almost collinear with neighbors
          { x: 4, y: 4 },
          { x: 3, y: 4 }, // Almost collinear with neighbors
          { x: 2, y: 4 },
          { x: 1, y: 4 }, // Almost collinear with neighbors
          { x: 0, y: 4 },
          { x: 0, y: 3 }, // Almost collinear with neighbors
          { x: 0, y: 2 },
          { x: 0, y: 1 }, // Almost collinear with neighbors
        ],
        closed: true,
        color: '#FF0000',
      };

      // Simplify with moderate tolerance
      const simplified = simplifyPolygon(complex, 0.5);

      // Should reduce number of points
      expect(simplified.points.length).toBeLessThan(complex.points.length);
      expect(simplified.points.length).toBeGreaterThan(0);

      // Should preserve color and closed state
      expect(simplified.color).toBe(complex.color);
      expect(simplified.closed).toBe(complex.closed);
    });

    it('returns original polygon with zero tolerance', () => {
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

      // Simplify with zero tolerance
      const simplified = simplifyPolygon(polygon, 0);

      // Should be the same as original
      expect(simplified).toEqual(polygon);
    });

    it('handles edge cases correctly', () => {
      // Empty polygon
      const emptyPolygon: Polygon = {
        points: [],
        closed: true,
        color: '#FF0000',
      };

      expect(simplifyPolygon(emptyPolygon, 1.0)).toEqual(emptyPolygon);

      // Polygon with 1-2 points (can't be simplified further)
      const pointPolygon: Polygon = {
        points: [{ x: 0, y: 0 }],
        closed: true,
        color: '#FF0000',
      };

      expect(simplifyPolygon(pointPolygon, 1.0)).toEqual(pointPolygon);

      const linePolygon: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      expect(simplifyPolygon(linePolygon, 1.0)).toEqual(linePolygon);
    });
  });

  describe('smoothPolygon', () => {
    it('smooths a polygon by adding more points', () => {
      // Simple triangle
      const triangle: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Smooth with factor 2 (should insert one point between each pair)
      const smoothed = smoothPolygon(triangle, 2);

      // Should have more points than original
      expect(smoothed.points.length).toBeGreaterThan(triangle.points.length);

      // Should preserve color and closed state
      expect(smoothed.color).toBe(triangle.color);
      expect(smoothed.closed).toBe(triangle.closed);
    });

    it('returns original polygon with factor ≤ 1', () => {
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

      // Smooth with factor 1 (no smoothing)
      const smoothed1 = smoothPolygon(polygon, 1);
      expect(smoothed1).toEqual(polygon);

      // Smooth with factor 0 (invalid, should default to no smoothing)
      const smoothed0 = smoothPolygon(polygon, 0);
      expect(smoothed0).toEqual(polygon);
    });

    it('handles edge cases correctly', () => {
      // Empty polygon
      const emptyPolygon: Polygon = {
        points: [],
        closed: true,
        color: '#FF0000',
      };

      expect(smoothPolygon(emptyPolygon, 2)).toEqual(emptyPolygon);

      // Polygon with 1-2 points (can't be smoothed)
      const pointPolygon: Polygon = {
        points: [{ x: 0, y: 0 }],
        closed: true,
        color: '#FF0000',
      };

      expect(smoothPolygon(pointPolygon, 2)).toEqual(pointPolygon);

      const linePolygon: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        closed: true,
        color: '#FF0000',
      };

      // Line can be smoothed by adding points along the line
      const smoothedLine = smoothPolygon(linePolygon, 2);
      expect(smoothedLine.points.length).toBeGreaterThan(linePolygon.points.length);
    });
  });

  describe('mergePolygons', () => {
    it('combines two polygons into one', () => {
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
          { x: 5, y: 5 },
          { x: 15, y: 5 },
          { x: 15, y: 15 },
          { x: 5, y: 15 },
        ],
        closed: true,
        color: '#00FF00',
      };

      // Merge the polygons
      const merged = mergePolygons(polygon1, polygon2);

      // Should have points from both polygons
      expect(merged.points.length).toBeGreaterThan(0);

      // Should inherit color from the first polygon
      expect(merged.color).toBe(polygon1.color);
    });

    it('handles non-overlapping polygons correctly', () => {
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
          { x: 20, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 30 },
          { x: 20, y: 30 },
        ],
        closed: true,
        color: '#00FF00',
      };

      // Merge non-overlapping polygons
      const merged = mergePolygons(polygon1, polygon2);

      // Should still produce a result
      expect(merged.points.length).toBeGreaterThan(0);
    });

    it('handles edge cases correctly', () => {
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

      // Merge with empty polygon
      const emptyPolygon: Polygon = {
        points: [],
        closed: true,
        color: '#00FF00',
      };

      const mergedWithEmpty = mergePolygons(polygon, emptyPolygon);
      expect(mergedWithEmpty).toEqual(polygon);

      // Merge two empty polygons
      const emptyMerge = mergePolygons(emptyPolygon, emptyPolygon);
      expect(emptyMerge).toEqual(emptyPolygon);
    });
  });

  describe('polygonToGeoJSON', () => {
    it('converts polygon to GeoJSON format', () => {
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

      const geoJSON = polygonToGeoJSON(polygon);

      // Should have correct GeoJSON structure
      expect(geoJSON.type).toBe('Feature');
      expect(geoJSON.geometry.type).toBe('Polygon');

      // Should have coordinates array
      expect(Array.isArray(geoJSON.geometry.coordinates)).toBe(true);
      expect(geoJSON.geometry.coordinates.length).toBe(1); // One ring

      // Should include the color in properties
      expect(geoJSON.properties.color).toBe('#FF0000');
    });

    it('handles open polygons by closing them in GeoJSON', () => {
      // Open polygon (last point != first point)
      const openPolygon: Polygon = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: false,
        color: '#FF0000',
      };

      const geoJSON = polygonToGeoJSON(openPolygon);

      // First and last coordinates should be the same in GeoJSON
      const coordinates = geoJSON.geometry.coordinates[0];
      expect(coordinates[0][0]).toBe(coordinates[coordinates.length - 1][0]);
      expect(coordinates[0][1]).toBe(coordinates[coordinates.length - 1][1]);
    });

    it('includes additional properties if provided', () => {
      const polygon: Polygon = {
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
        metadata: { category: 'building' },
      };

      const geoJSON = polygonToGeoJSON(polygon);

      // Should include all properties
      expect(geoJSON.properties.color).toBe('#FF0000');
      expect(geoJSON.properties.id).toBe('test-polygon');
      expect(geoJSON.properties.label).toBe('Test Label');
      expect(geoJSON.properties.metadata.category).toBe('building');
    });
  });

  describe('polygonFromGeoJSON', () => {
    it('converts GeoJSON to polygon format', () => {
      const geoJSON = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0], // Closed loop in GeoJSON
            ],
          ],
        },
        properties: {
          color: '#FF0000',
        },
      };

      const polygon = polygonFromGeoJSON(geoJSON);

      // Should have correct structure
      expect(polygon.points).toHaveLength(4); // 4 unique points (GeoJSON repeats first point)
      expect(polygon.closed).toBe(true);
      expect(polygon.color).toBe('#FF0000');
    });

    it('handles GeoJSON without properties', () => {
      const geoJSON = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
        },
        properties: {}, // Empty properties
      };

      const polygon = polygonFromGeoJSON(geoJSON);

      // Should have correct structure with default color
      expect(polygon.points).toHaveLength(4);
      expect(polygon.color).toBeDefined(); // Should have a default color
    });

    it('preserves additional properties', () => {
      const geoJSON = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
        },
        properties: {
          color: '#FF0000',
          id: 'test-polygon',
          label: 'Test Label',
          metadata: { category: 'building' },
        },
      };

      const polygon = polygonFromGeoJSON(geoJSON);

      // Should preserve all properties
      expect(polygon.color).toBe('#FF0000');
      expect(polygon.id).toBe('test-polygon');
      expect(polygon.label).toBe('Test Label');
      expect(polygon.metadata?.category).toBe('building');
    });

    it('handles invalid GeoJSON gracefully', () => {
      // Missing coordinates
      const invalidGeoJSON1 = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [],
        },
        properties: {},
      };

      expect(() => polygonFromGeoJSON(invalidGeoJSON1)).not.toThrow();
      const result1 = polygonFromGeoJSON(invalidGeoJSON1);
      expect(result1.points).toEqual([]);

      // Wrong geometry type
      const invalidGeoJSON2 = {
        type: 'Feature',
        geometry: {
          type: 'Point', // Not a Polygon
          coordinates: [0, 0],
        },
        properties: {},
      };

      expect(() => polygonFromGeoJSON(invalidGeoJSON2)).not.toThrow();
      const result2 = polygonFromGeoJSON(invalidGeoJSON2);
      expect(result2.points).toEqual([]);
    });
  });
});
