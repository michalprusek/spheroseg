import { useState, useEffect, useCallback } from 'react';
import { Point } from '@/lib/segmentation';
import { TempPointsState } from '@/pages/segmentation/types';
import { getCanvasCoordinates, screenToImageCoordinates } from '../coordinateUtils';

/**
 * Hook for managing temporary points during edit mode
 */
export const useTempPoints = (
  editMode: boolean,
  zoom: number = 1,
  offset: { x: number; y: number } = { x: 0, y: 0 },
) => {
  const [tempPoints, setTempPoints] = useState<TempPointsState>({
    points: [],
    startIndex: null,
    endIndex: null,
    polygonId: null,
  });

  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  // Sledování pozice kurzoru pro editační režim
  useEffect(() => {
    if (!editMode) {
      setCursorPosition(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Use getCanvasCoordinates from useCoordinateTransform
      const containerElement = document.querySelector('[data-testid="canvas-container"]') as HTMLElement;
      if (!containerElement) return;
      const rect = containerElement.getBoundingClientRect();
      const { x, y } = getCanvasCoordinates(e.clientX, e.clientY, rect, zoom, offset);
      setCursorPosition({ x, y });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [editMode, zoom, offset, getCanvasCoordinates]);

  // Sledování klávesy Shift pro automatické přidávání bodů
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Funkce pro přidání bodu do dočasných bodů
  const addPointToTemp = useCallback((point: Point) => {
    setTempPoints((prev) => ({
      ...prev,
      points: [...prev.points, point],
    }));
  }, []);

  // Funkce pro reset dočasných bodů
  const resetTempPoints = useCallback(() => {
    setTempPoints({
      points: [],
      startIndex: null,
      endIndex: null,
      polygonId: null,
    });
  }, []);

  return {
    tempPoints,
    setTempPoints,
    cursorPosition,
    resetTempPoints,
    addPointToTemp,
    isShiftPressed,
  };
};
