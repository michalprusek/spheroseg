import { Point } from '@/lib/segmentation';
import { useCallback } from 'react';
import { SpatialGrid } from './utils/SpatialGrid';
import { useGeometryUtils } from './useGeometryUtils';

/**
 * Hook pro hledání nejbližšího segmentu polygonu k danému bodu.
 */
export const useSegmentFinder = () => {
  const { findNearestSegment: findNearestSegmentFromUtils, getPointToSegmentDistance } = useGeometryUtils();

  /**
   * Najde nejbližší segment polygonu k danému bodu a vrátí jeho index,
   * vzdálenost a projekci bodu na tento segment.
   *
   * @param polygonPoints Pole bodů tvořících polygon.
   * @param point Bod, ke kterému hledáme nejbližší segment.
   * @param threshold Maximální vzdálenost, do které segment považujeme za "blízký".
   * @param useOptimization Zda použít optimalizaci pomocí SpatialGrid pro velké polygony.
   * @returns Objekt s indexem segmentu, vzdáleností a projekcí, nebo null, pokud není žádný segment dostatečně blízko.
   */
  const findClosestSegment = useCallback(
    (
      polygonPoints: Point[],
      point: Point,
      threshold: number,
      useOptimization: boolean = true,
    ): { segmentIndex: number; distance: number; projectedPoint: Point } | null => {
      // For simple cases, use the utility from useGeometryUtils
      if (!useOptimization || polygonPoints.length < 50) {
        const nearest = findNearestSegmentFromUtils(point, polygonPoints);
        if (nearest && nearest.distance <= threshold) {
          return {
            segmentIndex: nearest.segmentIndex,
            distance: nearest.distance,
            projectedPoint: nearest.closestPointOnSegment,
          };
        }
        return null;
      }

      // For optimized cases with large polygons, use spatial grid
      let closestSegment = -1;
      let minDistance = Infinity;
      let closestProjection: Point = { x: 0, y: 0 };

      // Helper funkce pro kontrolu segmentu a aktualizaci nejbližšího
      const checkAndUpdateClosestSegment = (p1: Point, p2: Point, segmentIdx: number) => {
        const segmentResult = getPointToSegmentDistance(point, p1, p2);

        if (segmentResult.distance < minDistance) {
          minDistance = segmentResult.distance;
          closestSegment = segmentIdx;
          closestProjection = segmentResult.closestPoint;
        }
      };

      // We already handled the simple case above, so this is only for the optimized case
      // Optimalizace: Pro velké polygony použijeme prostorové indexování
      // Vytvoříme prostorovou mřížku
      const grid = new SpatialGrid(polygonPoints, 50); // Velikost buňky mřížky

      // Najdeme potenciální body v okolí
      const potentialPointsIndices = grid.findPointsInRadius(point, threshold * 2);
      const processedSegments = new Set<number>();

      // Kontrolujeme jen segmenty, jejichž alespoň jeden bod je blízko
      for (const pointIndex of potentialPointsIndices) {
        // Kontrolujeme segment začínající v tomto bodě (pointIndex -> nextIndex)
        const segmentIndex = pointIndex;
        if (!processedSegments.has(segmentIndex)) {
          processedSegments.add(segmentIndex);
          const nextIndex = (pointIndex + 1) % polygonPoints.length;
          checkAndUpdateClosestSegment(polygonPoints[pointIndex], polygonPoints[nextIndex], segmentIndex);
        }

        // Kontrolujeme segment končící v tomto bodě (prevIndex -> pointIndex)
        const prevIndex = (pointIndex - 1 + polygonPoints.length) % polygonPoints.length;
        if (!processedSegments.has(prevIndex)) {
          processedSegments.add(prevIndex);
          checkAndUpdateClosestSegment(polygonPoints[prevIndex], polygonPoints[pointIndex], prevIndex);
        }
      }

      // Vrátíme výsledek, pokud je nalezený segment dostatečně blízko
      if (minDistance <= threshold && closestSegment !== -1) {
        return { segmentIndex: closestSegment, distance: minDistance, projectedPoint: closestProjection };
      }

      return null;
    },
    [findNearestSegmentFromUtils, getPointToSegmentDistance],
  ); // Add dependencies

  return {
    findClosestSegment, // Only export the main function
  };
};
