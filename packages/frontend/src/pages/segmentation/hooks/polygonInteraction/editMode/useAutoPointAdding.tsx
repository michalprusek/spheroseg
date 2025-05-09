import { useState, useEffect, useCallback } from 'react';
import { Point } from '@/lib/segmentation';

interface AutoPointAddingProps {
  editMode: boolean;
  cursorPosition: Point | null;
  isShiftPressed: boolean;
  tempPoints: { points: Point[] };
  addPointToTemp: (point: Point) => void;
}

/**
 * Hook pro automatické přidávání bodů při držení klávesy Shift
 */
export const useAutoPointAdding = ({
  editMode,
  cursorPosition,
  isShiftPressed,
  tempPoints,
  addPointToTemp
}: AutoPointAddingProps) => {
  // Define the distance function locally
  const distance = useCallback((p1: Point, p2: Point): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }, []);

  const [lastAutoAddedPoint, setLastAutoAddedPoint] = useState<Point | null>(null);
  const MIN_DISTANCE_FOR_AUTO_POINT = 20; // Minimální vzdálenost pro automatické přidávání bodů

  // Automatické přidávání bodů při držení Shift
  useEffect(() => {
    console.log('[useAutoPointAdding Debug] Effect triggered.', { editMode, isShiftPressed, tempPointsLength: tempPoints.points.length, cursorPosition, lastAutoAddedPoint });
    if (!editMode || !cursorPosition || !isShiftPressed || 
        tempPoints.points.length === 0) {
      console.log('[useAutoPointAdding Debug] Conditions not met, resetting lastAutoAddedPoint.');
      setLastAutoAddedPoint(null);
      return;
    }
    
    const lastPoint = tempPoints.points[tempPoints.points.length - 1];
    const currentCursor = cursorPosition;
    
    // Pokud není nastaven poslední auto přidaný bod, nastavíme ho jako poslední bod v sekvenci
    if (!lastAutoAddedPoint) {
      setLastAutoAddedPoint(lastPoint);
      return;
    }
    
    // Zjistíme vzdálenost od posledního auto přidaného bodu k aktuálnímu kurzoru
    const dist = distance(lastAutoAddedPoint, currentCursor);
    
    // Pokud je vzdálenost větší než práh, přidáme nový bod
    if (dist >= MIN_DISTANCE_FOR_AUTO_POINT) {
      console.log(`[useAutoPointAdding Debug] Distance (${dist.toFixed(2)}) >= threshold (${MIN_DISTANCE_FOR_AUTO_POINT}). Adding point:`, currentCursor);
      addPointToTemp(currentCursor);
      setLastAutoAddedPoint(currentCursor);
    }
  }, [
    editMode, 
    cursorPosition, 
    isShiftPressed, 
    tempPoints.points, 
    addPointToTemp, 
    lastAutoAddedPoint, 
    distance
  ]);

  const resetLastAutoAddedPoint = useCallback(() => {
    setLastAutoAddedPoint(null);
  }, []);

  return {
    resetLastAutoAddedPoint
  };
};
