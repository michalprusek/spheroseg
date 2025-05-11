import { useState, useCallback } from 'react';
import { SegmentationResult, Point } from '@/lib/segmentation';
import { toast } from 'sonner';
import { usePolygonSplitter } from '../geometry/usePolygonSplitter';
import { SliceOperation } from '../geometry/utils/polygonSplitter';

/**
 * Hook for polygon slicing mode
 */
export const useSlicingMode = (
  segmentation: SegmentationResult | null,
  setSegmentation: (seg: SegmentationResult | null) => void,
  selectedPolygonId: string | null,
) => {
  const [slicingMode, setSlicingMode] = useState(false);
  const [sliceStartPoint, setSliceStartPoint] = useState<Point | null>(null);
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);

  const { splitIntoTwoPolygons } = usePolygonSplitter(segmentation, setSegmentation);

  /**
   * Toggle slicing mode on/off
   */
  const toggleSlicingMode = useCallback(() => {
    setSlicingMode((prev) => !prev);
    setSliceStartPoint(null);
    setCursorPosition(null);
  }, []);

  /**
   * Update cursor position for slicing mode
   */
  const updateCursorPosition = useCallback(
    (x: number, y: number) => {
      if (!slicingMode) return;
      // Debug log to help diagnose coordinate transformation issues
      console.log(`Slicing cursor position: (${x.toFixed(2)}, ${y.toFixed(2)})`);
      setCursorPosition({ x, y });
    },
    [slicingMode],
  );

  /**
   * Handle clicks in slicing mode
   */
  const handleSlicingClick = useCallback(
    (x: number, y: number): boolean => {
      console.log('[handleSlicingClick Debug] Called.', {
        x,
        y,
        slicingMode,
        selectedPolygonId,
        sliceStartPoint,
      });
      if (!slicingMode || !selectedPolygonId) {
        console.log(`Slicing click ignored - mode: ${slicingMode}, selectedPolygonId: ${selectedPolygonId}`);
        return false;
      }

      const clickPoint = { x, y };
      console.log(`[SLICE DEBUG] Slicing click at: (${x.toFixed(2)}, ${y.toFixed(2)})`);

      // Log the selected polygon for debugging
      if (segmentation) {
        const polygon = segmentation.polygons.find((p) => p.id === selectedPolygonId);
        if (polygon) {
          console.log(`[SLICE DEBUG] Selected polygon: ${selectedPolygonId}, points: ${polygon.points.length}`);
        } else {
          console.warn(`[SLICE DEBUG] Selected polygon ${selectedPolygonId} not found in segmentation!`);
        }
      }

      // First click - set start point
      if (!sliceStartPoint) {
        console.log('[handleSlicingClick Debug] First slice point set.');
        setSliceStartPoint(clickPoint);
        console.log(`[SLICE DEBUG] Set slice start point: (${x.toFixed(2)}, ${y.toFixed(2)})`);
        console.log(`[SLICE DEBUG] Waiting for second click to complete slice...`);
        return true;
      }

      // Second click - complete slice and split into two polygons
      console.log('[handleSlicingClick Debug] Second slice point set. Attempting split.');
      console.log(`[SLICE DEBUG] Second click at: (${x.toFixed(2)}, ${y.toFixed(2)})`);
      console.log(
        `[SLICE DEBUG] Attempting to slice from (${sliceStartPoint.x.toFixed(2)}, ${sliceStartPoint.y.toFixed(2)}) to (${x.toFixed(2)}, ${y.toFixed(2)})`,
      );

      // Calculate line length for debugging
      const dx = x - sliceStartPoint.x;
      const dy = y - sliceStartPoint.y;
      const lineLength = Math.sqrt(dx * dx + dy * dy);
      console.log(`[SLICE DEBUG] Slice line length: ${lineLength.toFixed(2)} pixels`);

      const operation: SliceOperation = {
        polygonId: selectedPolygonId,
        startPoint: sliceStartPoint,
        endPoint: clickPoint,
      };

      console.log('[handleSlicingClick Debug] Calling splitIntoTwoPolygons with operation:', operation);
      const success = splitIntoTwoPolygons(operation);
      console.log('[handleSlicingClick Debug] splitIntoTwoPolygons result:', success);

      if (success) {
        console.log(`[SLICE DEBUG] Slice operation successful!`);
        toast.success('Polygon byl úspěšně rozdělen na dva');
        // Reset state and exit slicing mode automatically
        setSliceStartPoint(null);
        setSlicingMode(false);
      } else {
        console.error(`[SLICE DEBUG] Slice operation failed!`);
        toast.error('Rozdělení polygonu selhalo');
        setSliceStartPoint(null);
      }

      return true;
    },
    [slicingMode, selectedPolygonId, sliceStartPoint, splitIntoTwoPolygons, segmentation],
  );

  return {
    slicingMode,
    sliceStartPoint,
    cursorPosition,
    toggleSlicingMode,
    handleSlicingClick,
    updateCursorPosition,
    setSlicingMode, // Export this to allow other components to directly change slicing mode
  };
};
