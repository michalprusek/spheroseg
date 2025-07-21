/**
 * Metrics Service Test Suite
 * 
 * Comprehensive tests for polygon metrics calculations including
 * area, perimeter, circularity, convex hull, and geometric properties.
 */

import {
  calculateConvexHullArea,
  calculateEquivalentDiameter,
  calculateCircularity,
  calculateAspectRatio,
  calculateSolidity,
  calculateExtent,
  calculateCompactness,
  calculateRoundness,
  calculateElongation,
  calculateFeret,
  calculateMoments,
  calculateCentroid,
  calculateOrientation,
  calculateEllipseFit,
  calculateHuMoments,
  getAllMetrics,
} from '../metricsService';
import { Point } from '../../types/geometry';

// Mock shared utilities
jest.mock('@spheroseg/shared', () => ({
  calculatePolygonArea: jest.fn(),
  calculatePolygonPerimeter: jest.fn(),
  calculateBoundingBoxRect: jest.fn(),
  calculateConvexHull: jest.fn(),
  calculateMetrics: jest.fn(),
}));

// Import mocked functions
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculateBoundingBoxRect,
  calculateConvexHull,
  calculateMetrics,
} from '@spheroseg/shared';

const mockedCalculatePolygonArea = calculatePolygonArea as jest.MockedFunction<typeof calculatePolygonArea>;
const mockedCalculatePolygonPerimeter = calculatePolygonPerimeter as jest.MockedFunction<typeof calculatePolygonPerimeter>;
const mockedCalculateBoundingBoxRect = calculateBoundingBoxRect as jest.MockedFunction<typeof calculateBoundingBoxRect>;
const mockedCalculateConvexHull = calculateConvexHull as jest.MockedFunction<typeof calculateConvexHull>;
const mockedCalculateMetrics = calculateMetrics as jest.MockedFunction<typeof calculateMetrics>;

describe('Metrics Service', () => {
  // Test data fixtures
  const circlePoints: Point[] = [
    { x: 1, y: 0 },
    { x: 0.707, y: 0.707 },
    { x: 0, y: 1 },
    { x: -0.707, y: 0.707 },
    { x: -1, y: 0 },
    { x: -0.707, y: -0.707 },
    { x: 0, y: -1 },
    { x: 0.707, y: -0.707 },
  ];

  const squarePoints: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  const rectanglePoints: Point[] = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 10 },
    { x: 0, y: 10 },
  ];

  const trianglePoints: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 8.66 },
  ];

  const irregularPoints: Point[] = [
    { x: 0, y: 0 },
    { x: 5, y: 2 },
    { x: 8, y: 7 },
    { x: 3, y: 9 },
    { x: -2, y: 5 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateConvexHullArea', () => {
    it('should calculate convex hull area correctly', () => {
      const mockHullPoints = [
        { x: 0, y: 0 },
        { x: 8, y: 7 },
        { x: 3, y: 9 },
        { x: -2, y: 5 },
      ];
      
      mockedCalculateConvexHull.mockReturnValue(mockHullPoints);
      mockedCalculatePolygonArea.mockReturnValue(50.5);

      const result = calculateConvexHullArea(irregularPoints);

      expect(mockedCalculateConvexHull).toHaveBeenCalledWith(irregularPoints);
      expect(mockedCalculatePolygonArea).toHaveBeenCalledWith(mockHullPoints);
      expect(result).toBe(50.5);
    });

    it('should handle empty points array', () => {
      mockedCalculateConvexHull.mockReturnValue([]);
      mockedCalculatePolygonArea.mockReturnValue(0);

      const result = calculateConvexHullArea([]);

      expect(result).toBe(0);
    });

    it('should handle single point', () => {
      const singlePoint = [{ x: 5, y: 5 }];
      mockedCalculateConvexHull.mockReturnValue(singlePoint);
      mockedCalculatePolygonArea.mockReturnValue(0);

      const result = calculateConvexHullArea(singlePoint);

      expect(result).toBe(0);
    });
  });

  describe('calculateEquivalentDiameter', () => {
    it('should calculate equivalent diameter for circle area', () => {
      const circleArea = Math.PI * 5 * 5; // radius = 5
      const expectedDiameter = 10;

      const result = calculateEquivalentDiameter(circleArea);

      expect(result).toBeCloseTo(expectedDiameter, 6);
    });

    it('should calculate equivalent diameter for square area', () => {
      const squareArea = 100; // 10x10 square
      const expectedDiameter = 2 * Math.sqrt(100 / Math.PI);

      const result = calculateEquivalentDiameter(squareArea);

      expect(result).toBeCloseTo(expectedDiameter, 6);
    });

    it('should handle zero area', () => {
      const result = calculateEquivalentDiameter(0);
      expect(result).toBe(0);
    });

    it('should handle very small areas', () => {
      const result = calculateEquivalentDiameter(0.001);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should handle very large areas', () => {
      const result = calculateEquivalentDiameter(1000000);
      expect(result).toBeGreaterThan(1000);
    });
  });

  describe('calculateCircularity', () => {
    it('should return 1 for perfect circle', () => {
      const radius = 5;
      const area = Math.PI * radius * radius;
      const perimeter = 2 * Math.PI * radius;

      const result = calculateCircularity(area, perimeter);

      expect(result).toBeCloseTo(1, 6);
    });

    it('should return value less than 1 for square', () => {
      const side = 10;
      const area = side * side;
      const perimeter = 4 * side;

      const result = calculateCircularity(area, perimeter);

      expect(result).toBeLessThan(1);
      expect(result).toBeCloseTo(0.785, 3); // π/4
    });

    it('should return value less than 1 for rectangle', () => {
      const width = 20;
      const height = 10;
      const area = width * height;
      const perimeter = 2 * (width + height);

      const result = calculateCircularity(area, perimeter);

      expect(result).toBeLessThan(1);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle zero perimeter', () => {
      const result = calculateCircularity(100, 0);
      expect(result).toBe(0);
    });

    it('should handle zero area', () => {
      const result = calculateCircularity(0, 20);
      expect(result).toBe(0);
    });

    it('should handle negative values gracefully', () => {
      const result = calculateCircularity(-10, 20);
      expect(result).toBeLessThan(0);
    });
  });

  describe('calculateAspectRatio', () => {
    it('should calculate aspect ratio correctly', () => {
      const boundingBox = { x: 0, y: 0, width: 20, height: 10 };
      mockedCalculateBoundingBoxRect.mockReturnValue(boundingBox);

      const result = calculateAspectRatio(rectanglePoints);

      expect(mockedCalculateBoundingBoxRect).toHaveBeenCalledWith(rectanglePoints);
      expect(result).toBe(2); // 20/10
    });

    it('should return 1 for square', () => {
      const boundingBox = { x: 0, y: 0, width: 10, height: 10 };
      mockedCalculateBoundingBoxRect.mockReturnValue(boundingBox);

      const result = calculateAspectRatio(squarePoints);

      expect(result).toBe(1);
    });

    it('should handle zero height', () => {
      const boundingBox = { x: 0, y: 0, width: 10, height: 0 };
      mockedCalculateBoundingBoxRect.mockReturnValue(boundingBox);

      const result = calculateAspectRatio([{ x: 0, y: 0 }, { x: 10, y: 0 }]);

      expect(result).toBe(Infinity);
    });

    it('should handle zero width', () => {
      const boundingBox = { x: 0, y: 0, width: 0, height: 10 };
      mockedCalculateBoundingBoxRect.mockReturnValue(boundingBox);

      const result = calculateAspectRatio([{ x: 0, y: 0 }, { x: 0, y: 10 }]);

      expect(result).toBe(0);
    });
  });

  describe('calculateSolidity', () => {
    it('should calculate solidity correctly', () => {
      const polygonArea = 80;
      const hullArea = 100;
      
      mockedCalculatePolygonArea.mockReturnValueOnce(polygonArea); // original polygon
      mockedCalculateConvexHull.mockReturnValue(irregularPoints);
      mockedCalculatePolygonArea.mockReturnValueOnce(hullArea); // convex hull

      const result = calculateSolidity(irregularPoints);

      expect(result).toBe(0.8); // 80/100
    });

    it('should return 1 for convex polygon', () => {
      const area = 50;
      
      mockedCalculatePolygonArea.mockReturnValue(area); // same for both calls
      mockedCalculateConvexHull.mockReturnValue(trianglePoints);

      const result = calculateSolidity(trianglePoints);

      expect(result).toBe(1);
    });

    it('should handle zero convex hull area', () => {
      mockedCalculatePolygonArea.mockReturnValueOnce(50); // original polygon
      mockedCalculateConvexHull.mockReturnValue([]);
      mockedCalculatePolygonArea.mockReturnValueOnce(0); // convex hull

      const result = calculateSolidity(irregularPoints);

      expect(result).toBe(0);
    });
  });

  describe('calculateExtent', () => {
    it('should calculate extent correctly', () => {
      const polygonArea = 80;
      const boundingBoxArea = 200; // 20 * 10
      
      mockedCalculatePolygonArea.mockReturnValue(polygonArea);
      mockedCalculateBoundingBoxRect.mockReturnValue({ x: 0, y: 0, width: 20, height: 10 });

      const result = calculateExtent(rectanglePoints);

      expect(result).toBe(0.4); // 80/200
    });

    it('should return 1 for rectangle fitting bounding box exactly', () => {
      const area = 200;
      
      mockedCalculatePolygonArea.mockReturnValue(area);
      mockedCalculateBoundingBoxRect.mockReturnValue({ x: 0, y: 0, width: 20, height: 10 });

      const result = calculateExtent(rectanglePoints);

      expect(result).toBe(1);
    });

    it('should handle zero bounding box area', () => {
      mockedCalculatePolygonArea.mockReturnValue(50);
      mockedCalculateBoundingBoxRect.mockReturnValue({ x: 0, y: 0, width: 0, height: 10 });

      const result = calculateExtent(irregularPoints);

      expect(result).toBe(0);
    });
  });

  describe('calculateCompactness', () => {
    it('should calculate compactness correctly', () => {
      const area = 100;
      const perimeter = 40;
      
      mockedCalculatePolygonArea.mockReturnValue(area);
      mockedCalculatePolygonPerimeter.mockReturnValue(perimeter);

      const result = calculateCompactness(squarePoints);

      expect(result).toBeCloseTo(area / (perimeter * perimeter), 6);
    });

    it('should handle zero perimeter', () => {
      mockedCalculatePolygonArea.mockReturnValue(100);
      mockedCalculatePolygonPerimeter.mockReturnValue(0);

      const result = calculateCompactness(squarePoints);

      expect(result).toBe(0);
    });

    it('should be higher for more compact shapes', () => {
      // Circle should be more compact than rectangle
      mockedCalculatePolygonArea.mockReturnValueOnce(Math.PI * 25); // circle r=5
      mockedCalculatePolygonPerimeter.mockReturnValueOnce(Math.PI * 10);
      const circleCompactness = calculateCompactness(circlePoints);

      mockedCalculatePolygonArea.mockReturnValueOnce(200); // rectangle 20x10
      mockedCalculatePolygonPerimeter.mockReturnValueOnce(60);
      const rectangleCompactness = calculateCompactness(rectanglePoints);

      expect(circleCompactness).toBeGreaterThan(rectangleCompactness);
    });
  });

  describe('calculateRoundness', () => {
    it('should calculate roundness correctly', () => {
      const area = 100;
      const maxRadius = 10;
      const minRadius = 8;
      
      mockedCalculatePolygonArea.mockReturnValue(area);
      // Mock equivalent radius calculation indirectly
      const expectedRoundness = (4 * area) / (Math.PI * maxRadius * maxRadius);

      const result = calculateRoundness(circlePoints, maxRadius, minRadius);

      expect(result).toBeCloseTo(expectedRoundness, 6);
    });

    it('should return 1 for perfect circle', () => {
      const radius = 5;
      const area = Math.PI * radius * radius;
      
      mockedCalculatePolygonArea.mockReturnValue(area);

      const result = calculateRoundness(circlePoints, radius, radius);

      expect(result).toBeCloseTo(1, 6);
    });

    it('should handle zero max radius', () => {
      mockedCalculatePolygonArea.mockReturnValue(100);

      const result = calculateRoundness(circlePoints, 0, 5);

      expect(result).toBe(0);
    });
  });

  describe('calculateElongation', () => {
    it('should calculate elongation correctly', () => {
      const boundingBox = { x: 0, y: 0, width: 20, height: 10 };
      mockedCalculateBoundingBoxRect.mockReturnValue(boundingBox);

      const result = calculateElongation(rectanglePoints);

      expect(result).toBe(0.5); // 1 - 10/20
    });

    it('should return 0 for square (no elongation)', () => {
      const boundingBox = { x: 0, y: 0, width: 10, height: 10 };
      mockedCalculateBoundingBoxRect.mockReturnValue(boundingBox);

      const result = calculateElongation(squarePoints);

      expect(result).toBe(0);
    });

    it('should handle zero width', () => {
      const boundingBox = { x: 0, y: 0, width: 0, height: 10 };
      mockedCalculateBoundingBoxRect.mockReturnValue(boundingBox);

      const result = calculateElongation([{ x: 0, y: 0 }, { x: 0, y: 10 }]);

      expect(result).toBe(1); // 1 - 0/10 = 1
    });
  });

  describe('calculateFeret', () => {
    it('should calculate Feret diameters correctly', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 0, y: 5 },
      ];

      const result = calculateFeret(points);

      expect(result).toHaveProperty('maxFeret');
      expect(result).toHaveProperty('minFeret');
      expect(result).toHaveProperty('meanFeret');
      expect(result.maxFeret).toBeGreaterThanOrEqual(result.minFeret);
      expect(result.meanFeret).toBeGreaterThanOrEqual(result.minFeret);
      expect(result.meanFeret).toBeLessThanOrEqual(result.maxFeret);
    });

    it('should handle triangle correctly', () => {
      const result = calculateFeret(trianglePoints);

      expect(result.maxFeret).toBeGreaterThan(0);
      expect(result.minFeret).toBeGreaterThan(0);
      expect(result.meanFeret).toBeGreaterThan(0);
    });

    it('should handle single point', () => {
      const result = calculateFeret([{ x: 5, y: 5 }]);

      expect(result.maxFeret).toBe(0);
      expect(result.minFeret).toBe(0);
      expect(result.meanFeret).toBe(0);
    });

    it('should handle empty array', () => {
      const result = calculateFeret([]);

      expect(result.maxFeret).toBe(0);
      expect(result.minFeret).toBe(0);
      expect(result.meanFeret).toBe(0);
    });
  });

  describe('calculateMoments', () => {
    it('should calculate geometric moments correctly', () => {
      const result = calculateMoments(squarePoints);

      expect(result).toHaveProperty('m00'); // Area moment
      expect(result).toHaveProperty('m10'); // X moment
      expect(result).toHaveProperty('m01'); // Y moment
      expect(result).toHaveProperty('m20'); // XX moment
      expect(result).toHaveProperty('m11'); // XY moment
      expect(result).toHaveProperty('m02'); // YY moment
      expect(result.m00).toBeGreaterThan(0); // Area should be positive
    });

    it('should calculate central moments correctly', () => {
      const result = calculateMoments(rectanglePoints);

      expect(result).toHaveProperty('mu20'); // Central XX moment
      expect(result).toHaveProperty('mu11'); // Central XY moment
      expect(result).toHaveProperty('mu02'); // Central YY moment
      expect(result).toHaveProperty('mu30'); // Central XXX moment
      expect(result).toHaveProperty('mu21'); // Central XXY moment
      expect(result).toHaveProperty('mu12'); // Central XYY moment
      expect(result).toHaveProperty('mu03'); // Central YYY moment
    });

    it('should calculate normalized central moments', () => {
      const result = calculateMoments(trianglePoints);

      expect(result).toHaveProperty('nu20'); // Normalized central moments
      expect(result).toHaveProperty('nu11');
      expect(result).toHaveProperty('nu02');
      expect(result).toHaveProperty('nu30');
      expect(result).toHaveProperty('nu21');
      expect(result).toHaveProperty('nu12');
      expect(result).toHaveProperty('nu03');
    });

    it('should handle empty polygon', () => {
      const result = calculateMoments([]);

      Object.values(result).forEach(value => {
        expect(value).toBe(0);
      });
    });
  });

  describe('calculateCentroid', () => {
    it('should calculate centroid correctly for square', () => {
      const result = calculateCentroid(squarePoints);

      expect(result.x).toBeCloseTo(5, 6); // Center of 10x10 square
      expect(result.y).toBeCloseTo(5, 6);
    });

    it('should calculate centroid correctly for rectangle', () => {
      const result = calculateCentroid(rectanglePoints);

      expect(result.x).toBeCloseTo(10, 6); // Center of 20x10 rectangle
      expect(result.y).toBeCloseTo(5, 6);
    });

    it('should calculate centroid correctly for triangle', () => {
      const result = calculateCentroid(trianglePoints);

      expect(result.x).toBeCloseTo(5, 1); // Centroid of triangle
      expect(result.y).toBeCloseTo(2.89, 1);
    });

    it('should handle single point', () => {
      const singlePoint = [{ x: 7, y: 3 }];
      const result = calculateCentroid(singlePoint);

      expect(result.x).toBe(7);
      expect(result.y).toBe(3);
    });

    it('should handle empty array', () => {
      const result = calculateCentroid([]);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('calculateOrientation', () => {
    it('should calculate orientation correctly', () => {
      const result = calculateOrientation(rectanglePoints);

      expect(result).toBeGreaterThanOrEqual(-Math.PI);
      expect(result).toBeLessThanOrEqual(Math.PI);
    });

    it('should return 0 for horizontally aligned rectangle', () => {
      const horizontalRect = [
        { x: 0, y: 5 },
        { x: 20, y: 5 },
        { x: 20, y: 15 },
        { x: 0, y: 15 },
      ];

      const result = calculateOrientation(horizontalRect);

      expect(Math.abs(result)).toBeLessThan(0.1); // Close to 0
    });

    it('should handle square (no preferred orientation)', () => {
      const result = calculateOrientation(squarePoints);

      expect(result).toBeGreaterThanOrEqual(-Math.PI);
      expect(result).toBeLessThanOrEqual(Math.PI);
    });
  });

  describe('calculateEllipseFit', () => {
    it('should calculate ellipse fit parameters', () => {
      const result = calculateEllipseFit(circlePoints);

      expect(result).toHaveProperty('majorAxis');
      expect(result).toHaveProperty('minorAxis');
      expect(result).toHaveProperty('angle');
      expect(result).toHaveProperty('center');
      expect(result.majorAxis).toBeGreaterThanOrEqual(result.minorAxis);
      expect(result.center).toHaveProperty('x');
      expect(result.center).toHaveProperty('y');
    });

    it('should handle circle (equal axes)', () => {
      const result = calculateEllipseFit(circlePoints);

      expect(result.majorAxis).toBeCloseTo(result.minorAxis, 1);
    });

    it('should handle rectangle', () => {
      const result = calculateEllipseFit(rectanglePoints);

      expect(result.majorAxis).toBeGreaterThan(result.minorAxis);
    });

    it('should handle insufficient points', () => {
      const result = calculateEllipseFit([{ x: 0, y: 0 }, { x: 1, y: 1 }]);

      expect(result.majorAxis).toBe(0);
      expect(result.minorAxis).toBe(0);
    });
  });

  describe('calculateHuMoments', () => {
    it('should calculate 7 Hu invariant moments', () => {
      const result = calculateHuMoments(squarePoints);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(7);
      result.forEach(moment => {
        expect(typeof moment).toBe('number');
        expect(isFinite(moment)).toBe(true);
      });
    });

    it('should be translation invariant', () => {
      const translatedSquare = squarePoints.map(p => ({ x: p.x + 100, y: p.y + 50 }));
      
      const original = calculateHuMoments(squarePoints);
      const translated = calculateHuMoments(translatedSquare);

      for (let i = 0; i < 7; i++) {
        expect(original[i]).toBeCloseTo(translated[i], 6);
      }
    });

    it('should be scale invariant', () => {
      const scaledSquare = squarePoints.map(p => ({ x: p.x * 2, y: p.y * 2 }));
      
      const original = calculateHuMoments(squarePoints);
      const scaled = calculateHuMoments(scaledSquare);

      // First moment should be scale invariant
      expect(original[0]).toBeCloseTo(scaled[0], 6);
    });

    it('should handle empty polygon', () => {
      const result = calculateHuMoments([]);

      expect(result).toHaveLength(7);
      result.forEach(moment => {
        expect(moment).toBe(0);
      });
    });
  });

  describe('getAllMetrics', () => {
    beforeEach(() => {
      // Setup default mocks for comprehensive test
      mockedCalculatePolygonArea.mockReturnValue(100);
      mockedCalculatePolygonPerimeter.mockReturnValue(40);
      mockedCalculateBoundingBoxRect.mockReturnValue({ x: 0, y: 0, width: 10, height: 10 });
      mockedCalculateConvexHull.mockReturnValue(squarePoints);
      mockedCalculateMetrics.mockReturnValue({
        area: 100,
        perimeter: 40,
        centroid: { x: 5, y: 5 },
        boundingBox: { x: 0, y: 0, width: 10, height: 10 },
      });
    });

    it('should calculate all metrics comprehensively', () => {
      const result = getAllMetrics(squarePoints);

      // Basic metrics
      expect(result).toHaveProperty('area');
      expect(result).toHaveProperty('perimeter');
      expect(result).toHaveProperty('centroid');
      expect(result).toHaveProperty('boundingBox');

      // Derived metrics
      expect(result).toHaveProperty('circularity');
      expect(result).toHaveProperty('aspectRatio');
      expect(result).toHaveProperty('solidity');
      expect(result).toHaveProperty('extent');
      expect(result).toHaveProperty('compactness');
      expect(result).toHaveProperty('roundness');
      expect(result).toHaveProperty('elongation');
      expect(result).toHaveProperty('equivalentDiameter');

      // Complex metrics
      expect(result).toHaveProperty('feret');
      expect(result).toHaveProperty('moments');
      expect(result).toHaveProperty('orientation');
      expect(result).toHaveProperty('ellipseFit');
      expect(result).toHaveProperty('huMoments');
    });

    it('should include convex hull area', () => {
      const result = getAllMetrics(squarePoints);

      expect(result).toHaveProperty('convexHullArea');
      expect(result.convexHullArea).toBe(100); // Mocked value
    });

    it('should calculate Feret diameters', () => {
      const result = getAllMetrics(rectanglePoints);

      expect(result.feret).toHaveProperty('maxFeret');
      expect(result.feret).toHaveProperty('minFeret');
      expect(result.feret).toHaveProperty('meanFeret');
    });

    it('should calculate moments and Hu moments', () => {
      const result = getAllMetrics(trianglePoints);

      expect(result.moments).toHaveProperty('m00');
      expect(result.moments).toHaveProperty('mu20');
      expect(result.moments).toHaveProperty('nu20');
      expect(Array.isArray(result.huMoments)).toBe(true);
      expect(result.huMoments).toHaveLength(7);
    });

    it('should calculate ellipse fit parameters', () => {
      const result = getAllMetrics(circlePoints);

      expect(result.ellipseFit).toHaveProperty('majorAxis');
      expect(result.ellipseFit).toHaveProperty('minorAxis');
      expect(result.ellipseFit).toHaveProperty('angle');
      expect(result.ellipseFit).toHaveProperty('center');
    });

    it('should handle edge cases gracefully', () => {
      mockedCalculatePolygonArea.mockReturnValue(0);
      mockedCalculatePolygonPerimeter.mockReturnValue(0);
      mockedCalculateBoundingBoxRect.mockReturnValue({ x: 0, y: 0, width: 0, height: 0 });

      const result = getAllMetrics([]);

      expect(result.area).toBe(0);
      expect(result.perimeter).toBe(0);
      expect(result.circularity).toBe(0);
      expect(result.aspectRatio).toBe(0);
    });

    it('should validate all numeric metrics are finite', () => {
      const result = getAllMetrics(squarePoints);

      const numericKeys = [
        'area', 'perimeter', 'circularity', 'aspectRatio', 'solidity',
        'extent', 'compactness', 'roundness', 'elongation', 'equivalentDiameter',
        'convexHullArea', 'orientation'
      ];

      numericKeys.forEach(key => {
        expect(typeof result[key]).toBe('number');
        expect(isFinite(result[key])).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle degenerate polygons', () => {
      const degeneratePolygon = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ];

      mockedCalculatePolygonArea.mockReturnValue(0);
      mockedCalculatePolygonPerimeter.mockReturnValue(0);

      expect(() => {
        calculateCircularity(0, 0);
        calculateEquivalentDiameter(0);
        calculateCentroid(degeneratePolygon);
      }).not.toThrow();
    });

    it('should handle very large coordinates', () => {
      const largePolygon = [
        { x: 1e6, y: 1e6 },
        { x: 2e6, y: 1e6 },
        { x: 2e6, y: 2e6 },
        { x: 1e6, y: 2e6 },
      ];

      mockedCalculatePolygonArea.mockReturnValue(1e12);
      mockedCalculatePolygonPerimeter.mockReturnValue(4e6);

      const result = calculateCircularity(1e12, 4e6);
      expect(isFinite(result)).toBe(true);
    });

    it('should handle very small coordinates', () => {
      const smallPolygon = [
        { x: 1e-6, y: 1e-6 },
        { x: 2e-6, y: 1e-6 },
        { x: 2e-6, y: 2e-6 },
        { x: 1e-6, y: 2e-6 },
      ];

      mockedCalculatePolygonArea.mockReturnValue(1e-12);
      mockedCalculatePolygonPerimeter.mockReturnValue(4e-6);

      const result = calculateCircularity(1e-12, 4e-6);
      expect(isFinite(result)).toBe(true);
    });

    it('should handle precision edge cases', () => {
      const precisionTest = calculateEquivalentDiameter(Number.MIN_VALUE);
      expect(isFinite(precisionTest)).toBe(true);
      expect(precisionTest).toBeGreaterThan(0);
    });
  });
});