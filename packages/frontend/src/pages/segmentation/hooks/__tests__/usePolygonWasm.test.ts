import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolygonWasm } from '../usePolygonWasm';
import { Point, Polygon } from '@spheroseg/types';

// Mock the WebAssembly module
vi.mock('@spheroseg/wasm-polygon', () => ({
  initWasm: vi.fn().mockResolvedValue({
    initialized: true,
    isPointInPolygon: vi.fn((polygon, point) => {
      // Simple mock implementation for isPointInPolygon
      // For rectangle polygon, just check if point is inside bounds
      const xPoints = polygon.points.map((p) => p.x);
      const yPoints = polygon.points.map((p) => p.y);
      const minX = Math.min(...xPoints);
      const maxX = Math.max(...xPoints);
      const minY = Math.min(...yPoints);
      const maxY = Math.max(...yPoints);

      return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }),
    simplifyPolygon: vi.fn((polygon, tolerance) => {
      // Mock simplification by returning every other point for non-zero tolerance
      if (tolerance > 0 && polygon.points.length > 3) {
        return {
          ...polygon,
          points: polygon.points.filter((_, i) => i % 2 === 0),
        };
      }
      return polygon;
    }),
    calculatePolygonArea: vi.fn((polygon) => {
      // Very simple mock area calculation for rectangles
      if (polygon.points.length === 4) {
        const width = Math.abs(polygon.points[0].x - polygon.points[2].x);
        const height = Math.abs(polygon.points[0].y - polygon.points[2].y);
        return width * height;
      }
      return 100; // Default mock area
    }),
    detectSelfIntersections: vi.fn((polygon) => {
      // Mock self-intersection detection
      // Just return a predefined result for test polygons
      if (polygon.points.length > 5) {
        // For test purposes, consider polygons with more than 5 points as self-intersecting
        return [{ x: polygon.points[0].x, y: polygon.points[0].y }];
      }
      return [];
    }),
    combinePolygons: vi.fn((polygon1, polygon2) => {
      // Mock polygon combination by simply concatenating the points
      return {
        points: [...polygon1.points, ...polygon2.points],
        closed: true,
        color: polygon1.color,
      };
    }),
  }),
  ready: vi.fn().mockResolvedValue(true),
}));

describe('usePolygonWasm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes WebAssembly module correctly', async () => {
    const { result } = renderHook(() => usePolygonWasm());

    // Should start with loading state
    expect(result.current.loading).toBe(true);

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Should be initialized
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.wasmModule).not.toBeNull();
  });

  it('detects if a point is inside a polygon', async () => {
    const { result } = renderHook(() => usePolygonWasm());

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const polygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 },
      ],
      closed: true,
      color: '#FF0000',
    };

    // Point inside
    const insidePoint: Point = { x: 200, y: 200 };
    // Point outside
    const outsidePoint: Point = { x: 400, y: 400 };

    // Test point detection
    expect(result.current.isPointInPolygon(polygon, insidePoint)).toBe(true);
    expect(result.current.isPointInPolygon(polygon, outsidePoint)).toBe(false);
  });

  it('simplifies polygons based on tolerance', async () => {
    const { result } = renderHook(() => usePolygonWasm());

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const complexPolygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 200 },
        { x: 300, y: 300 },
        { x: 200, y: 300 },
        { x: 100, y: 300 },
        { x: 100, y: 200 },
      ],
      closed: true,
      color: '#FF0000',
    };

    // Simplify with tolerance
    const simplifiedPolygon = result.current.simplifyPolygon(complexPolygon, 1.0);

    // Should have fewer points
    expect(simplifiedPolygon.points.length).toBeLessThan(complexPolygon.points.length);

    // Simplify with zero tolerance (should return the same polygon)
    const noSimplificationPolygon = result.current.simplifyPolygon(complexPolygon, 0);
    expect(noSimplificationPolygon.points.length).toBe(complexPolygon.points.length);
  });

  it('calculates polygon area correctly', async () => {
    const { result } = renderHook(() => usePolygonWasm());

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const rectangle: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 },
      ],
      closed: true,
      color: '#FF0000',
    };

    // Calculate area
    const area = result.current.calculatePolygonArea(rectangle);

    // For our mock, rectangle 200x200 should have area 40000
    expect(area).toBe(40000);
  });

  it('detects self-intersections in polygons', async () => {
    const { result } = renderHook(() => usePolygonWasm());

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Non-self-intersecting polygon
    const simplePolygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 },
      ],
      closed: true,
      color: '#FF0000',
    };

    // Self-intersecting polygon (for test purposes, our mock considers any polygon with > 5 points as self-intersecting)
    const selfIntersectingPolygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 },
        { x: 200, y: 200 },
        { x: 150, y: 250 },
      ],
      closed: true,
      color: '#FF0000',
    };

    // Check intersections
    const simplePolygonIntersections = result.current.detectSelfIntersections(simplePolygon);
    const selfIntersectingPolygonIntersections = result.current.detectSelfIntersections(selfIntersectingPolygon);

    // Simple polygon should have no intersections
    expect(simplePolygonIntersections.length).toBe(0);

    // Self-intersecting polygon should have at least one intersection
    expect(selfIntersectingPolygonIntersections.length).toBeGreaterThan(0);
  });

  it('combines polygons correctly', async () => {
    const { result } = renderHook(() => usePolygonWasm());

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const polygon1: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
      closed: true,
      color: '#FF0000',
    };

    const polygon2: Polygon = {
      points: [
        { x: 150, y: 150 },
        { x: 250, y: 150 },
        { x: 250, y: 250 },
        { x: 150, y: 250 },
      ],
      closed: true,
      color: '#00FF00',
    };

    // Combine polygons
    const combinedPolygon = result.current.combinePolygons(polygon1, polygon2);

    // Combined polygon should have points from both polygons
    expect(combinedPolygon.points.length).toBe(polygon1.points.length + polygon2.points.length);
    expect(combinedPolygon.color).toBe(polygon1.color);
  });

  it('handles WebAssembly initialization errors', async () => {
    // Mock implementation to throw an error
    vi.mocked(initWasm).mockRejectedValueOnce(new Error('Failed to initialize WebAssembly module'));

    const { result } = renderHook(() => usePolygonWasm());

    // Wait for initialization attempt
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Should have error state
    expect(result.current.loading).toBe(false);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('Failed to initialize WebAssembly module');
    expect(result.current.wasmModule).toBeNull();
  });

  it('gracefully handles missing WebAssembly module', async () => {
    const { result } = renderHook(() => usePolygonWasm());

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Simulate a case where the module isn't properly initialized
    Object.defineProperty(result.current, 'wasmModule', { value: null });

    const polygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 },
      ],
      closed: true,
      color: '#FF0000',
    };

    // Should return fallback values without crashing
    expect(result.current.isPointInPolygon(polygon, { x: 200, y: 200 })).toBe(false);
    expect(result.current.simplifyPolygon(polygon, 1.0)).toEqual(polygon);
    expect(result.current.calculatePolygonArea(polygon)).toBe(0);
    expect(result.current.detectSelfIntersections(polygon)).toEqual([]);
  });
});
