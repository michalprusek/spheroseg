import { Point } from '@/types';
import { useCallback } from 'react';

// Basic distance between two points
const calculateDistance = (p1: Point, p2: Point): number => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// Calculates the squared distance between point p and the line segment defined by a and b.
// Also returns the parameter t for the closest point on the line segment (clamped between 0 and 1).
// And the closest point itself.
const pointLineSegmentDistanceSquared = (p: Point, a: Point, b: Point): { distanceSq: number; t: number; closestPoint: Point } => {
    const l2 = Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2);
    // If the segment has zero length, the distance is just the distance to the single point 'a'.
    if (l2 === 0) {
        const distSq = Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2);
        return { distanceSq: distSq, t: 0, closestPoint: { x: a.x, y: a.y } };
    }

    // Calculate the projection parameter t of the point p onto the line defined by a and b.
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;

    // Clamp t to the range [0, 1] to ensure the closest point lies on the segment.
    t = Math.max(0, Math.min(1, t));

    // Calculate the coordinates of the closest point on the segment.
    const closestPoint = {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
    };

    // Calculate the squared distance between the point p and the closest point on the segment.
    const distanceSq = Math.pow(p.x - closestPoint.x, 2) + Math.pow(p.y - closestPoint.y, 2);

    return { distanceSq, t, closestPoint };
};

// Calculate the length (perimeter) of a path defined by points
const calculatePathLengthImpl = (points: Point[], closed: boolean = true): number => {
    let length = 0;
    if (!points || points.length < 2) {
        return 0;
    }
    for (let i = 0; i < points.length - 1; i++) {
        length += calculateDistance(points[i], points[i + 1]);
    }
    // If closed, add distance between last and first point
    if (closed && points.length > 1) {
        length += calculateDistance(points[points.length - 1], points[0]);
    }
    return length;
};

// Check if a line segment defined by two points intersects itself
// For a single line segment [P1, P2], self-intersection isn't really possible
// unless P1 and P2 are the same point (zero length), which is checked elsewhere.
// This function might be a remnant or intended for polylines in other contexts.
const isLineIntersectingItselfImpl = (line: [Point, Point]): boolean => {
    // A simple line segment cannot intersect itself.
    return false; 
};

export const useGeometryUtils = () => {

    const distance = useCallback((p1: Point, p2: Point): number => {
        return calculateDistance(p1, p2);
    }, []);

    // Finds the distance from a point to a line segment defined by points a and b.
    const getPointToSegmentDistance = useCallback((point: Point, segStart: Point, segEnd: Point): { distance: number; closestPoint: Point; t: number } => {
        const { distanceSq, t, closestPoint } = pointLineSegmentDistanceSquared(point, segStart, segEnd);
        return { distance: Math.sqrt(distanceSq), closestPoint, t };
    }, []);

    // Finds the index of the segment closest to a given point in a polygon
    const findNearestSegment = useCallback((point: Point, polygonPoints: Point[]): { segmentIndex: number; distance: number; closestPointOnSegment: Point } | null => {
        if (!polygonPoints || polygonPoints.length < 2) {
            return null;
        }

        let minDistanceSq = Infinity;
        let closestSegmentIndex = -1;
        let overallClosestPoint: Point = { x: 0, y: 0 };

        for (let i = 0; i < polygonPoints.length; i++) {
            const p1 = polygonPoints[i];
            const p2 = polygonPoints[(i + 1) % polygonPoints.length]; // Wrap around for closed polygon

            const { distanceSq, closestPoint } = pointLineSegmentDistanceSquared(point, p1, p2);

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestSegmentIndex = i;
                overallClosestPoint = closestPoint;
            }
        }

        if (closestSegmentIndex !== -1) {
            return { segmentIndex: closestSegmentIndex, distance: Math.sqrt(minDistanceSq), closestPointOnSegment: overallClosestPoint };
        }

        return null;

    }, []);

    // Calculates the total length of a path (perimeter for closed path)
    const calculatePathLength = useCallback((points: Point[], closed: boolean = true): number => {
        return calculatePathLengthImpl(points, closed);
    }, []);

    // Placeholder check for line self-intersection (always false for a single segment)
    const isLineIntersectingItself = useCallback((line: [Point, Point]): boolean => {
        return isLineIntersectingItselfImpl(line);
    }, []);

    return {
        distance,
        getPointToSegmentDistance,
        findNearestSegment,
        calculatePathLength,
        isLineIntersectingItself,
    };
};
