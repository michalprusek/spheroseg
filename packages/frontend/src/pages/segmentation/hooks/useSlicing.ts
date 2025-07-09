import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Point, Polygon } from '@/lib/segmentation';
import { slicePolygon as slicePolygonUtil } from '../utils/slicePolygon';
import { EditMode } from './segmentation';

interface UseSlicingProps {
  segmentationData: { polygons: Polygon[] } | null;
  setSegmentationData: (data: { polygons: Polygon[] }, clearHistory?: boolean) => void;
  selectedPolygonId: string | null;
  setSelectedPolygonId: (id: string | null) => void;
  tempPoints: Point[];
  setTempPoints: (points: Point[]) => void;
  setInteractionState: (state: any) => void;
  setEditMode?: (mode: EditMode) => void; // Optional to maintain backward compatibility
}

/**
 * Hook for handling polygon slicing functionality
 */
export function useSlicing({
  segmentationData,
  setSegmentationData,
  selectedPolygonId,
  setSelectedPolygonId,
  tempPoints,
  setTempPoints,
  setInteractionState,
  setEditMode,
}: UseSlicingProps) {
  const { t } = useTranslation();

  /**
   * Handle the slice action when two points have been selected
   * @returns boolean indicating if the slice was successful
   */
  const handleSliceAction = useCallback(() => {
    if (!selectedPolygonId || tempPoints.length !== 2 || !segmentationData) {
      console.log('Cannot slice: missing data', {
        selectedPolygonId,
        tempPointsLength: tempPoints.length,
      });
      return false;
    }

    const polygon = segmentationData.polygons.find((p) => p.id === selectedPolygonId);
    if (!polygon) {
      console.error('Polygon not found:', selectedPolygonId);
      toast.error(t('segmentation.polygonNotFound') || 'Polygon not found');
      return false;
    }

    console.log('[handleSliceAction] Attempting to slice polygon:', {
      polygonId: polygon.id,
      polygonPoints: polygon.points.length,
      sliceStart: tempPoints[0],
      sliceEnd: tempPoints[1],
      polygonBounds: {
        minX: Math.min(...polygon.points.map((p) => p.x)),
        maxX: Math.max(...polygon.points.map((p) => p.x)),
        minY: Math.min(...polygon.points.map((p) => p.y)),
        maxY: Math.max(...polygon.points.map((p) => p.y)),
      },
    });

    // Call the slice function with the selected polygon and slice points
    const result = slicePolygonUtil(polygon, tempPoints[0], tempPoints[1]);

    if (result) {
      const [newPolygon1, newPolygon2] = result;

      // Replace the original polygon with the two new ones
      const updatedPolygons = segmentationData.polygons.filter((p) => p.id !== selectedPolygonId);
      updatedPolygons.push(newPolygon1, newPolygon2);

      // Update segmentation data with history
      setSegmentationData(
        {
          ...segmentationData,
          polygons: updatedPolygons,
        },
        false,
      ); // false = don't clear history

      // Clear selection
      setSelectedPolygonId(null);

      toast.success(t('segmentation.polygonSliced') || 'Polygon sliced successfully');

      // Always reset temp points and slice start point
      setTempPoints([]);
      setInteractionState((prev) => ({
        ...prev,
        sliceStartPoint: null,
      }));

      // Reset edit mode to View after slicing
      if (setEditMode) {
        setEditMode(EditMode.View);
      }

      return true;
    } else {
      toast.error(t('segmentation.sliceFailed') || 'Failed to slice polygon');

      // Reset temp points on failure too
      setTempPoints([]);
      setInteractionState((prev) => ({
        ...prev,
        sliceStartPoint: null,
      }));

      return false;
    }
  }, [
    selectedPolygonId,
    tempPoints,
    segmentationData,
    setSegmentationData,
    setSelectedPolygonId,
    setTempPoints,
    setInteractionState,
    setEditMode,
    t,
  ]);

  return { handleSliceAction };
}
