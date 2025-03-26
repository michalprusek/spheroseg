
import { useCallback } from 'react';
import { SegmentationResult, Point } from '@/lib/segmentation';

interface VertexDetectionProps {
  pointAddingMode: boolean;
  segmentation: SegmentationResult | null;
  selectedVertexIndex: number | null;
  sourcePolygonId: string | null;
  setHoveredSegment: (segment: {
    polygonId: string | null,
    segmentIndex: number | null,
    projectedPoint: Point | null
  }) => void;
  distance: (p1: Point, p2: Point) => number;
}

/**
 * Hook pro detekci vrcholů polygonu při pohybu myši
 */
export const useVertexDetection = ({
  pointAddingMode,
  segmentation,
  selectedVertexIndex,
  sourcePolygonId,
  setHoveredSegment,
  distance
}: VertexDetectionProps) => {
  /**
   * Detekuje vrchol pod kurzorem
   */
  const detectVertexUnderCursor = useCallback((x: number, y: number) => {
    if (!pointAddingMode || !segmentation) {
      setHoveredSegment({
        polygonId: null,
        segmentIndex: null,
        projectedPoint: null
      });
      return;
    }
    
    const cursorPoint = { x, y };
    // Zvětšíme prahovou hodnotu pro snazší detekci bodů
    const DETECTION_THRESHOLD = 25; // Zvětšeno z 15 na 25
    
    console.log("detectVertexUnderCursor called with:", x, y, "sourcePolygonId:", sourcePolygonId, "selectedVertexIndex:", selectedVertexIndex);
    
    let closestVertex = {
      polygonId: null as string | null,
      vertexIndex: null as number | null,
      distance: Infinity
    };
    
    // Pokud máme vybraný polygonId, hledáme nejbližší vrchol pouze v tomto polygonu
    if (sourcePolygonId) {
      const polygon = segmentation.polygons.find(p => p.id === sourcePolygonId);
      
      if (polygon) {
        console.log("Checking vertices in polygon:", sourcePolygonId, "with", polygon.points.length, "points");
        polygon.points.forEach((point, index) => {
          // Přeskočíme počáteční bod, pokud je již vybrán
          if (selectedVertexIndex === index) {
            console.log("Skipping selected vertex:", index);
            return;
          }
          
          const dist = distance(point, cursorPoint);
          console.log("Checking vertex", index, "at", point.x, point.y, "dist:", dist);
          
          if (dist < DETECTION_THRESHOLD && dist < closestVertex.distance) {
            closestVertex = {
              polygonId: polygon.id,
              vertexIndex: index,
              distance: dist
            };
            console.log("Found closer vertex:", index, "with distance:", dist);
          }
        });
      }
    } 
    // Jinak prohledáváme všechny polygony
    else {
      segmentation.polygons.forEach(polygon => {
        polygon.points.forEach((point, index) => {
          const dist = distance(point, cursorPoint);
          
          if (dist < DETECTION_THRESHOLD && dist < closestVertex.distance) {
            closestVertex = {
              polygonId: polygon.id,
              vertexIndex: index,
              distance: dist
            };
          }
        });
      });
    }
    
    // Pokud jsme našli nějaký blízký vrchol, nastavíme ho jako zvýrazněný
    if (closestVertex.polygonId !== null && closestVertex.vertexIndex !== null) {
      const polygon = segmentation.polygons.find(p => p.id === closestVertex.polygonId);
      if (polygon) {
        const point = polygon.points[closestVertex.vertexIndex];
        console.log("Setting hovered segment:", closestVertex.polygonId, closestVertex.vertexIndex, point);
        
        setHoveredSegment({
          polygonId: closestVertex.polygonId,
          segmentIndex: closestVertex.vertexIndex,
          projectedPoint: point
        });
        return;
      }
    }
    
    // Pokud jsme nenašli žádný vrchol, resetujeme zvýrazněný segment
    setHoveredSegment({
      polygonId: null,
      segmentIndex: null,
      projectedPoint: null
    });
  }, [pointAddingMode, segmentation, sourcePolygonId, selectedVertexIndex, setHoveredSegment, distance]);

  return { detectVertexUnderCursor };
};
