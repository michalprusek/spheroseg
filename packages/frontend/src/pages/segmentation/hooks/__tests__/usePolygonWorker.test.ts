import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { usePolygonWorker } from '../usePolygonWorker';

// Mock Worker globally
const mockPostMessage = vi.fn();
const mockTerminate = vi.fn();
const mockWorkerInstance = {
  postMessage: mockPostMessage,
  terminate: mockTerminate,
  onmessage: null,
  onerror: null,
};

// Mock Worker constructor
global.Worker = vi.fn().mockImplementation(() => mockWorkerInstance);

// Mock the worker URL
vi.mock('../workers/polygonWorker.ts', () => ({
  default: class MockWorker {
    postMessage() {}
    terminate() {}
  }
}));

describe('usePolygonWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostMessage.mockClear();
    mockTerminate.mockClear();
    mockWorkerInstance.onmessage = null;
    mockWorkerInstance.onerror = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('should initialize worker and set isReady to true', async () => {
    const { result } = renderHook(() => usePolygonWorker());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(global.Worker).toHaveBeenCalledTimes(1);
  });

  it('should check if point is inside polygon', async () => {
    const { result } = renderHook(() => usePolygonWorker());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const point = { x: 150, y: 150 };
    const polygon = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ];

    let resultPromise: Promise<boolean>;
    act(() => {
      resultPromise = result.current.isPointInPolygon(point, polygon);
    });

    // Simulate worker response
    act(() => {
      const call = mockPostMessage.mock.calls[0];
      const message = call[0];
      
      if (mockWorkerInstance.onmessage) {
        mockWorkerInstance.onmessage({
          data: {
            id: message.id,
            result: true,
          }
        });
      }
    });

    const isInside = await resultPromise!;
    expect(isInside).toBe(true);
  });

  it('should slice polygon', async () => {
    const { result } = renderHook(() => usePolygonWorker());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const lineStart = { x: -10, y: 50 };
    const lineEnd = { x: 110, y: 50 };

    let resultPromise: Promise<any>;
    act(() => {
      resultPromise = result.current.slicePolygon(polygon, lineStart, lineEnd);
    });

    // Simulate worker response
    act(() => {
      const call = mockPostMessage.mock.calls[0];
      const message = call[0];
      
      if (mockWorkerInstance.onmessage) {
        mockWorkerInstance.onmessage({
          data: {
            id: message.id,
            result: {
              polygon1: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 50 },
                { x: 0, y: 50 },
              ],
              polygon2: [
                { x: 0, y: 50 },
                { x: 100, y: 50 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
              ],
            },
          }
        });
      }
    });

    const sliceResult = await resultPromise!;
    expect(sliceResult).toHaveProperty('polygon1');
    expect(sliceResult).toHaveProperty('polygon2');
  });

  it('should simplify polygon', async () => {
    const { result } = renderHook(() => usePolygonWorker());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const polygon = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    let resultPromise: Promise<any>;
    act(() => {
      resultPromise = result.current.simplifyPolygon(polygon, 5);
    });

    // Simulate worker response
    act(() => {
      const call = mockPostMessage.mock.calls[0];
      const message = call[0];
      
      if (mockWorkerInstance.onmessage) {
        mockWorkerInstance.onmessage({
          data: {
            id: message.id,
            result: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
            ],
          }
        });
      }
    });

    const simplified = await resultPromise!;
    expect(simplified).toHaveLength(4);
  });

  it('should handle worker errors', async () => {
    const { result } = renderHook(() => usePolygonWorker());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const point = { x: 150, y: 150 };
    const polygon = [{ x: 100, y: 100 }];

    let resultPromise: Promise<boolean>;
    act(() => {
      resultPromise = result.current.isPointInPolygon(point, polygon);
    });

    // Simulate worker error
    act(() => {
      const call = mockPostMessage.mock.calls[0];
      const message = call[0];
      
      if (mockWorkerInstance.onmessage) {
        mockWorkerInstance.onmessage({
          data: {
            id: message.id,
            error: 'Invalid polygon',
          }
        });
      }
    });

    await expect(resultPromise!).rejects.toThrow('Invalid polygon');
  });

  it('should terminate worker on unmount', async () => {
    const { result, unmount } = renderHook(() => usePolygonWorker());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    unmount();

    expect(mockTerminate).toHaveBeenCalledTimes(1);
  });

  it('should reject pending requests on unmount', async () => {
    const { result, unmount } = renderHook(() => usePolygonWorker());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // Start a request but don't resolve it
    let resultPromise: Promise<boolean>;
    act(() => {
      resultPromise = result.current.isPointInPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }]);
    });

    // Unmount before the request completes
    unmount();

    // The promise should be rejected
    await expect(resultPromise!).rejects.toThrow('Worker terminated');
  });

  it('should throw error when worker is not ready', async () => {
    // Mock Worker to fail initialization
    global.Worker = vi.fn().mockImplementation(() => {
      throw new Error('Worker initialization failed');
    });

    const { result } = renderHook(() => usePolygonWorker());

    // Check that isReady is false
    expect(result.current.isReady).toBe(false);

    // Operations should throw error when worker not initialized
    await expect(result.current.isPointInPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }])).rejects.toThrow('Worker not initialized');
  });
});