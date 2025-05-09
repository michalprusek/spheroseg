import { SegmentationData } from '../../useSegmentationV2'; // Correct path relative to actions/
import { Point } from '@/types';
import { useCallback } from 'react';

export const usePathModification = (
    // Note: Removed segmentationData from params as it wasn't used directly
    // If needed later, add it back.
    setSegmentationData: (updater: (prevData: SegmentationData | null) => SegmentationData | null) => void
) => {

    const addPointToPolygon = useCallback((polygonId: string, point: Point) => {
        console.log(`[PathMod] Adding point to polygon ${polygonId}`, point);
        setSegmentationData(prevData => {
            if (!prevData) return null;
            return {
                ...prevData,
                polygons: prevData.polygons.map(p =>
                    p.id === polygonId
                        ? { ...p, points: [...p.points, point] }
                        : p
                ),
            };
        });
    }, [setSegmentationData]);

    const insertPointIntoSegment = useCallback((polygonId: string, segmentIndex: number, point: Point) => {
         console.log(`[PathMod] Inserting point into polygon ${polygonId} at segment ${segmentIndex}`, point);
        setSegmentationData(prevData => {
            if (!prevData) return null;
            const polygons = prevData.polygons.map(p => {
                if (p.id === polygonId) {
                     if (segmentIndex < 0 || segmentIndex >= p.points.length) {
                         console.error(`[PathMod] Invalid segment index ${segmentIndex} for polygon ${polygonId} with ${p.points.length} points.`);
                         return p; // Return unchanged polygon if index is invalid
                     }
                    const newPoints = [...p.points];
                    // Insert the point *after* the vertex at segmentIndex
                    newPoints.splice(segmentIndex + 1, 0, point);
                    return { ...p, points: newPoints };
                }
                return p;
            });
            // Log the updated polygon structure for debugging
            const updatedPolygon = polygons.find(p => p.id === polygonId);
            console.log('[PathMod] Updated polygon points:', updatedPolygon?.points);

            return { ...prevData, polygons };
        });
    }, [setSegmentationData]);


    const removePointFromPolygon = useCallback((polygonId: string, pointIndex: number) => {
        console.log(`[PathMod] Removing point ${pointIndex} from polygon ${polygonId}`);
        setSegmentationData(prevData => {
            if (!prevData) return null;
            const targetPolygon = prevData.polygons.find(p => p.id === polygonId);

            if (!targetPolygon) {
                console.warn(`[PathMod] Polygon ${polygonId} not found for point removal.`);
                return prevData;
            }

            // Prevent deleting if it results in less than 3 points (invalid polygon)
            if (targetPolygon.points.length <= 3) {
                console.warn("[PathMod] Cannot remove vertex, polygon must have at least 3 points.");
                return prevData;
            }

            if (pointIndex < 0 || pointIndex >= targetPolygon.points.length) {
                console.error(`[PathMod] Invalid point index ${pointIndex} for polygon ${polygonId} with ${targetPolygon.points.length} points.`);
                return prevData;
            }

            const newPolygons = prevData.polygons.map(p => {
                if (p.id === polygonId) {
                    const newPoints = [...p.points];
                    newPoints.splice(pointIndex, 1);
                    return { ...p, points: newPoints };
                }
                return p;
            });
            // Note: We are not filtering polygons that become invalid here, assumes higher-level logic handles it or it's desired.
            return { ...prevData, polygons: newPolygons };
        });
    }, [setSegmentationData]);


    return {
        addPointToPolygon,
        insertPointIntoSegment,
        removePointFromPolygon,
    };
};
