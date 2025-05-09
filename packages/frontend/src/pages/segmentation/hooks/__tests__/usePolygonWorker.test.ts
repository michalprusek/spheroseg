import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePolygonWorker } from '../usePolygonWorker';
import { Point, Polygon } from '@spheroseg/types';

// Mock the Web Worker
class MockWorker {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = null;
  }

  postMessage(msg) {
    // Simulate asynchronous worker response
    setTimeout(() => {
      if (this.onmessage) {
        let response;
        
        switch (msg.type) {
          case 'DETECT_POINT_IN_POLYGON':
            response = {
              type: 'POINT_IN_POLYGON_RESULT',
              payload: {
                isInside: msg.payload.point.x >= 100 && msg.payload.point.x <= 300 &&
                          msg.payload.point.y >= 100 && msg.payload.point.y <= 300,
                pointIndex: msg.payload.pointIndex
              },
              requestId: msg.requestId
            };
            break;
            
          case 'SIMPLIFY_POLYGON':
            response = {
              type: 'SIMPLIFY_POLYGON_RESULT',
              payload: {
                // Mock simplification - remove every other point if tolerance > 0
                polygon: msg.payload.tolerance > 0 
                  ? {
                      ...msg.payload.polygon,
                      points: msg.payload.polygon.points.filter((_, i) => i % 2 === 0)
                    }
                  : msg.payload.polygon
              },
              requestId: msg.requestId
            };
            break;
            
          case 'CALCULATE_AREA':
            response = {
              type: 'AREA_RESULT',
              payload: {
                area: 40000 // Mock area for test
              },
              requestId: msg.requestId
            };
            break;
            
          case 'DETECT_SELF_INTERSECTIONS':
            response = {
              type: 'SELF_INTERSECTIONS_RESULT',
              payload: {
                intersections: msg.payload.polygon.points.length > 5 
                  ? [{ x: msg.payload.polygon.points[0].x, y: msg.payload.polygon.points[0].y }] 
                  : []
              },
              requestId: msg.requestId
            };
            break;
            
          case 'COMBINE_POLYGONS':
            response = {
              type: 'COMBINE_POLYGONS_RESULT',
              payload: {
                polygon: {
                  points: [...msg.payload.polygon1.points, ...msg.payload.polygon2.points],
                  closed: true,
                  color: msg.payload.polygon1.color
                }
              },
              requestId: msg.requestId
            };
            break;
            
          default:
            response = {
              type: 'ERROR',
              payload: { error: 'Unknown operation' },
              requestId: msg.requestId
            };
        }
        
        this.onmessage({ data: response });
      }
    }, 50);
  }

  terminate() {
    // Mock worker termination
  }
}

// Replace real Worker with mock
vi.stubGlobal('Worker', MockWorker);

describe('usePolygonWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes worker correctly', () => {
    const { result } = renderHook(() => usePolygonWorker());
    
    // Should not be in an error state
    expect(result.current.error).toBeNull();
    
    // Worker should be initialized
    expect(result.current.workerInitialized).toBe(true);
  });

  it('detects if a point is inside a polygon', async () => {
    const { result } = renderHook(() => usePolygonWorker());
    
    const polygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 }
      ],
      closed: true,
      color: '#FF0000'
    };
    
    // Point inside
    const insidePoint: Point = { x: 200, y: 200 };
    // Point outside
    const outsidePoint: Point = { x: 400, y: 400 };
    
    // Start async operations
    const insidePromise = result.current.isPointInPolygon(polygon, insidePoint);
    const outsidePromise = result.current.isPointInPolygon(polygon, outsidePoint);
    
    // Fast-forward timers to resolve the promises
    await act(async () => {
      vi.runAllTimers();
    });
    
    // Check results
    await waitFor(() => {
      expect(insidePromise).resolves.toBe(true);
      expect(outsidePromise).resolves.toBe(false);
    });
  });

  it('simplifies polygons based on tolerance', async () => {
    const { result } = renderHook(() => usePolygonWorker());
    
    const complexPolygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 200 },
        { x: 300, y: 300 },
        { x: 200, y: 300 },
        { x: 100, y: 300 },
        { x: 100, y: 200 }
      ],
      closed: true,
      color: '#FF0000'
    };
    
    // Simplify with tolerance
    const simplifyPromise = result.current.simplifyPolygon(complexPolygon, 1.0);
    
    // Fast-forward timers
    await act(async () => {
      vi.runAllTimers();
    });
    
    // Check results
    const simplifiedPolygon = await simplifyPromise;
    expect(simplifiedPolygon.points.length).toBeLessThan(complexPolygon.points.length);
    
    // Simplify with zero tolerance (should keep all points)
    const noSimplifyPromise = result.current.simplifyPolygon(complexPolygon, 0);
    
    // Fast-forward timers
    await act(async () => {
      vi.runAllTimers();
    });
    
    // Check results
    const noSimplifiedPolygon = await noSimplifyPromise;
    expect(noSimplifiedPolygon.points.length).toBe(complexPolygon.points.length);
  });

  it('calculates polygon area correctly', async () => {
    const { result } = renderHook(() => usePolygonWorker());
    
    const rectangle: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 }
      ],
      closed: true,
      color: '#FF0000'
    };
    
    // Calculate area
    const areaPromise = result.current.calculatePolygonArea(rectangle);
    
    // Fast-forward timers
    await act(async () => {
      vi.runAllTimers();
    });
    
    // Check results (mock returns 40000)
    const area = await areaPromise;
    expect(area).toBe(40000);
  });

  it('detects self-intersections in polygons', async () => {
    const { result } = renderHook(() => usePolygonWorker());
    
    // Non-self-intersecting polygon
    const simplePolygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 }
      ],
      closed: true,
      color: '#FF0000'
    };
    
    // Self-intersecting polygon (for test purposes, our mock considers any polygon with > 5 points as self-intersecting)
    const selfIntersectingPolygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 },
        { x: 200, y: 200 },
        { x: 150, y: 250 }
      ],
      closed: true,
      color: '#FF0000'
    };
    
    // Check intersections
    const simplePromise = result.current.detectSelfIntersections(simplePolygon);
    const intersectingPromise = result.current.detectSelfIntersections(selfIntersectingPolygon);
    
    // Fast-forward timers
    await act(async () => {
      vi.runAllTimers();
    });
    
    // Check results
    const simpleIntersections = await simplePromise;
    const intersectingIntersections = await intersectingPromise;
    
    expect(simpleIntersections.length).toBe(0);
    expect(intersectingIntersections.length).toBeGreaterThan(0);
  });

  it('combines polygons correctly', async () => {
    const { result } = renderHook(() => usePolygonWorker());
    
    const polygon1: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 }
      ],
      closed: true,
      color: '#FF0000'
    };
    
    const polygon2: Polygon = {
      points: [
        { x: 150, y: 150 },
        { x: 250, y: 150 },
        { x: 250, y: 250 },
        { x: 150, y: 250 }
      ],
      closed: true,
      color: '#00FF00'
    };
    
    // Combine polygons
    const combinePromise = result.current.combinePolygons(polygon1, polygon2);
    
    // Fast-forward timers
    await act(async () => {
      vi.runAllTimers();
    });
    
    // Check results
    const combinedPolygon = await combinePromise;
    
    expect(combinedPolygon.points.length).toBe(polygon1.points.length + polygon2.points.length);
    expect(combinedPolygon.color).toBe(polygon1.color);
  });

  it('handles worker termination on unmount', () => {
    const { result, unmount } = renderHook(() => usePolygonWorker());
    
    // Spy on worker terminate method
    const terminateSpy = vi.spyOn(MockWorker.prototype, 'terminate');
    
    // Unmount component
    unmount();
    
    // Worker should be terminated
    expect(terminateSpy).toHaveBeenCalled();
  });

  it('handles multiple concurrent operations', async () => {
    const { result } = renderHook(() => usePolygonWorker());
    
    const polygon: Polygon = {
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 }
      ],
      closed: true,
      color: '#FF0000'
    };
    
    // Start multiple operations concurrently
    const pointPromise = result.current.isPointInPolygon(polygon, { x: 200, y: 200 });
    const areaPromise = result.current.calculatePolygonArea(polygon);
    const intersectionPromise = result.current.detectSelfIntersections(polygon);
    
    // Fast-forward timers
    await act(async () => {
      vi.runAllTimers();
    });
    
    // All promises should resolve correctly
    await waitFor(() => {
      expect(pointPromise).resolves.toBe(true);
      expect(areaPromise).resolves.toBe(40000);
      expect(intersectionPromise).resolves.toEqual([]);
    });
  });

  it('throws error if worker fails to initialize', () => {
    // Mock Worker constructor to throw an error
    const originalWorker = global.Worker;
    global.Worker = class FailingWorker {
      constructor() {
        throw new Error('Failed to create worker');
      }
    } as unknown as typeof Worker;
    
    // This should throw an error
    expect(() => renderHook(() => usePolygonWorker())).toThrow();
    
    // Restore original Worker
    global.Worker = originalWorker;
  });
});