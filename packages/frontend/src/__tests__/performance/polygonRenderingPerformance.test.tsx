/**
 * Performance tests for polygon rendering and interaction
 *
 * Tests the performance of:
 * - Canvas rendering with multiple polygons
 * - Selection detection
 * - Polygon drawing operations
 * - Interactive operations (move, resize, edit points)
 */

import { describe, test, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { measurePerformance, generateRandomPolygons, runScalabilityTest } from './performanceTestingFramework';
import { Polygon, Point } from '@/pages/segmentation/types';

// Mock canvas for testing
class MockCanvasRenderingContext2D {
  canvas: HTMLCanvasElement;
  fillStyle: string = '#000000';
  strokeStyle: string = '#000000';
  lineWidth: number = 1;
  lineCap: string = 'butt';
  lineJoin: string = 'miter';
  miterLimit: number = 10;
  font: string = '10px sans-serif';
  textAlign: string = 'start';
  textBaseline: string = 'alphabetic';
  direction: string = 'ltr';
  imageSmoothingEnabled: boolean = true;

  // Performance tracking
  pathOperations: number = 0;
  drawOperations: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  beginPath(): void {
    this.pathOperations++;
  }

  closePath(): void {
    this.pathOperations++;
  }

  moveTo(x: number, y: number): void {
    this.pathOperations++;
  }

  lineTo(x: number, y: number): void {
    this.pathOperations++;
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.pathOperations++;
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.pathOperations++;
  }

  fill(): void {
    this.drawOperations++;
  }

  stroke(): void {
    this.drawOperations++;
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.drawOperations++;
  }

  isPointInPath(x: number, y: number): boolean {
    this.pathOperations++;
    return false;
  }

  // Other context methods (simplified for performance testing)
  save(): void {}
  restore(): void {}
  scale(): void {}
  rotate(): void {}
  translate(): void {}
  transform(): void {}
  setTransform(): void {}
  resetTransform(): void {}
  drawImage(): void {
    this.drawOperations++;
  }
  createLinearGradient(): any {
    return {};
  }
  createRadialGradient(): any {
    return {};
  }
  createPattern(): any {
    return {};
  }
  getImageData(): any {
    return { data: new Uint8ClampedArray(4) };
  }
  putImageData(): void {}
  measureText(): any {
    return { width: 10 };
  }

  // Reset counters
  resetCounters(): void {
    this.pathOperations = 0;
    this.drawOperations = 0;
  }

  // Get operation stats
  getStats(): { pathOperations: number; drawOperations: number } {
    return {
      pathOperations: this.pathOperations,
      drawOperations: this.drawOperations,
    };
  }
}

// Create a mock canvas element
function createMockCanvas(
  width: number = 1000,
  height: number = 1000,
): {
  canvas: HTMLCanvasElement;
  ctx: MockCanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = new MockCanvasRenderingContext2D(canvas);

  // Mock getContext method
  canvas.getContext = () => ctx;

  return { canvas, ctx };
}

// Simplified polygon rendering function
function renderPolygons(
  ctx: MockCanvasRenderingContext2D,
  polygons: Polygon[],
  fillStyle: string = 'rgba(0, 255, 0, 0.5)',
  strokeStyle: string = '#00ff00',
): void {
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;

  for (const polygon of polygons) {
    if (!polygon.points || polygon.points.length < 3) continue;

    ctx.beginPath();
    ctx.moveTo(polygon.points[0].x, polygon.points[0].y);

    for (let i = 1; i < polygon.points.length; i++) {
      ctx.lineTo(polygon.points[i].x, polygon.points[i].y);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// Simplified point rendering function
function renderPoints(
  ctx: MockCanvasRenderingContext2D,
  points: Point[],
  radius: number = 5,
  fillStyle: string = '#ff0000',
): void {
  ctx.fillStyle = fillStyle;

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// Simplified point detection function
function findPointAtPosition(points: Point[], x: number, y: number, radius: number = 10): number {
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));

    if (distance <= radius) {
      return i;
    }
  }

  return -1;
}

// Simplified polygon detection function
function findPolygonAtPosition(polygons: Polygon[], x: number, y: number): number {
  // Simple hit testing algorithm (not efficient but good for testing)
  for (let i = 0; i < polygons.length; i++) {
    const polygon = polygons[i];

    if (isPointInPolygon({ x, y }, polygon.points)) {
      return i;
    }
  }

  return -1;
}

// Simple point-in-polygon test (ray casting algorithm)
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const { x, y } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

describe('Polygon Rendering Performance Tests', () => {
  test('polygon rendering performance', async () => {
    const { ctx } = createMockCanvas();

    // Test with different numbers of polygons
    const polygonCounts = [10, 50, 100, 500, 1000];

    for (const count of polygonCounts) {
      const polygons = generateRandomPolygons(count, 20);

      const result = await measurePerformance(
        `Rendering ${count} polygons`,
        () => {
          ctx.resetCounters();
          renderPolygons(ctx, polygons);
          return ctx.getStats();
        },
        { iterations: 5, warmupIterations: 1 },
      );

      // Log operations counts
      const stats = await renderPolygons(ctx, polygons);
      console.log(`Rendering ${count} polygons:`);
      console.log(`- Path operations: ${(result.metadata as any).pathOperations}`);
      console.log(`- Draw operations: ${(result.metadata as any).drawOperations}`);

      // Verify expected operation counts based on polygon count
      // Each polygon should have: 1 beginPath, 1 moveTo, n-1 lineTo, 1 closePath, 1 fill, 1 stroke
      // Total path operations: 3 + points.length per polygon
      // Total draw operations: 2 per polygon
      expect((result.metadata as any).pathOperations).toBeGreaterThanOrEqual(count * 3);
      expect((result.metadata as any).drawOperations).toBeGreaterThanOrEqual(count * 2);
    }
  });

  test('point detection performance', async () => {
    // Generate random points
    const points: Point[] = [];
    for (let i = 0; i < 1000; i++) {
      points.push({
        x: Math.random() * 1000,
        y: Math.random() * 1000,
      });
    }

    // Generate random test positions
    const testPositions: Point[] = [];
    for (let i = 0; i < 100; i++) {
      testPositions.push({
        x: Math.random() * 1000,
        y: Math.random() * 1000,
      });
    }

    // Test point detection with increasing numbers of points
    const pointCounts = [10, 50, 100, 500, 1000];

    for (const count of pointCounts) {
      const testPoints = points.slice(0, count);

      const result = await measurePerformance(
        `Point detection with ${count} points (100 tests)`,
        () => {
          for (const position of testPositions) {
            findPointAtPosition(testPoints, position.x, position.y);
          }
        },
        { iterations: 10, warmupIterations: 1 },
      );

      // Verify performance is reasonable
      // For 1000 points, detecting 100 points should take less than 100ms
      expect(result.averageDuration).toBeLessThan(100);
    }
  });

  test('polygon detection performance', async () => {
    // Generate random polygons
    const polygonCounts = [10, 50, 100, 500];

    // Generate random test positions
    const testPositions: Point[] = [];
    for (let i = 0; i < 100; i++) {
      testPositions.push({
        x: Math.random() * 1000,
        y: Math.random() * 1000,
      });
    }

    for (const count of polygonCounts) {
      const polygons = generateRandomPolygons(count, 10);

      const result = await measurePerformance(
        `Polygon detection with ${count} polygons (100 tests)`,
        () => {
          for (const position of testPositions) {
            findPolygonAtPosition(polygons, position.x, position.y);
          }
        },
        { iterations: 5, warmupIterations: 1 },
      );

      // Verify performance is reasonable
      // For 500 polygons, detecting 100 positions should take less than 500ms
      expect(result.averageDuration).toBeLessThan(500);
    }
  });

  test('polygon rendering with different point counts', async () => {
    const { ctx } = createMockCanvas();

    // Test with different numbers of points per polygon
    const pointCounts = [10, 50, 100, 500, 1000];

    for (const count of pointCounts) {
      // Generate a single complex polygon with many points
      const polygon = generateRandomPolygons(1, count)[0];

      const result = await measurePerformance(
        `Rendering polygon with ${count} points`,
        () => {
          ctx.resetCounters();
          renderPolygons(ctx, [polygon]);
          return ctx.getStats();
        },
        { iterations: 10, warmupIterations: 1 },
      );

      // Log operations counts
      console.log(`Rendering polygon with ${count} points:`);
      console.log(`- Path operations: ${(result.metadata as any).pathOperations}`);
      console.log(`- Draw operations: ${(result.metadata as any).drawOperations}`);

      // Verify expected operation counts
      // Each polygon should have: 1 beginPath, 1 moveTo, n-1 lineTo, 1 closePath, 1 fill, 1 stroke
      expect((result.metadata as any).pathOperations).toBeGreaterThanOrEqual(3 + count);
      expect((result.metadata as any).drawOperations).toBeGreaterThanOrEqual(2);
    }
  });

  test('scalability of polygon rendering with complex scenes', async () => {
    const { ctx } = createMockCanvas();

    // Define test cases with varying complexity
    const testCases = [
      { polygons: 10, pointsPerPolygon: 20, description: 'Simple scene' },
      { polygons: 50, pointsPerPolygon: 20, description: 'Medium scene' },
      { polygons: 100, pointsPerPolygon: 20, description: 'Complex scene' },
      {
        polygons: 100,
        pointsPerPolygon: 50,
        description: 'Very complex scene',
      },
      {
        polygons: 500,
        pointsPerPolygon: 20,
        description: 'Extremely complex scene',
      },
    ];

    for (const testCase of testCases) {
      const { polygons: count, pointsPerPolygon, description } = testCase;
      const polygons = generateRandomPolygons(count, pointsPerPolygon);

      const result = await measurePerformance(
        `Rendering ${description} (${count} polygons with ${pointsPerPolygon} points each)`,
        () => {
          ctx.resetCounters();
          renderPolygons(ctx, polygons);
          return ctx.getStats();
        },
        { iterations: 5, warmupIterations: 1 },
      );

      // Log render time
      console.log(`Rendering ${description}:`);
      console.log(`- Average render time: ${result.averageDuration?.toFixed(2)}ms`);
      console.log(`- Path operations: ${(result.metadata as any).pathOperations}`);
      console.log(`- Draw operations: ${(result.metadata as any).drawOperations}`);

      // For extremely complex scenes, rendering should still be reasonable (< 1 second)
      expect(result.averageDuration).toBeLessThan(1000);
    }
  });

  test('combined operations performance for interactive editing', async () => {
    const { ctx } = createMockCanvas();

    // Generate a scene with polygons
    const polygons = generateRandomPolygons(50, 20);

    // Simulate a typical interaction cycle
    const result = await measurePerformance(
      'Typical interaction cycle (render, detect, move, re-render)',
      () => {
        // Initial render
        ctx.resetCounters();
        renderPolygons(ctx, polygons);

        // Detect polygon at position
        const testPosition = { x: 500, y: 500 };
        const polygonIndex = findPolygonAtPosition(polygons, testPosition.x, testPosition.y);

        // If polygon found, modify it
        if (polygonIndex >= 0) {
          // Move the polygon slightly
          const polygon = polygons[polygonIndex];
          polygon.points = polygon.points.map((p) => ({
            x: p.x + 10,
            y: p.y + 10,
          }));

          // Re-render the scene
          ctx.resetCounters();
          renderPolygons(ctx, polygons);
        }

        return {
          foundPolygon: polygonIndex >= 0,
          ...ctx.getStats(),
        };
      },
      { iterations: 20, warmupIterations: 2 },
    );

    // A typical interaction cycle should be fast enough for smooth interaction (< 50ms)
    expect(result.averageDuration).toBeLessThan(50);
  });
});

// Mock React component for polygon rendering
function MockPolygonRenderer({ polygons }: { polygons: Polygon[] }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Render polygons on mount and when polygons change
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d') as any;
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render polygons
    renderPolygons(ctx, polygons);
  }, [polygons]);

  return <canvas ref={canvasRef} width={1000} height={1000} />;
}

describe('React Component Rendering Performance', () => {
  test('component rendering performance with different polygon counts', async () => {
    // Test with different numbers of polygons
    const polygonCounts = [10, 50, 100];

    for (const count of polygonCounts) {
      const polygons = generateRandomPolygons(count, 20);

      const result = await measurePerformance(
        `React component rendering with ${count} polygons`,
        () => {
          const { container, unmount } = render(<MockPolygonRenderer polygons={polygons} />);

          // Force useEffect to run
          vi.runAllTimers();

          // Clean up
          unmount();

          return container;
        },
        { iterations: 5, warmupIterations: 1 },
      );

      // React component rendering should be reasonably fast
      expect(result.averageDuration).toBeLessThan(500);
    }
  });
});
