import { Point, Polygon } from '../types';
import { slicePolygon as sharedSlicePolygon } from '@shared/utils/polygonSlicingUtils';

interface LineSegment {
    start: Point;
    end: Point;
}

/**
 * Creates two new polygons by slicing an existing polygon along a line
 * This is a wrapper around the shared utility function
 */
export const slicePolygon = (polygon: Polygon, sliceLine: LineSegment): Polygon[] => {
    const result = sharedSlicePolygon(
        {
            id: polygon.id,
            points: polygon.points,
            type: 'external',
            ...polygon
        },
        sliceLine.start,
        sliceLine.end
    );

    if (result === null) {
        return [polygon]; // Return original polygon if slicing failed
    }

    // Return the two new polygons
    return result;
};