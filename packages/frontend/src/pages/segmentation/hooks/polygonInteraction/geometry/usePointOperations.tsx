import { useCallback } from 'react';
import { SegmentationResult, Point } from '@/lib/segmentation';
import polygonOperations from '@/utils/polygonOperations';

/**
 * Hook pro základní operace s body polygonu (přidání, odebrání, duplikace)
 * s validací integrity (např. self-intersection).
 */
export const usePointOperations = (
  segmentation: SegmentationResult | null,
  setSegmentation: (seg: SegmentationResult | null) => void,
) => {
  // --- Helper Function for State Update ---
  const updatePolygonPoints = useCallback(
    (polygonId: string, newPoints: Point[]): boolean => {
      if (!segmentation) return false;

      // Validace integrity: kontrola self-intersection
      // Tato kontrola se provádí před voláním této funkce v jednotlivých operacích

      const updatedPolygons = segmentation.polygons.map((p) => {
        if (p.id === polygonId) {
          return {
            ...p,
            points: newPoints,
          };
        }
        return p;
      });

      setSegmentation({
        ...segmentation,
        polygons: updatedPolygons,
      });
      return true;
    },
    [segmentation, setSegmentation],
  );

  /**
   * Přidání bodu na nejbližší segment polygonu s validací integrity
   */
  const addPoint = useCallback(
    (polygonId: string, point: Point): boolean => {
      if (!segmentation) return false;

      // Use the consolidated polygonOperations utility
      const result = polygonOperations.addPointToPolygon(segmentation, polygonId, -1, point);

      if (!result) {
        console.warn('Failed to add point to polygon');
        return false;
      }

      setSegmentation(result);
      return true;
    },
    [segmentation, setSegmentation],
  );

  /**
   * Odebrání bodu z polygonu s validací integrity
   */
  const removePoint = useCallback(
    (polygonId: string, pointIndex: number): boolean => {
      if (!segmentation) return false;

      // Use the consolidated polygonOperations utility
      const result = polygonOperations.removePointFromPolygon(segmentation, polygonId, pointIndex);

      if (!result) {
        console.error('Failed to remove point from polygon');
        return false;
      }

      setSegmentation(result);
      return true;
    },
    [segmentation, setSegmentation],
  );

  /**
   * Duplikace bodu polygonu s validací integrity
   */
  const duplicatePoint = useCallback(
    (polygonId: string, pointIndex: number): boolean => {
      if (!segmentation) return false;

      // Use the consolidated polygonOperations utility
      const result = polygonOperations.duplicatePointInPolygon(segmentation, polygonId, pointIndex);

      if (!result) {
        console.error('Failed to duplicate point in polygon');
        return false;
      }

      setSegmentation(result);
      return true;
    },
    [segmentation, setSegmentation],
  );

  return {
    addPoint,
    removePoint,
    duplicatePoint,
  };
};
