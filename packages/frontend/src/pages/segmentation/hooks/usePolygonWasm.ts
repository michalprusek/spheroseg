import { useState, useEffect } from 'react';
import { Point } from '@/types';
import { usePolygonWasm as useSharedPolygonWasm } from '@spheroseg/shared/utils/polygonWasmUtils';
import { createLogger } from '@/lib/logger';

const logger = createLogger('segmentation:usePolygonWasm');

// Hook for using the WebAssembly polygon operations
export const usePolygonWasm = () => {
  const [isReady, setIsReady] = useState<boolean>(false);
  const sharedWasm = useSharedPolygonWasm();

  // Load the WebAssembly module
  useEffect(() => {
    let isMounted = true;

    const loadWasm = async () => {
      try {
        await sharedWasm.load();

        if (isMounted) {
          setIsReady(true);
          logger.info('Polygon WebAssembly module loaded');
        }
      } catch (error) {
        logger.error('Failed to load polygon WebAssembly module:', error);

        if (isMounted) {
          setIsReady(false);
        }
      }
    };

    loadWasm();

    return () => {
      isMounted = false;
    };
  }, []);

  // Use the shared implementation
  return {
    isReady,
    isPointInPolygon: (x: number, y: number, points: Point[]): boolean => sharedWasm.isPointInPolygon({ x, y }, points),
    distanceToSegment: sharedWasm.distanceToSegment,
    calculateIntersection: sharedWasm.calculateIntersection,
    calculatePolygonArea: sharedWasm.calculatePolygonArea,
    calculatePolygonPerimeter: sharedWasm.calculatePolygonPerimeter,
    calculateBoundingBox: sharedWasm.calculateBoundingBox,
    doPolygonsIntersect: sharedWasm.doPolygonsIntersect,
  };
};

export default usePolygonWasm;
