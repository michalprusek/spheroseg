import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Point, Polygon, SegmentationResult } from '@/lib/segmentation';
import { useGeometryUtils } from './useGeometryUtils';
import { intersectionUtils } from './utils/intersectionUtils';
import { polygonSplitUtils, SliceOperation } from './utils/polygonSplitter';
import { sliceValidator } from './utils/sliceValidator';
import { toast } from 'sonner';
import polygonOperations from '@/utils/polygonOperations';

// Helper function return type
interface ValidationResult {
  isValid: boolean;
  polygon: Polygon | null;
  intersections: Array<{
    point: Point;
    segmentIndex: number;
    t: number;
  }> | null;
  message?: string;
}

// Hook pro implementaci rozdělení polygonu (slicing)
export const usePolygonSplitter = (
  segmentation: SegmentationResult | null,
  setSegmentation: (seg: SegmentationResult | null) => void,
) => {
  const { calculatePathLength, isLineIntersectingItself } = useGeometryUtils();

  // --- Helper Function for Validation ---
  const validateAndFindIntersections = useCallback(
    (polygonId: string, startPoint: Point, endPoint: Point): ValidationResult => {
      if (!segmentation) {
        return {
          isValid: false,
          polygon: null,
          intersections: null,
          message: 'Segmentation not available.',
        };
      }

      const polygon = segmentation.polygons.find((p) => p.id === polygonId);
      if (!polygon) {
        return {
          isValid: false,
          polygon: null,
          intersections: null,
          message: 'Polygon not found.',
        };
      }

      console.log(
        `[POLYGON SPLITTER] Validating slice line from (${startPoint.x.toFixed(2)}, ${startPoint.y.toFixed(2)}) to (${endPoint.x.toFixed(2)}, ${endPoint.y.toFixed(2)}) for polygon ${polygonId}`,
      );

      const { isValid, intersections, message } = sliceValidator.validateSliceLine(
        polygon.points,
        [startPoint, endPoint],
        isLineIntersectingItself,
      );

      if (!isValid) {
        console.error(`[POLYGON SPLITTER] Validation failed: ${message}`);
        return {
          isValid: false,
          polygon: polygon,
          intersections: null,
          message,
        };
      }

      console.log(`[POLYGON SPLITTER] Validation successful, found ${intersections.length} intersections`);
      intersections.forEach((intersection, index) => {
        console.log(
          `[POLYGON SPLITTER] Intersection ${index + 1}: point (${intersection.point.x.toFixed(2)}, ${intersection.point.y.toFixed(2)}), segment ${intersection.segmentIndex}, t=${intersection.t.toFixed(4)}`,
        );
      });

      return { isValid: true, polygon: polygon, intersections: intersections };
    },
    [segmentation, isLineIntersectingItself],
  );

  /**
   * Rozdělení polygonu podle řezací linie (ponechá se větší část)
   */
  const splitPolygon = useCallback(
    (operation: SliceOperation): boolean => {
      const { polygonId, startPoint, endPoint } = operation;

      // Validate and get polygon/intersections using the helper
      const validation = validateAndFindIntersections(polygonId, startPoint, endPoint);
      if (!validation.isValid || !validation.polygon || !validation.intersections) {
        // Error already logged by helper or no segmentation
        if (validation.message) toast.error(validation.message);
        return false;
      }
      const { polygon, intersections } = validation;

      // Split polygon into two paths
      const { poly1Points, poly2Points } = polygonSplitUtils.splitPolygonPaths(polygon.points, intersections);

      // Calculate scores for both potential polygons
      const score1 = polygonSplitUtils.calculatePolygonScore(
        poly1Points,
        intersectionUtils.calculatePolygonArea,
        calculatePathLength,
      );

      const score2 = polygonSplitUtils.calculatePolygonScore(
        poly2Points,
        intersectionUtils.calculatePolygonArea,
        calculatePathLength,
      );

      // Keep the polygon with higher score
      const newPolygonPoints = score1 > score2 ? poly1Points : poly2Points;

      // Ensure the resulting polygon has at least 3 points
      if (newPolygonPoints.length < 3) {
        toast.error('Resulting polygon would be too small');
        return false;
      }

      // Update the polygon
      const updatedPolygons = segmentation!.polygons.map((p) => {
        // segmentation is checked in helper
        if (p.id === polygonId) {
          return {
            ...p,
            points: newPolygonPoints,
          };
        }
        return p;
      });

      setSegmentation({
        ...segmentation!, // segmentation is checked in helper
        polygons: updatedPolygons,
      });

      return true;
    },
    [segmentation, setSegmentation, calculatePathLength, validateAndFindIntersections],
  );

  /**
   * Rozdělení polygonu na dva samostatné polygony
   */
  const splitIntoTwoPolygons = useCallback(
    (operation: SliceOperation): boolean => {
      const { polygonId, startPoint, endPoint } = operation;

      if (!segmentation) {
        toast.error('Segmentation not available.');
        return false;
      }

      try {
        // Use the consolidated polygon operations utility
        const result = polygonOperations.splitPolygon(segmentation, polygonId, [startPoint, endPoint]);

        if (!result) {
          toast.error('Failed to split polygon.');
          return false;
        }

        setSegmentation(result);
        return true;
      } catch (error) {
        console.error('[POLYGON SPLITTER] Error splitting polygon:', error);
        toast.error('Error splitting polygon.');
        return false;
      }
    },
    [segmentation, setSegmentation],
  );

  return {
    calculateIntersections: intersectionUtils.calculateIntersections,
    validateSliceLine: (polygonPoints: Point[], line: [Point, Point]) =>
      sliceValidator.validateSliceLine(polygonPoints, line, isLineIntersectingItself),
    splitPolygon,
    splitIntoTwoPolygons,
  };
};
