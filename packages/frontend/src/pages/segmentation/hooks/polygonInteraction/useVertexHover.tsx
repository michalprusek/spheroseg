import { useCallback } from 'react';
import { SegmentationResult } from '@/lib/segmentation';
import { useVertexDetection } from './useVertexDetection';
import { getCanvasCoordinates } from './coordinateUtils';

/**
 * Hook pro detekci najetí myši nad vertexy
 */
export const useVertexHover = (
  zoom: number,
  offset: { x: number; y: number },
  segmentation: SegmentationResult | null,
  hoveredVertex: { polygonId: string | null; vertexIndex: number | null },
  setHoveredVertex: (state: { polygonId: string | null; vertexIndex: number | null }) => void,
) => {
  const { isNearVertex } = useVertexDetection(zoom, offset);

  /**
   * Detekce a nastavení bodu pod kurzorem
   */
  const detectVertexHover = useCallback(
    (clientX: number, clientY: number, containerElement: HTMLElement): boolean => {
      if (!segmentation) return false;

      if (!containerElement) {
        console.error('[detectVertexHover] containerElement is undefined', {
          clientX,
          clientY,
        });
        return false;
      }

      const rect = containerElement.getBoundingClientRect();
      const { x, y, canvasX, canvasY } = getCanvasCoordinates(clientX, clientY, rect, zoom, offset);

      // Logování odstraněno pro lepší výkon

      let foundVertex = false;

      // Procházíme všechny polygony a jejich body
      for (const polygon of segmentation.polygons) {
        for (let i = 0; i < polygon.points.length; i++) {
          const point = polygon.points[i];

          // Použijeme větší detekční radius pro snazší výběr vertexu
          if (isNearVertex(x, y, point, 15)) {
            if (hoveredVertex.polygonId !== polygon.id || hoveredVertex.vertexIndex !== i) {
              setHoveredVertex({
                polygonId: polygon.id,
                vertexIndex: i,
              });
            }
            containerElement.style.cursor = 'grab';
            foundVertex = true;
            return true;
          }
        }
      }

      // Pokud jsme nenašli žádný bod pod kurzorem, resetujeme stav
      if (!foundVertex && (hoveredVertex.polygonId !== null || hoveredVertex.vertexIndex !== null)) {
        setHoveredVertex({ polygonId: null, vertexIndex: null });
        containerElement.style.cursor = 'move';
      }

      return foundVertex;
    },
    [segmentation, hoveredVertex, setHoveredVertex, isNearVertex, getCanvasCoordinates],
  );

  return { detectVertexHover };
};
