// This is a Web Worker for polygon operations
// It handles computationally intensive tasks like:
// - Polygon intersection detection
// - Slicing polygons
// - Simplifying polygons
// - Calculating polygon area and perimeter

import { Point } from '@spheroseg/types';
import {
  WorkerRequest,
  WorkerResponse,
  isPointInPolygon,
  slicePolygon,
  simplifyPolygon,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculateBoundingBox
} from '@/shared/utils/polygonOperationsUtils';

// Handle messages from the main thread
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, operation, data } = event.data;

  try {
    let result;

    switch (operation) {
      case 'isPointInPolygon':
        result = isPointInPolygon(data.point, data.polygon);
        break;

      case 'slicePolygon':
        result = slicePolygon(data.polygon, data.sliceStart, data.sliceEnd);
        break;

      case 'simplifyPolygon':
        result = simplifyPolygon(data.polygon, data.epsilon);
        break;

      case 'calculatePolygonArea':
        result = calculatePolygonArea(data.polygon);
        break;

      case 'calculatePolygonPerimeter':
        result = calculatePolygonPerimeter(data.polygon);
        break;

      case 'calculateBoundingBox':
        result = calculateBoundingBox(data.polygon);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    const response: WorkerResponse = {
      id,
      operation,
      result
    };

    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      operation,
      result: null,
      error: error instanceof Error ? error.message : String(error)
    };

    self.postMessage(response);
  }
};

// Export empty object to satisfy TypeScript
export {};