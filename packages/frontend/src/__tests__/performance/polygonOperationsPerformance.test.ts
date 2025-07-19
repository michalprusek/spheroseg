/**
 * Performance tests for critical polygon operations
 *
 * Tests the performance of operations on polygon data including:
 * - Polygon simplification
 * - Point-in-polygon checks
 * - Polygon slicing
 * - Area calculations
 * - Path rendering
 * - Polygon merging and splitting
 */

import { describe, test, expect } from 'vitest';
import {
  measurePerformance,
  generateTestPolygon,
  generateRandomPolygons,
  runScalabilityTest,
} from './performanceTestingFramework';
import { calculateMetrics } from '@/pages/segmentation/utils/metricCalculations';
import { Polygon, Point } from '@/pages/segmentation/types';

// Import polygon utility functions to test
import {
  isPointInPolygon,
  slicePolygonObject as slicePolygon,
  simplifyPolygon,
} from '@spheroseg/shared';

// Define performance test thresholds
const PERFORMANCE_THRESHOLDS = {
  POINT_IN_POLYGON: {
    SIMPLE: 10, // ms for 1000 checks
    COMPLEX: 50, // ms for 1000 checks
  },
  POLYGON_SLICING: {
    SIMPLE: 50, // ms for a simple polygon
    COMPLEX: 200, // ms for a complex polygon
  },
  METRICS_CALCULATION: {
    SIMPLE: 50, // ms for 10 simple polygons
    COMPLEX: 200, // ms for 10 complex polygons
  },
  PATH_GENERATION: {
    SIMPLE: 20, // ms for 100 polygons
    COMPLEX: 100, // ms for 100 complex polygons
  },
  POLYGON_SIMPLIFICATION: {
    LARGE: 200, // ms for a large polygon
  },
};

describe('Polygon Operations Performance Tests', () => {
  // Helper to check if runtime is within acceptable limits
  function checkPerformance(actual: number, threshold: number, operation: string): void {
    expect(actual).toBeLessThanOrEqual(
      threshold,
      `${operation} exceeded performance threshold (${actual.toFixed(2)}ms > ${threshold}ms)`,
    );
  }

  test('point-in-polygon check performance', async () => {
    // Generate a simple polygon with 10 points
    const simplePolygon = generateTestPolygon(10);
    const points: Point[] = [];

    // Generate 1000 random test points
    for (let i = 0; i < 1000; i++) {
      points.push({
        x: Math.random() * 1000,
        y: Math.random() * 1000,
      });
    }

    const result = await measurePerformance(
      'Point-in-polygon check (1000 points, simple polygon)',
      (_, _iteration) => {
        // Run the check on all points
        for (const point of points) {
          isPointInPolygon(point, simplePolygon.points);
        }
      },
      { iterations: 5, warmupIterations: 1 },
    );

    // Check if performance is within acceptable limits
    checkPerformance(
      result.averageDuration || 0,
      PERFORMANCE_THRESHOLDS.POINT_IN_POLYGON.SIMPLE,
      'Point-in-polygon check (simple)',
    );

    // Test with a complex polygon (100 points)
    const complexPolygon = generateTestPolygon(100);

    const complexResult = await measurePerformance(
      'Point-in-polygon check (1000 points, complex polygon)',
      (_, _iteration) => {
        for (const point of points) {
          isPointInPolygon(point, complexPolygon.points);
        }
      },
      { iterations: 5, warmupIterations: 1 },
    );

    checkPerformance(
      complexResult.averageDuration || 0,
      PERFORMANCE_THRESHOLDS.POINT_IN_POLYGON.COMPLEX,
      'Point-in-polygon check (complex)',
    );
  });

  test('polygon slicing performance', async () => {
    // Test simple slicing
    const polygon = generateTestPolygon(20);

    // Define a slice line
    const sliceStart: Point = { x: 0, y: 500 };
    const sliceEnd: Point = { x: 1000, y: 500 };

    const result = await measurePerformance(
      'Polygon slicing (simple)',
      (_, _iteration) => {
        slicePolygon(polygon, sliceStart, sliceEnd);
      },
      { iterations: 10, warmupIterations: 2 },
    );

    checkPerformance(
      result.averageDuration || 0,
      PERFORMANCE_THRESHOLDS.POLYGON_SLICING.SIMPLE,
      'Polygon slicing (simple)',
    );

    // Test complex slicing with a 100-point polygon
    const complexPolygon = generateTestPolygon(100);

    const complexResult = await measurePerformance(
      'Polygon slicing (complex)',
      (_, _iteration) => {
        slicePolygon(complexPolygon, sliceStart, sliceEnd);
      },
      { iterations: 5, warmupIterations: 2 },
    );

    checkPerformance(
      complexResult.averageDuration || 0,
      PERFORMANCE_THRESHOLDS.POLYGON_SLICING.COMPLEX,
      'Polygon slicing (complex)',
    );
  });

  test('metrics calculation performance', async () => {
    // Calculate metrics for simple polygons
    const simplePolygons = generateRandomPolygons(10, 10);

    const result = await measurePerformance(
      'Metrics calculation (10 simple polygons)',
      (_, _iteration) => {
        for (const polygon of simplePolygons) {
          calculateMetrics(polygon);
        }
      },
      { iterations: 5, warmupIterations: 1 },
    );

    checkPerformance(
      result.averageDuration || 0,
      PERFORMANCE_THRESHOLDS.METRICS_CALCULATION.SIMPLE,
      'Metrics calculation (simple)',
    );

    // Calculate metrics for complex polygons
    const complexPolygons = generateRandomPolygons(10, 50);

    const complexResult = await measurePerformance(
      'Metrics calculation (10 complex polygons)',
      (_, _iteration) => {
        for (const polygon of complexPolygons) {
          calculateMetrics(polygon);
        }
      },
      { iterations: 5, warmupIterations: 1 },
    );

    checkPerformance(
      complexResult.averageDuration || 0,
      PERFORMANCE_THRESHOLDS.METRICS_CALCULATION.COMPLEX,
      'Metrics calculation (complex)',
    );
  });

  // Path generation tests removed - createPolygonPath is not available in shared utilities

  test('polygon simplification performance', async () => {
    // Generate a very large polygon for simplification
    const largePolygon = generateTestPolygon(1000);

    const result = await measurePerformance(
      'Polygon simplification (1000-point polygon)',
      (_, _iteration) => {
        simplifyPolygon(largePolygon.points, 0.5);
      },
      { iterations: 5, warmupIterations: 1 },
    );

    checkPerformance(
      result.averageDuration || 0,
      PERFORMANCE_THRESHOLDS.POLYGON_SIMPLIFICATION.LARGE,
      'Polygon simplification (large)',
    );
  });

  test('scaling test: point-in-polygon with increasing polygon complexity', async () => {
    const points: Point[] = [];

    // Generate test points
    for (let i = 0; i < 100; i++) {
      points.push({
        x: Math.random() * 1000,
        y: Math.random() * 1000,
      });
    }

    // Test with increasing polygon complexity
    const polygonSizes = [10, 25, 50, 100, 250, 500, 1000];

    await runScalabilityTest(
      'Point-in-polygon scaling with polygon complexity',
      (dataSize) => {
        const polygon = generateTestPolygon(dataSize);
        for (const point of points) {
          isPointInPolygon(point, polygon.points);
        }
      },
      polygonSizes,
      { iterations: 5, warmupIterations: 1 },
    );
  });

  test('scaling test: metrics calculation with increasing polygon count', async () => {
    // Test with increasing numbers of polygons
    const polygonCounts = [1, 5, 10, 25, 50, 100];

    await runScalabilityTest(
      'Metrics calculation scaling with polygon count',
      (dataSize) => {
        const polygons = generateRandomPolygons(dataSize, 20);
        for (const polygon of polygons) {
          calculateMetrics(polygon);
        }
      },
      polygonCounts,
      { iterations: 3, warmupIterations: 1 },
    );
  });
});

// Test performance with real-world data
describe('Real-world polygon operation performance', () => {
  // Define some example real-world polygon data
  const cellPolygon: Polygon = {
    id: 'cell-boundary',
    type: 'external',
    points: [
      { x: 100, y: 100 },
      { x: 150, y: 80 },
      { x: 200, y: 90 },
      { x: 250, y: 110 },
      { x: 280, y: 150 },
      { x: 285, y: 200 },
      { x: 270, y: 250 },
      { x: 240, y: 280 },
      { x: 190, y: 290 },
      { x: 140, y: 280 },
      { x: 110, y: 250 },
      { x: 90, y: 200 },
      { x: 85, y: 150 },
    ],
  };

  const nucleusPolygon: Polygon = {
    id: 'nucleus',
    type: 'internal',
    points: [
      { x: 160, y: 150 },
      { x: 180, y: 140 },
      { x: 210, y: 150 },
      { x: 220, y: 180 },
      { x: 210, y: 210 },
      { x: 180, y: 220 },
      { x: 150, y: 210 },
      { x: 140, y: 180 },
    ],
  };

  test('cell metrics calculation performance', async () => {
    const result = await measurePerformance(
      'Cell metrics calculation (typical cell with nucleus)',
      () => {
        calculateMetrics(cellPolygon, [nucleusPolygon]);
      },
      { iterations: 100, warmupIterations: 5 },
    );

    // Metrics calculation for typical cell shapes should be very fast
    expect(result.averageDuration).toBeLessThan(5, 'Metrics calculation for typical cell data should be under 5ms');
  });

  test('complex cell segmentation performance', async () => {
    // Generate a complex cell-like polygon with many points
    const complexCellPoints: Point[] = [];

    // Create a complex cell boundary with 500 points
    for (let i = 0; i < 500; i++) {
      const angle = (i / 500) * 2 * Math.PI;
      // Add some noise to make it cell-like
      const radius = 200 + 50 * Math.sin(angle * 5) + 20 * Math.cos(angle * 12) + 10 * Math.sin(angle * 20);
      const x = 500 + radius * Math.cos(angle);
      const y = 500 + radius * Math.sin(angle);
      complexCellPoints.push({ x, y });
    }

    const complexCell: Polygon = {
      id: 'complex-cell',
      type: 'external',
      points: complexCellPoints,
    };

    // Test simplification on complex cell
    const simplificationResult = await measurePerformance(
      'Complex cell simplification (500 points)',
      () => {
        simplifyPolygon(complexCell.points, 1.5);
      },
      { iterations: 10, warmupIterations: 2 },
    );

    expect(simplificationResult.averageDuration).toBeLessThan(
      100,
      'Simplification of complex cell polygon should be under 100ms',
    );

    // Test slicing on complex cell
    const sliceStart: Point = { x: 0, y: 500 };
    const sliceEnd: Point = { x: 1000, y: 500 };

    const slicingResult = await measurePerformance(
      'Complex cell slicing (500 points)',
      () => {
        slicePolygon(complexCell, sliceStart, sliceEnd);
      },
      { iterations: 10, warmupIterations: 2 },
    );

    expect(slicingResult.averageDuration).toBeLessThan(150, 'Slicing of complex cell polygon should be under 150ms');
  });

  test('batch processing performance', async () => {
    // Simulate batch processing of multiple cells
    const cellCount = 100;
    const cells: Polygon[] = [];

    // Generate cell-like polygons
    for (let i = 0; i < cellCount; i++) {
      const centerX = Math.random() * 1000;
      const centerY = Math.random() * 1000;
      const points: Point[] = [];

      // Create a cell with 20-40 points
      const numPoints = Math.floor(Math.random() * 20) + 20;
      for (let j = 0; j < numPoints; j++) {
        const angle = (j / numPoints) * 2 * Math.PI;
        // Add some noise to make it cell-like
        const radius = 50 + 10 * Math.sin(angle * 5) + 5 * Math.cos(angle * 10);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        points.push({ x, y });
      }

      cells.push({
        id: `cell-${i}`,
        type: 'external',
        points,
      });
    }

    // Batch metrics calculation
    const batchMetricsResult = await measurePerformance(
      'Batch metrics calculation (100 cells)',
      () => {
        for (const cell of cells) {
          calculateMetrics(cell);
        }
      },
      { iterations: 5, warmupIterations: 1 },
    );

    expect(batchMetricsResult.averageDuration).toBeLessThan(
      500,
      'Batch metrics calculation for 100 cells should be under 500ms',
    );

    // Batch simplification
    const batchSimplificationResult = await measurePerformance(
      'Batch simplification (100 cells)',
      () => {
        for (const cell of cells) {
          simplifyPolygon(cell.points, 1.0);
        }
      },
      { iterations: 5, warmupIterations: 1 },
    );

    expect(batchSimplificationResult.averageDuration).toBeLessThan(
      1000,
      'Batch simplification for 100 cells should be under 1000ms',
    );
  });
});
