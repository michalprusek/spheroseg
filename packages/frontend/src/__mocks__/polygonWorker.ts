// Mock for polygon worker to use in tests
import { vi } from 'vitest';

export class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;

  private messageQueue: MessageEvent[] = [];
  private terminated = false;

  constructor(_url: string | URL, _options?: WorkerOptions) {
    // Mock constructor
  }

  postMessage(message: unknown, _transfer?: Transferable[]): void {
    if (this.terminated) {
      return;
    }

    // Simulate async worker response
    setTimeout(() => {
      if (this.terminated) return;

      const { id, operation, params } = message;

      // Mock responses for different operations
      let result: unknown;
      let error: string | undefined;

      try {
        switch (operation) {
          case 'isPointInPolygon':
            result = false; // Default mock response
            break;
          case 'slicePolygon':
            result = { polygon1: params.polygon, polygon2: [] };
            break;
          case 'simplifyPolygon':
            result = params.polygon;
            break;
          case 'calculatePolygonArea':
            result = 100;
            break;
          case 'calculatePolygonPerimeter':
            result = 40;
            break;
          case 'calculateBoundingBox':
            result = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
            break;
          default:
            error = `Unknown operation: ${operation}`;
        }
      } catch (err) {
        error = err instanceof Error ? err.message : 'Unknown error';
      }

      if (this.onmessage) {
        this.onmessage(
          new MessageEvent('message', {
            data: { id, result, error },
          }),
        );
      }
    }, 0);
  }

  terminate(): void {
    this.terminated = true;
    this.onmessage = null;
    this.onerror = null;
  }

  addEventListener(type: string, listener: EventListener): void {
    if (type === 'message') {
      this.onmessage = listener as unknown;
    } else if (type === 'error') {
      this.onerror = listener as unknown;
    }
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (type === 'message' && this.onmessage === listener) {
      this.onmessage = null;
    } else if (type === 'error' && this.onerror === listener) {
      this.onerror = null;
    }
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }
}

// Mock Worker constructor
export const Worker = vi.fn().mockImplementation((url, options) => new MockWorker(url, options));

// Export as default for import compatibility
export default Worker;
