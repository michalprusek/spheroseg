import { Point } from '@spheroseg/types';

/**
 * Interface for the polygon worker
 */
export interface PolygonWorker {
  isReady: boolean;
  calculatePolygonArea: (points: Point[]) => Promise<number>;
  calculatePolygonPerimeter: (points: Point[]) => Promise<number>;
  calculateBoundingBox: (points: Point[]) => Promise<{ x: number; y: number; width: number; height: number } | null>;
}

/**
 * Base function to execute polygon worker operations with error handling
 */
export const executePolygonWorkerOperation = async <T>(
  points: Point[],
  polygonWorker: PolygonWorker,
  operation: (points: Point[]) => Promise<T>,
  operationName: string,
  defaultValue: T
): Promise<T> => {
  try {
    if (!polygonWorker.isReady) {
      // Worker not ready, return default value
      return defaultValue;
    }

    return await operation(points);
  } catch (error) {
    // Error handled by returning default value
    return defaultValue;
  }
};

/**
 * Calculate polygon area using WebWorker
 */
export const calculatePolygonAreaAsync = async (
  points: Point[],
  polygonWorker: PolygonWorker
): Promise<number> => {
  return executePolygonWorkerOperation(
    points,
    polygonWorker,
    (pts) => polygonWorker.calculatePolygonArea(pts),
    'calculatePolygonAreaAsync',
    0
  );
};

/**
 * Calculate polygon perimeter using WebWorker
 */
export const calculatePolygonPerimeterAsync = async (
  points: Point[],
  polygonWorker: PolygonWorker
): Promise<number> => {
  return executePolygonWorkerOperation(
    points,
    polygonWorker,
    (pts) => polygonWorker.calculatePolygonPerimeter(pts),
    'calculatePolygonPerimeterAsync',
    0
  );
};

/**
 * Calculate polygon bounding box using WebWorker
 */
export const calculateBoundingBoxAsync = async (
  points: Point[],
  polygonWorker: PolygonWorker
): Promise<{ x: number; y: number; width: number; height: number } | null> => {
  return executePolygonWorkerOperation(
    points,
    polygonWorker,
    (pts) => polygonWorker.calculateBoundingBox(pts),
    'calculateBoundingBoxAsync',
    null
  );
};