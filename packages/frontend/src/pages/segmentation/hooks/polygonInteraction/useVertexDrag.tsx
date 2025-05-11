import { useCallback, useRef } from 'react';
import { SegmentationResult, Point } from '@/lib/segmentation';
import { useVertexDetection } from './useVertexDetection';
import { useCoordinateTransform } from './useCoordinateTransform';

/**
 * Hook pro práci s přetahováním vertexů
 */
export const useVertexDrag = (
  zoom: number,
  offset: { x: number; y: number },
  segmentation: SegmentationResult | null,
  setSegmentation: (seg: SegmentationResult | null) => void,
  setSelectedPolygonId: (id: string | null) => void,
  vertexDragState: React.MutableRefObject<{
    isDragging: boolean;
    polygonId: string | null;
    vertexIndex: number | null;
  }>,
) => {
  const { isNearVertex } = useVertexDetection(zoom, offset);
  const { getImageCoordinates } = useCoordinateTransform(zoom, offset);

  // Store the initial vertex position for a proper undo action
  const initialVertexPosition = useRef<Point | null>(null);

  /**
   * Zpracování pohybu při tažení vertexu
   */
  const handleVertexDrag = useCallback(
    (e: React.MouseEvent, containerElement: HTMLElement): boolean => {
      if (!vertexDragState.current.isDragging || !segmentation) return false;

      const polygonId = vertexDragState.current.polygonId;
      const vertexIndex = vertexDragState.current.vertexIndex;

      if (polygonId !== null && vertexIndex !== null) {
        if (!containerElement) {
          console.error('[handleVertexDrag] containerElement is undefined', {
            e,
            polygonId,
            vertexIndex,
            segmentation,
          });
          return false;
        }
        const rect = containerElement.getBoundingClientRect();
        // Použijeme clientX a clientY přímo, aby pozice bodu odpovídala kurzoru
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const x = canvasX / zoom - offset.x;
        const y = canvasY / zoom - offset.y;

        // Aktualizace pozice bodu polygonu
        if (typeof setSegmentation === 'function') {
          setSegmentation({
            ...segmentation,
            polygons: segmentation.polygons.map((polygon) => {
              if (polygon.id === polygonId) {
                const points = [...polygon.points];
                points[vertexIndex] = { x, y };
                return { ...polygon, points };
              }
              return polygon;
            }),
          });
        }

        // Aktualizujeme kurzor
        containerElement.style.cursor = 'grabbing';
        return true;
      }

      return false;
    },
    [segmentation, setSegmentation, zoom, offset],
  );

  /**
   * Zpracování kliknutí na vertex
   */
  const handleVertexClick = useCallback(
    (clientX: number, clientY: number, containerElement: HTMLElement | null): boolean => {
      console.log('[handleVertexClick] ENTRY', {
        clientX,
        clientY,
        containerElement,
        segmentation,
        vertexDragState: vertexDragState?.current,
      });
      if (!segmentation) return false;

      if (!containerElement) {
        console.error('[handleVertexClick] containerElement is undefined', {
          clientX,
          clientY,
          segmentation,
        });
        return false;
      }
      console.log('[handleVertexClick] Accessing getBoundingClientRect on', {
        containerElement: containerElement ? 'defined' : 'undefined',
        containerElementType: containerElement ? containerElement.tagName : 'N/A',
        containerElementClass: containerElement ? containerElement.className : 'N/A',
        containerElementId: containerElement ? containerElement.id : 'N/A',
        containerElementRect: containerElement ? containerElement.getBoundingClientRect() : 'N/A',
      });
      const rect = containerElement.getBoundingClientRect();
      // Přepočet klientských souřadnic na souřadnice obrazu
      const canvasX = clientX - rect.left;
      const canvasY = clientY - rect.top;
      const x = canvasX / zoom - offset.x;
      const y = canvasY / zoom - offset.y;

      // Logování odstraněno pro lepší výkon

      // Nejprve zkontrolujeme, zda jsme klikli na bod polygonu
      for (const polygon of segmentation.polygons) {
        for (let i = 0; i < polygon.points.length; i++) {
          const point = polygon.points[i];

          // Používáme canvas souřadnice pro detekci
          const isNear = isNearVertex(canvasX, canvasY, point, 15);

          if (isNear) {
            // Store the initial position before dragging starts (for undo)
            initialVertexPosition.current = { ...point };

            // Nastavíme aktivní polygon a začneme tažení bodu
            setSelectedPolygonId(polygon.id);
            vertexDragState.current = {
              isDragging: true,
              polygonId: polygon.id,
              vertexIndex: i,
            };

            containerElement.style.cursor = 'grabbing';
            return true;
          }
        }
      }

      return false;
    },
    [segmentation, setSelectedPolygonId, isNearVertex, zoom, offset],
  );

  return {
    handleVertexDrag,
    handleVertexClick,
    initialVertexPosition,
  };
};
