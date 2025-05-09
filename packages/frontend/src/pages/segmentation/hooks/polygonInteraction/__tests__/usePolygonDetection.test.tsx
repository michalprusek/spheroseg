import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePolygonDetection } from '../usePolygonDetection';
import { Polygon, Point } from '@spheroseg/types';

// Mock hooks used within usePolygonDetection
vi.mock('../../usePolygonWasm', () => ({
  usePolygonWasm: () => ({
    isPointInPolygon: vi.fn((polygon, point) => {
      // Simple mock implementation that checks if point is within polygon bounds
      const xPoints = polygon.points.map(p => p.x);
      const yPoints = polygon.points.map(p => p.y);
      const minX = Math.min(...xPoints);
      const maxX = Math.max(...xPoints);
      const minY = Math.min(...yPoints);
      const maxY = Math.max(...yPoints);
      
      return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }),
    loading: false,
    error: null,
    wasmModule: {}
  })
}));

describe('usePolygonDetection', () => {
  const mockPolygons: Polygon[] = [
    {
      // Rectangle from (100,100) to (200,200)
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 }
      ],
      closed: true,
      color: '#FF0000'
    },
    {
      // Triangle
      points: [
        { x: 300, y: 300 },
        { x: 400, y: 300 },
        { x: 350, y: 400 }
      ],
      closed: true,
      color: '#00FF00'
    }
  ];
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('detects point in polygon correctly', () => {
    const { result } = renderHook(() => usePolygonDetection(mockPolygons));
    
    // Point inside first polygon
    const insidePoint1: Point = { x: 150, y: 150 };
    expect(result.current.detectPolygonAtPoint(insidePoint1)).toBe(0);
    
    // Point inside second polygon
    const insidePoint2: Point = { x: 350, y: 350 };
    expect(result.current.detectPolygonAtPoint(insidePoint2)).toBe(1);
    
    // Point outside any polygon
    const outsidePoint: Point = { x: 250, y: 250 };
    expect(result.current.detectPolygonAtPoint(outsidePoint)).toBe(-1);
  });
  
  it('detects stacked polygons in the correct order', () => {
    // Create overlapping polygons, later polygons should be detected first (on top)
    const overlappingPolygons: Polygon[] = [
      // Bottom polygon
      {
        points: [
          { x: 100, y: 100 },
          { x: 300, y: 100 },
          { x: 300, y: 300 },
          { x: 100, y: 300 }
        ],
        closed: true,
        color: '#FF0000'
      },
      // Middle polygon
      {
        points: [
          { x: 150, y: 150 },
          { x: 350, y: 150 },
          { x: 350, y: 350 },
          { x: 150, y: 350 }
        ],
        closed: true,
        color: '#00FF00'
      },
      // Top polygon
      {
        points: [
          { x: 200, y: 200 },
          { x: 400, y: 200 },
          { x: 400, y: 400 },
          { x: 200, y: 400 }
        ],
        closed: true,
        color: '#0000FF'
      }
    ];
    
    const { result } = renderHook(() => usePolygonDetection(overlappingPolygons));
    
    // Point overlapping all three polygons
    const overlappingPoint: Point = { x: 250, y: 250 };
    
    // Should detect the top-most polygon (index 2)
    expect(result.current.detectPolygonAtPoint(overlappingPoint)).toBe(2);
  });
  
  it('detects nearest vertex correctly', () => {
    const { result } = renderHook(() => usePolygonDetection(mockPolygons));
    
    // Point near first vertex of first polygon
    const nearFirstVertex: Point = { x: 105, y: 105 };
    const vertexInfo1 = result.current.detectNearestVertex(nearFirstVertex, 10);
    
    expect(vertexInfo1).not.toBeNull();
    expect(vertexInfo1?.polygonIndex).toBe(0);
    expect(vertexInfo1?.vertexIndex).toBe(0);
    
    // Point near third vertex of second polygon
    const nearThirdVertex: Point = { x: 348, y: 402 };
    const vertexInfo2 = result.current.detectNearestVertex(nearThirdVertex, 10);
    
    expect(vertexInfo2).not.toBeNull();
    expect(vertexInfo2?.polygonIndex).toBe(1);
    expect(vertexInfo2?.vertexIndex).toBe(2);
    
    // Point not near any vertex
    const farFromVertices: Point = { x: 250, y: 250 };
    const vertexInfo3 = result.current.detectNearestVertex(farFromVertices, 10);
    
    expect(vertexInfo3).toBeNull();
  });
  
  it('calculates distance between points correctly', () => {
    const { result } = renderHook(() => usePolygonDetection(mockPolygons));
    
    const point1: Point = { x: 0, y: 0 };
    const point2: Point = { x: 3, y: 4 };
    
    // Distance should be 5 (Pythagorean theorem: sqrt(3² + 4²) = 5)
    expect(result.current.calculateDistance(point1, point2)).toBe(5);
  });
  
  it('detects nearest edge point correctly', () => {
    const { result } = renderHook(() => usePolygonDetection(mockPolygons));
    
    // Point near the top edge of first polygon
    const nearTopEdge: Point = { x: 150, y: 90 };
    const edgeInfo1 = result.current.detectNearestEdge(nearTopEdge, 15);
    
    expect(edgeInfo1).not.toBeNull();
    expect(edgeInfo1?.polygonIndex).toBe(0);
    expect(edgeInfo1?.edgeIndex).toBe(0); // Edge between vertices 0 and 1
    
    // Point near the right edge of second polygon
    const nearRightEdge: Point = { x: 410, y: 350 };
    const edgeInfo2 = result.current.detectNearestEdge(nearRightEdge, 15);
    
    expect(edgeInfo2).not.toBeNull();
    expect(edgeInfo2?.polygonIndex).toBe(1);
    expect(edgeInfo2?.edgeIndex).toBe(1); // Edge between vertices 1 and 2
    
    // Point not near any edge
    const farFromEdges: Point = { x: 250, y: 250 };
    const edgeInfo3 = result.current.detectNearestEdge(farFromEdges, 15);
    
    expect(edgeInfo3).toBeNull();
  });
  
  it('calculates distance to line segment correctly', () => {
    const { result } = renderHook(() => usePolygonDetection(mockPolygons));
    
    // Test point
    const testPoint: Point = { x: 150, y: 90 };
    
    // Line segment (horizontal line from (100,100) to (200,100))
    const lineStart: Point = { x: 100, y: 100 };
    const lineEnd: Point = { x: 200, y: 100 };
    
    // Distance should be 10 (vertical distance to the line)
    expect(result.current.pointToLineDistance(testPoint, lineStart, lineEnd)).toBe(10);
    
    // Test point outside the line segment's projection
    const pointOutside: Point = { x: 50, y: 90 };
    
    // Distance should be to the nearest endpoint (distance from (50,90) to (100,100))
    const expectedDistance = Math.sqrt(50*50 + 10*10); // approx. 50.99
    expect(result.current.pointToLineDistance(pointOutside, lineStart, lineEnd)).toBeCloseTo(expectedDistance);
  });
  
  it('handles empty polygon array', () => {
    const { result } = renderHook(() => usePolygonDetection([]));
    
    // Should not detect any polygon
    expect(result.current.detectPolygonAtPoint({ x: 150, y: 150 })).toBe(-1);
    
    // Should not detect any vertex
    expect(result.current.detectNearestVertex({ x: 150, y: 150 }, 10)).toBeNull();
    
    // Should not detect any edge
    expect(result.current.detectNearestEdge({ x: 150, y: 150 }, 10)).toBeNull();
  });
  
  it('respects polygon visibility flag', () => {
    // Create polygons with visibility flag
    const polygonsWithVisibility = [
      {
        ...mockPolygons[0],
        visible: true
      },
      {
        ...mockPolygons[1],
        visible: false // Second polygon is not visible
      }
    ];
    
    const { result } = renderHook(() => usePolygonDetection(polygonsWithVisibility));
    
    // Point inside first polygon (visible)
    const insidePoint1: Point = { x: 150, y: 150 };
    expect(result.current.detectPolygonAtPoint(insidePoint1)).toBe(0);
    
    // Point inside second polygon (not visible)
    const insidePoint2: Point = { x: 350, y: 350 };
    expect(result.current.detectPolygonAtPoint(insidePoint2)).toBe(-1); // Should not detect invisible polygon
  });
  
  it('handles detection with transformed coordinates', () => {
    const { result } = renderHook(() => usePolygonDetection(mockPolygons));
    
    // Scale and pan transform
    const scale = 0.5;
    const panOffset = { x: 50, y: 50 };
    
    // Point coordinates in transformed space
    const transformedPoint: Point = { x: 125, y: 125 };
    
    // Apply inverse transform to get original coordinates
    const originalX = (transformedPoint.x - panOffset.x) / scale;
    const originalY = (transformedPoint.y - panOffset.y) / scale;
    
    // Original point should be at (150, 150) after inverse transform
    expect(originalX).toBe(150);
    expect(originalY).toBe(150);
    
    // Detect polygon at transformed point with transform parameters
    const detectedIndex = result.current.detectPolygonAtPointWithTransform(
      transformedPoint, 
      scale, 
      panOffset
    );
    
    // Should detect the first polygon
    expect(detectedIndex).toBe(0);
  });
});