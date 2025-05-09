import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Point } from '@spheroseg/types';
import { createLogger } from '@/lib/logger';
import { WorkerRequest, WorkerResponse } from '@/shared/utils/polygonOperationsUtils';
import { PolygonWorker } from '@/shared/utils/polygonWorkerUtils';

const logger = createLogger('segmentation:usePolygonWorker');

// Types for worker operations
type WorkerOperation =
  | 'isPointInPolygon'
  | 'slicePolygon'
  | 'simplifyPolygon'
  | 'calculatePolygonArea'
  | 'calculatePolygonPerimeter'
  | 'calculateBoundingBox';

// Hook for using the polygon worker
export const usePolygonWorker = () => {
  // Create a ref for the worker
  const workerRef = useRef<Worker | null>(null);

  // Create a ref for pending requests
  const pendingRequestsRef = useRef<Map<string, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }>>(new Map());

  // State for worker status
  const [isReady, setIsReady] = useState<boolean>(false);

  // Initialize the worker
  useEffect(() => {
    // Create the worker
    try {
      // Create a new worker
      const worker = new Worker(
        new URL('../workers/polygonWorker.ts', import.meta.url),
        { type: 'module' }
      );

      // Set up message handler
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, result, error } = event.data;

        // Get the pending request
        const pendingRequest = pendingRequestsRef.current.get(id);

        if (pendingRequest) {
          // Remove the request from the pending map
          pendingRequestsRef.current.delete(id);

          // Resolve or reject the promise
          if (error) {
            pendingRequest.reject(new Error(error));
          } else {
            pendingRequest.resolve(result);
          }
        }
      };

      // Set up error handler
      worker.onerror = (error) => {
        logger.error('Worker error:', error);

        // Reject all pending requests
        pendingRequestsRef.current.forEach((request) => {
          request.reject(new Error('Worker error'));
        });

        // Clear pending requests
        pendingRequestsRef.current.clear();
      };

      // Store the worker in the ref
      workerRef.current = worker;

      // Set ready state
      setIsReady(true);

      logger.info('Polygon worker initialized');

      // Clean up the worker when the component unmounts
      return () => {
        logger.info('Terminating polygon worker');

        // Reject all pending requests
        pendingRequestsRef.current.forEach((request) => {
          request.reject(new Error('Worker terminated'));
        });

        // Clear pending requests
        pendingRequestsRef.current.clear();

        // Terminate the worker
        worker.terminate();
        workerRef.current = null;
        setIsReady(false);
      };
    } catch (error) {
      logger.error('Failed to initialize polygon worker:', error);
      setIsReady(false);
    }
  }, []);

  // Function to send a request to the worker
  const sendRequest = useCallback(<T>(
    operation: WorkerOperation,
    data: any
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      // Check if the worker is ready
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      // Generate a unique ID for the request
      const id = uuidv4();

      // Store the promise callbacks in the pending requests map
      pendingRequestsRef.current.set(id, { resolve, reject });

      // Create the request
      const request: WorkerRequest = {
        id,
        operation,
        data
      };

      // Send the request to the worker
      workerRef.current.postMessage(request);
    });
  }, []);

  // Function to check if a point is inside a polygon
  const isPointInPolygon = useCallback((
    point: Point,
    polygon: Point[]
  ): Promise<boolean> => {
    return sendRequest('isPointInPolygon', { point, polygon });
  }, [sendRequest]);

  // Function to slice a polygon with a line
  const slicePolygon = useCallback((
    polygon: Point[],
    sliceStart: Point,
    sliceEnd: Point
  ): Promise<Point[][]> => {
    return sendRequest('slicePolygon', { polygon, sliceStart, sliceEnd });
  }, [sendRequest]);

  // Function to simplify a polygon
  const simplifyPolygon = useCallback((
    polygon: Point[],
    epsilon: number
  ): Promise<Point[]> => {
    return sendRequest('simplifyPolygon', { polygon, epsilon });
  }, [sendRequest]);

  // Function to calculate polygon area
  const calculatePolygonArea = useCallback((
    polygon: Point[]
  ): Promise<number> => {
    return sendRequest('calculatePolygonArea', { polygon });
  }, [sendRequest]);

  // Function to calculate polygon perimeter
  const calculatePolygonPerimeter = useCallback((
    polygon: Point[]
  ): Promise<number> => {
    return sendRequest('calculatePolygonPerimeter', { polygon });
  }, [sendRequest]);

  // Function to calculate polygon bounding box
  const calculateBoundingBox = useCallback((
    polygon: Point[]
  ): Promise<{ minX: number; minY: number; maxX: number; maxY: number }> => {
    return sendRequest('calculateBoundingBox', { polygon });
  }, [sendRequest]);

  return {
    isReady,
    isPointInPolygon,
    slicePolygon,
    simplifyPolygon,
    calculatePolygonArea,
    calculatePolygonPerimeter,
    calculateBoundingBox
  };
};

export default usePolygonWorker;

// Export the hook's return type to match the PolygonWorker interface
export type { PolygonWorker };
