
import { useCallback } from 'react';
import { SegmentationResult, Point } from '@/lib/segmentation';
import polygonOperations from '@/utils/polygonOperations';
import { toast } from 'sonner';

/**
 * Hook pro zjednodušení polygonů
 */
export const usePolygonSimplifier = (
  segmentation: SegmentationResult | null,
  setSegmentation: (seg: SegmentationResult | null) => void
) => {

  /**
   * Zjednodušení polygonu redukcí bodů
   */
  const simplifyPolygon = useCallback((
    polygonId: string,
    tolerance: number = 1.0
  ): boolean => {
    if (!segmentation) return false;

    const polygon = segmentation.polygons.find(p => p.id === polygonId);
    if (!polygon) return false;

    // Polygon musí mít alespoň 3 body
    if (polygon.points.length < 3) return false;

    // Use the consolidated polygonOperations utility
    const simplifiedPath = polygonOperations.simplifyPolygon(polygon.points, tolerance);

    // Musíme zachovat minimálně 3 body
    if (simplifiedPath.length < 3) {
      console.error('Zjednodušení by vedlo k příliš malému počtu bodů');
      return false;
    }

    // Aktualizujeme segmentaci
    const updatedPolygons = segmentation.polygons.map(p => {
      if (p.id === polygonId) {
        return {
          ...p,
          points: simplifiedPath
        };
      }
      return p;
    });

    setSegmentation({
      ...segmentation,
      polygons: updatedPolygons
    });

    return true;
  }, [segmentation, setSegmentation]);

  return {
    simplifyPolygon
  };
};
