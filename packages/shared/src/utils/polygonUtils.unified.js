"use strict";
/**
 * Unified Polygon Utilities
 *
 * This file provides a comprehensive set of polygon-related utilities,
 * consolidating all functions from across the codebase into a single module.
 *
 * Includes:
 * - Basic geometric calculations (area, perimeter, bounding box, centroid)
 * - Point-in-polygon tests
 * - Distance calculations
 * - Line-polygon intersections
 * - Polygon slicing and splitting
 * - Convex hull calculation
 * - Polygon orientation (clockwise/counter-clockwise)
 * - Polygon simplification algorithms
 * - Polygon intersection tests
 * - Feret diameter calculations
 * - Comprehensive polygon metrics
 * - WebWorker operations for performance
 * - Caching and optimization utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.distanceToLineSegment = exports.getPolygonPerimeter = exports.getPolygonArea = exports.getBoundingBox = exports.calculateLineIntersection = exports.isPointInPolygonObj = exports.isValidPolygon = exports.clonePolygon = exports.createPolygon = exports.polygonBoundingBoxCache = exports.PolygonBoundingBoxCache = exports.calculateBoundingBoxAsync = exports.calculatePolygonPerimeterAsync = exports.calculatePolygonAreaAsync = exports.executePolygonWorkerOperation = exports.isBoxVisible = exports.calculateMetrics = exports.calculateFeretDiameter = exports.doPolygonsIntersect = exports.simplifyClosedPolygon = exports.simplifyPolygon = exports.slicePolygonObject = exports.slicePolygon = exports.ensureCounterClockwise = exports.ensureClockwise = exports.isClockwise = exports.calculateConvexHull = exports.calculateLinePolygonIntersections = exports.calculateLineSegmentIntersection = exports.calculateIntersection = exports.perpendicularDistance = exports.getPointSideOfLine = exports.isPointInPolygonXY = exports.isPointInPolygon = exports.calculateCentroid = exports.calculatePolygonPerimeter = exports.calculatePolygonArea = exports.calculateBoundingBoxRect = exports.calculateBoundingBox = exports.distance = void 0;
const uuid_1 = require("uuid");
// =============================================================================
// BASIC GEOMETRIC CALCULATIONS
// =============================================================================
/**
 * Calculate the distance between two points
 * @param p1 First point
 * @param p2 Second point
 * @returns Distance between the points
 */
const distance = (p1, p2) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
};
exports.distance = distance;
/**
 * Calculate the bounding box of a polygon
 * @param points Array of points defining the polygon
 * @returns Bounding box of the polygon
 */
const calculateBoundingBox = (points) => {
    if (!points.length) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }
    return { minX, minY, maxX, maxY };
};
exports.calculateBoundingBox = calculateBoundingBox;
/**
 * Calculate the bounding box in rect format (x, y, width, height)
 * @param points Array of points defining the polygon
 * @returns Bounding box in rect format
 */
const calculateBoundingBoxRect = (points) => {
    const box = (0, exports.calculateBoundingBox)(points);
    return {
        x: box.minX,
        y: box.minY,
        width: box.maxX - box.minX,
        height: box.maxY - box.minY
    };
};
exports.calculateBoundingBoxRect = calculateBoundingBoxRect;
/**
 * Calculate polygon area using the Shoelace formula
 * @param points Array of points defining the polygon
 * @returns Area of the polygon
 */
const calculatePolygonArea = (points) => {
    if (points.length < 3)
        return 0;
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const pi = points[i];
        const pj = points[j];
        if (pi && pj) {
            area += pi.x * pj.y;
            area -= pj.x * pi.y;
        }
    }
    return Math.abs(area / 2);
};
exports.calculatePolygonArea = calculatePolygonArea;
/**
 * Calculate polygon perimeter
 * @param points Array of points defining the polygon
 * @returns Perimeter of the polygon
 */
const calculatePolygonPerimeter = (points) => {
    if (points.length < 2)
        return 0;
    let perimeter = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const p1 = points[i];
        const p2 = points[j];
        if (p1 && p2) {
            perimeter += (0, exports.distance)(p1, p2);
        }
    }
    return perimeter;
};
exports.calculatePolygonPerimeter = calculatePolygonPerimeter;
/**
 * Calculate the centroid of a polygon
 * @param points Array of points defining the polygon
 * @returns Centroid of the polygon
 */
const calculateCentroid = (points) => {
    let area = 0;
    let cx = 0;
    let cy = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const p1 = points[i];
        const p2 = points[j];
        if (p1 && p2) {
            const cross = p1.x * p2.y - p2.x * p1.y;
            area += cross;
            cx += (p1.x + p2.x) * cross;
            cy += (p1.y + p2.y) * cross;
        }
    }
    area /= 2;
    cx /= 6 * area;
    cy /= 6 * area;
    return { x: Math.abs(cx), y: Math.abs(cy) };
};
exports.calculateCentroid = calculateCentroid;
// =============================================================================
// POINT-IN-POLYGON AND LINE OPERATIONS
// =============================================================================
/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param point Point to check
 * @param polygon Array of points defining the polygon
 * @returns True if the point is inside the polygon, false otherwise
 */
const isPointInPolygon = (point, polygon) => {
    if (polygon.length < 3)
        return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const pi = polygon[i];
        const pj = polygon[j];
        if (!pi || !pj)
            continue;
        const xi = pi.x;
        const yi = pi.y;
        const xj = pj.x;
        const yj = pj.y;
        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect)
            inside = !inside;
    }
    return inside;
};
exports.isPointInPolygon = isPointInPolygon;
/**
 * Check if a point is inside a polygon (alternative signature for compatibility)
 * @param x X coordinate of the point
 * @param y Y coordinate of the point
 * @param points Array of points defining the polygon
 * @returns True if the point is inside the polygon, false otherwise
 */
const isPointInPolygonXY = (x, y, points) => {
    return (0, exports.isPointInPolygon)({ x, y }, points);
};
exports.isPointInPolygonXY = isPointInPolygonXY;
/**
 * Determines which side of a line a point falls on
 * @param point Point to check
 * @param lineStart Start point of the line
 * @param lineEnd End point of the line
 * @returns Positive value if point is on one side, negative if on the other, 0 if on the line
 */
const getPointSideOfLine = (point, lineStart, lineEnd) => {
    const value = (lineEnd.x - lineStart.x) * (point.y - lineStart.y) -
        (lineEnd.y - lineStart.y) * (point.x - lineStart.x);
    return value > 0 ? 1 : (value < 0 ? -1 : 0);
};
exports.getPointSideOfLine = getPointSideOfLine;
/**
 * Calculate perpendicular distance from a point to a line segment
 * @param point Point to calculate distance from
 * @param lineStart Start point of the line segment
 * @param lineEnd End point of the line segment
 * @returns Perpendicular distance from the point to the line segment
 */
const perpendicularDistance = (point, lineStart, lineEnd) => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lineLengthSquared = dx * dx + dy * dy;
    if (lineLengthSquared === 0) {
        return (0, exports.distance)(point, lineStart);
    }
    const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared));
    const projectionX = lineStart.x + t * dx;
    const projectionY = lineStart.y + t * dy;
    return (0, exports.distance)(point, { x: projectionX, y: projectionY });
};
exports.perpendicularDistance = perpendicularDistance;
// =============================================================================
// LINE INTERSECTION CALCULATIONS
// =============================================================================
/**
 * Calculate the intersection point of two line segments
 * @param p1 Start point of the first line segment
 * @param p2 End point of the first line segment
 * @param p3 Start point of the second line segment
 * @param p4 End point of the second line segment
 * @returns Intersection point or null if the lines don't intersect
 */
const calculateIntersection = (p1, p2, p3, p4) => {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;
    const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
    if (denominator === 0) {
        return null; // Lines are parallel
    }
    const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
    const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;
    // Check if intersection is within both line segments
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return {
            x: x1 + ua * (x2 - x1),
            y: y1 + ua * (y2 - y1)
        };
    }
    return null;
};
exports.calculateIntersection = calculateIntersection;
/**
 * Calculate the intersection point of an infinite line with a line segment
 * Used for polygon slicing where the slice line extends infinitely
 * @param lineStart Start point of the infinite line
 * @param lineEnd End point of the infinite line (defines direction)
 * @param segStart Start point of the line segment
 * @param segEnd End point of the line segment
 * @returns Intersection point or null if the lines don't intersect
 */
const calculateLineSegmentIntersection = (lineStart, lineEnd, segStart, segEnd) => {
    const x1 = lineStart.x, y1 = lineStart.y;
    const x2 = lineEnd.x, y2 = lineEnd.y;
    const x3 = segStart.x, y3 = segStart.y;
    const x4 = segEnd.x, y4 = segEnd.y;
    const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
    if (denominator === 0) {
        return null; // Lines are parallel
    }
    const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
    const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;
    // Only check if intersection is within the polygon edge segment (ub)
    // We treat the slice line as infinite, so we don't check ua bounds
    // The slice line extends infinitely in both directions
    if (ub >= 0 && ub <= 1) {
        const intersection = {
            x: x1 + ua * (x2 - x1),
            y: y1 + ua * (y2 - y1)
        };
        // Only log detailed info if explicitly enabled
        // Debug logging (disabled in production)
        // if (false) { // Set to true for debugging
        //   console.log('[calculateLineSegmentIntersection] Intersection found:', {
        //     ua,
        //     ub,
        //     intersection,
        //     lineStart,
        //     lineEnd,
        //     segStart,
        //     segEnd
        //   });
        // }
        return intersection;
    }
    // Debug logging (disabled in production)  
    // if (false) { // Set to true for debugging
    //   console.log('[calculateLineSegmentIntersection] No intersection:', {
    //     ua,
    //     ub,
    //     lineStart,
    //     lineEnd,
    //     segStart,
    //     segEnd
    //   });
    // }
    return null;
};
exports.calculateLineSegmentIntersection = calculateLineSegmentIntersection;
/**
 * Calculate all intersection points between a line and a polygon
 * @param lineStart Start point of the line
 * @param lineEnd End point of the line
 * @param polygon Array of points defining the polygon
 * @returns Array of intersection points with edge indices and distances
 */
const calculateLinePolygonIntersections = (lineStart, lineEnd, polygon) => {
    // Debug logging (disabled in production)
    // console.log('[calculateLinePolygonIntersections] Called with:', {
    //   lineStart,
    //   lineEnd,
    //   polygonPoints: polygon.length,
    //   polygonBounds: polygon.length > 0 ? {
    //     minX: Math.min(...polygon.map(p => p.x)),
    //     maxX: Math.max(...polygon.map(p => p.x)),
    //     minY: Math.min(...polygon.map(p => p.y)),
    //     maxY: Math.max(...polygon.map(p => p.y))
    //   } : null
    // });
    // Extend the line far beyond the polygon bounds to ensure intersections
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    if (lineLength === 0) {
        // Debug logging (disabled in production)
        // console.log('[calculateLinePolygonIntersections] Line has zero length, returning empty');
        return [];
    }
    // Normalize direction
    const dirX = dx / lineLength;
    const dirY = dy / lineLength;
    // Extend the line by a large factor (10000 units in each direction)
    const extendFactor = 10000;
    const extendedStart = {
        x: lineStart.x - dirX * extendFactor,
        y: lineStart.y - dirY * extendFactor
    };
    const extendedEnd = {
        x: lineEnd.x + dirX * extendFactor,
        y: lineEnd.y + dirY * extendFactor
    };
    // Debug logging (disabled in production)
    // console.log('[calculateLinePolygonIntersections] Extended line:', {
    //   original: { lineStart, lineEnd },
    //   extended: { extendedStart, extendedEnd }
    // });
    const intersections = [];
    for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        const p1 = polygon[i];
        const p2 = polygon[j];
        if (!p1 || !p2)
            continue;
        // Use the extended line for intersection calculation
        const intersection = (0, exports.calculateLineSegmentIntersection)(extendedStart, extendedEnd, p1, p2);
        if (intersection) {
            // Debug logging (disabled in production)
            // console.log(`[calculateLinePolygonIntersections] Found intersection at edge ${i}->>${j}:`, {
            //   intersection,
            //   edge: `(${polygon[i].x}, ${polygon[i].y}) -> (${polygon[j].x}, ${polygon[j].y})`
            // });
            // Calculate distance from line start for sorting
            const dist = (0, exports.distance)(lineStart, intersection);
            // Check for duplicates with small epsilon
            const epsilon = 0.0001;
            const isDuplicate = intersections.some(p => Math.abs(p.x - intersection.x) < epsilon &&
                Math.abs(p.y - intersection.y) < epsilon);
            if (!isDuplicate) {
                intersections.push({
                    x: intersection.x,
                    y: intersection.y,
                    edgeIndex: i,
                    distance: dist
                });
            }
        }
    }
    // Sort by distance from line start
    intersections.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return intersections;
};
exports.calculateLinePolygonIntersections = calculateLinePolygonIntersections;
// =============================================================================
// CONVEX HULL CALCULATION
// =============================================================================
/**
 * Calculate the convex hull of a set of points using the Graham scan algorithm
 * @param points Array of points
 * @returns Array of points defining the convex hull
 */
const calculateConvexHull = (points) => {
    if (points.length <= 3)
        return [...points];
    // Find the point with the lowest y-coordinate (and leftmost if tied)
    let lowestPoint = points[0];
    if (!lowestPoint)
        return [];
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        if (!p)
            continue;
        if (p.y < lowestPoint.y ||
            (p.y === lowestPoint.y && p.x < lowestPoint.x)) {
            lowestPoint = p;
        }
    }
    // Sort points by polar angle with respect to the lowest point
    const sortedPoints = [...points].sort((a, b) => {
        if (a === lowestPoint)
            return -1;
        if (b === lowestPoint)
            return 1;
        const angleA = Math.atan2(a.y - lowestPoint.y, a.x - lowestPoint.x);
        const angleB = Math.atan2(b.y - lowestPoint.y, b.x - lowestPoint.x);
        if (angleA === angleB) {
            // If angles are the same, sort by distance from the lowest point
            const distA = (0, exports.distance)(a, lowestPoint);
            const distB = (0, exports.distance)(b, lowestPoint);
            return distA - distB;
        }
        return angleA - angleB;
    });
    // Remove duplicates
    const uniquePoints = [];
    for (let i = 0; i < sortedPoints.length; i++) {
        const current = sortedPoints[i];
        const previous = i > 0 ? sortedPoints[i - 1] : undefined;
        if (!current)
            continue;
        if (i === 0 || !previous ||
            current.x !== previous.x ||
            current.y !== previous.y) {
            uniquePoints.push(current);
        }
    }
    // Graham scan algorithm
    if (uniquePoints.length < 3)
        return uniquePoints;
    const firstPoint = uniquePoints[0];
    const secondPoint = uniquePoints[1];
    if (!firstPoint || !secondPoint)
        return uniquePoints;
    const hull = [firstPoint, secondPoint];
    for (let i = 2; i < uniquePoints.length; i++) {
        while (hull.length >= 2) {
            const n = hull.length;
            const p1 = hull[n - 2];
            const p2 = hull[n - 1];
            const p3 = uniquePoints[i];
            if (!p1 || !p2 || !p3)
                break;
            // Calculate the cross product to determine if we make a right turn
            const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
            // If we make a right turn or go straight, pop the last point
            if (cross <= 0) {
                hull.pop();
            }
            else {
                break;
            }
        }
        const point = uniquePoints[i];
        if (point) {
            hull.push(point);
        }
    }
    return hull;
};
exports.calculateConvexHull = calculateConvexHull;
// =============================================================================
// POLYGON ORIENTATION
// =============================================================================
/**
 * Determine if a polygon is oriented clockwise
 * @param points Array of points defining the polygon
 * @returns True if the polygon is oriented clockwise, false otherwise
 */
const isClockwise = (points) => {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const p1 = points[i];
        const p2 = points[j];
        if (p1 && p2) {
            sum += (p2.x - p1.x) * (p2.y + p1.y);
        }
    }
    return sum > 0;
};
exports.isClockwise = isClockwise;
/**
 * Ensure a polygon is oriented clockwise
 * @param points Array of points defining the polygon
 * @returns Array of points with clockwise orientation
 */
const ensureClockwise = (points) => {
    if (!(0, exports.isClockwise)(points)) {
        return [...points].reverse();
    }
    return points;
};
exports.ensureClockwise = ensureClockwise;
/**
 * Ensure a polygon is oriented counter-clockwise
 * @param points Array of points defining the polygon
 * @returns Array of points with counter-clockwise orientation
 */
const ensureCounterClockwise = (points) => {
    if ((0, exports.isClockwise)(points)) {
        return [...points].reverse();
    }
    return points;
};
exports.ensureCounterClockwise = ensureCounterClockwise;
// =============================================================================
// POLYGON SLICING AND SPLITTING
// =============================================================================
/**
 * Slice a polygon with a line, returning two new polygons
 * @param polygon Array of points defining the polygon
 * @param sliceStart Start point of the slice line
 * @param sliceEnd End point of the slice line
 * @returns Array of sliced polygons (0, 1, or 2 polygons)
 */
const slicePolygon = (polygon, sliceStart, sliceEnd) => {
    // Debug logging (disabled in production)
    // console.log('[slicePolygon unified] Called with:', {
    //   polygonPoints: polygon.length,
    //   sliceStart,
    //   sliceEnd,
    //   polygonBounds: polygon.length > 0 ? {
    //     minX: Math.min(...polygon.map(p => p.x)),
    //     maxX: Math.max(...polygon.map(p => p.x)),
    //     minY: Math.min(...polygon.map(p => p.y)),
    //     maxY: Math.max(...polygon.map(p => p.y))
    //   } : null,
    //   firstFewPoints: polygon.slice(0, 5).map((p, i) => `[${i}]: (${p.x}, ${p.y})`)
    // });
    const intersections = (0, exports.calculateLinePolygonIntersections)(sliceStart, sliceEnd, polygon);
    // Debug logging (disabled in production)
    // console.log('[slicePolygon unified] Found intersections:', intersections.length, intersections);
    // Need exactly 2 intersections to slice properly
    if (intersections.length !== 2) {
        // Debug logging (disabled in production)
        // console.log('[slicePolygon unified] Wrong number of intersections, returning original polygon');
        return [polygon]; // Return original polygon
    }
    const [int1, int2] = intersections;
    if (!int1 || !int2) {
        return [polygon]; // Return original polygon if intersections are invalid
    }
    // Create two new polygons
    const poly1 = [];
    const poly2 = [];
    // Add first intersection
    poly1.push({ x: int1.x, y: int1.y });
    // Add points from first edge to second edge
    let currentIndex = (int1.edgeIndex + 1) % polygon.length;
    while (currentIndex !== (int2.edgeIndex + 1) % polygon.length) {
        const point = polygon[currentIndex];
        if (point) {
            poly1.push(point);
        }
        currentIndex = (currentIndex + 1) % polygon.length;
    }
    // Add second intersection
    poly1.push({ x: int2.x, y: int2.y });
    // Create second polygon with remaining points
    poly2.push({ x: int2.x, y: int2.y });
    currentIndex = (int2.edgeIndex + 1) % polygon.length;
    while (currentIndex !== (int1.edgeIndex + 1) % polygon.length) {
        const point = polygon[currentIndex];
        if (point) {
            poly2.push(point);
        }
        currentIndex = (currentIndex + 1) % polygon.length;
    }
    poly2.push({ x: int1.x, y: int1.y });
    // Filter out degenerate polygons (less than 3 points)
    const result = [];
    if (poly1.length >= 3)
        result.push(poly1);
    if (poly2.length >= 3)
        result.push(poly2);
    return result.length > 0 ? result : [polygon];
};
exports.slicePolygon = slicePolygon;
/**
 * Slice a polygon object, returning new polygon objects
 * @param polygon Polygon object to slice
 * @param sliceStart Start point of the slice line
 * @param sliceEnd End point of the slice line
 * @returns Object with success flag and resulting polygons
 */
const slicePolygonObject = (polygon, sliceStart, sliceEnd) => {
    const slicedPoints = (0, exports.slicePolygon)(polygon.points, sliceStart, sliceEnd);
    if (slicedPoints.length === 1 && slicedPoints[0] === polygon.points) {
        return { success: false, polygons: [] };
    }
    const polygons = slicedPoints.map((points, index) => ({
        id: index === 0 ? polygon.id : (0, uuid_1.v4)(),
        points,
        type: polygon.type || 'external',
        ...Object.fromEntries(Object.entries(polygon).filter(([key]) => !['id', 'points', 'type'].includes(key)))
    }));
    return { success: true, polygons };
};
exports.slicePolygonObject = slicePolygonObject;
// =============================================================================
// POLYGON SIMPLIFICATION
// =============================================================================
/**
 * Simplify a polygon using the Ramer-Douglas-Peucker algorithm
 * @param points Array of points defining the polygon
 * @param epsilon Epsilon value for simplification (higher values = more simplification)
 * @returns Simplified array of points
 */
const simplifyPolygon = (points, epsilon = 2.0) => {
    if (points.length <= 2)
        return points;
    // Find the point with the maximum distance
    let maxDistance = 0;
    let index = 0;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    if (!firstPoint || !lastPoint) {
        return points; // Return original if endpoints are invalid
    }
    for (let i = 1; i < points.length - 1; i++) {
        const p = points[i];
        if (!p)
            continue;
        const dist = (0, exports.perpendicularDistance)(p, firstPoint, lastPoint);
        if (dist > maxDistance) {
            maxDistance = dist;
            index = i;
        }
    }
    // If max distance is greater than epsilon, recursively simplify
    if (maxDistance > epsilon) {
        // Recursive case
        const firstHalf = (0, exports.simplifyPolygon)(points.slice(0, index + 1), epsilon);
        const secondHalf = (0, exports.simplifyPolygon)(points.slice(index), epsilon);
        // Concatenate the two halves (removing the duplicate point)
        return [...firstHalf.slice(0, -1), ...secondHalf];
    }
    else {
        // Base case
        return [firstPoint, lastPoint].filter((p) => p !== undefined);
    }
};
exports.simplifyPolygon = simplifyPolygon;
/**
 * Simplify a closed polygon using the Ramer-Douglas-Peucker algorithm
 * @param points Array of points defining the closed polygon
 * @param epsilon Epsilon value for simplification (higher values = more simplification)
 * @returns Simplified array of points
 */
const simplifyClosedPolygon = (points, epsilon) => {
    if (points.length <= 3)
        return points;
    // Find the point with the maximum distance from any other point
    let maxDistance = 0;
    let maxI = 0;
    // let maxJ = 0;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        if (!p1)
            continue;
        for (let j = i + 1; j < points.length; j++) {
            const p2 = points[j];
            if (!p2)
                continue;
            const dist = (0, exports.distance)(p1, p2);
            if (dist > maxDistance) {
                maxDistance = dist;
                maxI = i;
                // maxJ = j;
            }
        }
    }
    // Reorder the points to start at maxI and end at maxJ
    const reordered = [];
    for (let i = maxI; i < points.length; i++) {
        const p = points[i];
        if (p) {
            reordered.push(p);
        }
    }
    for (let i = 0; i < maxI; i++) {
        const p = points[i];
        if (p) {
            reordered.push(p);
        }
    }
    // Simplify the reordered points
    const simplified = (0, exports.simplifyPolygon)(reordered, epsilon);
    // Ensure the polygon is closed
    const firstPoint = simplified[0];
    const lastPoint = simplified[simplified.length - 1];
    if (simplified.length > 0 && firstPoint && lastPoint &&
        (firstPoint.x !== lastPoint.x ||
            firstPoint.y !== lastPoint.y)) {
        simplified.push({ ...firstPoint });
    }
    return simplified;
};
exports.simplifyClosedPolygon = simplifyClosedPolygon;
// =============================================================================
// POLYGON INTERSECTION
// =============================================================================
/**
 * Check if two polygons intersect
 * @param poly1 First polygon
 * @param poly2 Second polygon
 * @returns True if the polygons intersect, false otherwise
 */
const doPolygonsIntersect = (poly1, poly2) => {
    // Check if any point of poly1 is inside poly2
    for (const point of poly1) {
        if ((0, exports.isPointInPolygon)(point, poly2)) {
            return true;
        }
    }
    // Check if any point of poly2 is inside poly1
    for (const point of poly2) {
        if ((0, exports.isPointInPolygon)(point, poly1)) {
            return true;
        }
    }
    // Check if any edges intersect
    for (let i = 0; i < poly1.length; i++) {
        const j = (i + 1) % poly1.length;
        for (let k = 0; k < poly2.length; k++) {
            const l = (k + 1) % poly2.length;
            const p1i = poly1[i];
            const p1j = poly1[j];
            const p2k = poly2[k];
            const p2l = poly2[l];
            if (p1i && p1j && p2k && p2l && (0, exports.calculateIntersection)(p1i, p1j, p2k, p2l)) {
                return true;
            }
        }
    }
    return false;
};
exports.doPolygonsIntersect = doPolygonsIntersect;
// =============================================================================
// FERET DIAMETER
// =============================================================================
/**
 * Calculate the Feret diameter (maximum caliper diameter) of a polygon
 * @param points Array of points defining the polygon
 * @returns Object with maximum diameter, minimum diameter, and angle
 */
const calculateFeretDiameter = (points) => {
    if (points.length < 2) {
        return { max: 0, min: Infinity, angle: 0 };
    }
    let maxDiameter = 0;
    let maxAngle = 0;
    let minDiameter = Infinity;
    // Calculate the convex hull first
    const hull = (0, exports.calculateConvexHull)(points);
    // For each pair of points in the convex hull
    for (let i = 0; i < hull.length; i++) {
        const p1 = hull[i];
        if (!p1)
            continue;
        for (let j = i + 1; j < hull.length; j++) {
            const p2 = hull[j];
            if (!p2)
                continue;
            const dist = (0, exports.distance)(p1, p2);
            if (dist > maxDiameter) {
                maxDiameter = dist;
                maxAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            }
        }
    }
    // Calculate the minimum diameter (orthogonal to the maximum diameter)
    const orthogonalAngle = maxAngle + Math.PI / 2;
    const cosAngle = Math.cos(orthogonalAngle);
    const sinAngle = Math.sin(orthogonalAngle);
    // Project all points onto the orthogonal axis
    let minProj = Infinity;
    let maxProj = -Infinity;
    for (const point of hull) {
        const proj = point.x * cosAngle + point.y * sinAngle;
        minProj = Math.min(minProj, proj);
        maxProj = Math.max(maxProj, proj);
    }
    minDiameter = maxProj - minProj;
    return {
        max: maxDiameter,
        min: minDiameter,
        angle: maxAngle
    };
};
exports.calculateFeretDiameter = calculateFeretDiameter;
// =============================================================================
// COMPREHENSIVE METRICS
// =============================================================================
/**
 * Calculate comprehensive metrics for a polygon
 * @param polygon External polygon
 * @param holes Array of internal polygons (holes)
 * @returns Object with calculated metrics
 */
const calculateMetrics = (polygon, holes = []) => {
    try {
        // Calculate area of the external polygon
        const externalArea = (0, exports.calculatePolygonArea)(polygon.points);
        // Calculate area of holes
        let holesArea = 0;
        for (const hole of holes) {
            holesArea += (0, exports.calculatePolygonArea)(hole.points);
        }
        // Total area is external area minus holes area
        const area = externalArea - holesArea;
        // Calculate perimeter
        const perimeter = (0, exports.calculatePolygonPerimeter)(polygon.points);
        // Calculate circularity
        const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
        // Calculate equivalent diameter
        const equivalentDiameter = 2 * Math.sqrt(area / Math.PI);
        // Calculate bounding box
        const boundingBox = (0, exports.calculateBoundingBoxRect)(polygon.points);
        // Calculate aspect ratio
        const aspectRatio = boundingBox.width / boundingBox.height || 1;
        // Calculate convex hull
        const convexHull = (0, exports.calculateConvexHull)(polygon.points);
        // Calculate convex hull area
        const convexHullArea = (0, exports.calculatePolygonArea)(convexHull);
        // Calculate solidity
        const solidity = area / convexHullArea || 1;
        // Calculate convex hull perimeter
        const convexHullPerimeter = (0, exports.calculatePolygonPerimeter)(convexHull);
        // Calculate convexity
        const convexity = convexHullPerimeter / perimeter || 1;
        // Calculate compactness
        const compactness = (4 * Math.PI * area) / (perimeter * perimeter) || 1;
        // Calculate sphericity
        const sphericity = Math.sqrt(4 * Math.PI * area) / perimeter || 1;
        // Calculate Feret diameter
        const feretDiameter = (0, exports.calculateFeretDiameter)(polygon.points);
        // Calculate centroid
        const centroid = (0, exports.calculateCentroid)(polygon.points);
        return {
            area,
            perimeter,
            circularity,
            equivalentDiameter,
            aspectRatio,
            solidity,
            convexity,
            compactness,
            sphericity,
            feretDiameter,
            centroid
        };
    }
    catch (error) {
        // Debug logging (disabled in production)
        // console.error('Error calculating metrics:', error);
        // Return default metrics
        return {
            area: 0,
            perimeter: 0,
            circularity: 0,
            equivalentDiameter: 0,
            aspectRatio: 1,
            solidity: 1,
            convexity: 1,
            compactness: 1,
            sphericity: 1,
            feretDiameter: {
                max: 0,
                min: 0,
                angle: 0
            },
            centroid: { x: 0, y: 0 }
        };
    }
};
exports.calculateMetrics = calculateMetrics;
// =============================================================================
// VIEWPORT AND VISIBILITY
// =============================================================================
/**
 * Check if a bounding box is visible in the viewport
 * @param box Bounding box to check
 * @param viewport Viewport bounding box
 * @param margin Margin to add to viewport (default: 100)
 * @returns True if the box is visible in the viewport
 */
const isBoxVisible = (box, viewport, margin = 100) => {
    const viewportWithMargin = {
        minX: viewport.minX - margin,
        minY: viewport.minY - margin,
        maxX: viewport.maxX + margin,
        maxY: viewport.maxY + margin
    };
    return !(box.maxX < viewportWithMargin.minX ||
        box.minX > viewportWithMargin.maxX ||
        box.maxY < viewportWithMargin.minY ||
        box.minY > viewportWithMargin.maxY);
};
exports.isBoxVisible = isBoxVisible;
// =============================================================================
// WEBWORKER OPERATIONS
// =============================================================================
/**
 * Base function to execute polygon worker operations with error handling
 */
const executePolygonWorkerOperation = async (points, polygonWorker, operation, _operationName, defaultValue) => {
    try {
        if (!polygonWorker.isReady) {
            return defaultValue;
        }
        return await operation(points);
    }
    catch (error) {
        // Debug logging (disabled in production)
        // console.warn(`Polygon worker operation ${operationName} failed:`, error);
        return defaultValue;
    }
};
exports.executePolygonWorkerOperation = executePolygonWorkerOperation;
/**
 * Calculate polygon area using WebWorker
 */
const calculatePolygonAreaAsync = async (points, polygonWorker) => {
    return (0, exports.executePolygonWorkerOperation)(points, polygonWorker, (pts) => polygonWorker.calculatePolygonArea(pts), 'calculatePolygonAreaAsync', 0);
};
exports.calculatePolygonAreaAsync = calculatePolygonAreaAsync;
/**
 * Calculate polygon perimeter using WebWorker
 */
const calculatePolygonPerimeterAsync = async (points, polygonWorker) => {
    return (0, exports.executePolygonWorkerOperation)(points, polygonWorker, (pts) => polygonWorker.calculatePolygonPerimeter(pts), 'calculatePolygonPerimeterAsync', 0);
};
exports.calculatePolygonPerimeterAsync = calculatePolygonPerimeterAsync;
/**
 * Calculate bounding box using WebWorker
 */
const calculateBoundingBoxAsync = async (points, polygonWorker) => {
    return (0, exports.executePolygonWorkerOperation)(points, polygonWorker, (pts) => polygonWorker.calculateBoundingBox(pts), 'calculateBoundingBoxAsync', null);
};
exports.calculateBoundingBoxAsync = calculateBoundingBoxAsync;
// =============================================================================
// CACHING AND OPTIMIZATION
// =============================================================================
/**
 * Memoize bounding box calculations for polygons
 */
class PolygonBoundingBoxCache {
    constructor() {
        this.cache = new Map();
    }
    getBoundingBox(polygonId, points) {
        if (!this.cache.has(polygonId)) {
            this.cache.set(polygonId, (0, exports.calculateBoundingBox)(points));
        }
        return this.cache.get(polygonId);
    }
    invalidate(polygonId) {
        this.cache.delete(polygonId);
    }
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
}
exports.PolygonBoundingBoxCache = PolygonBoundingBoxCache;
// Create a singleton instance
exports.polygonBoundingBoxCache = new PolygonBoundingBoxCache();
// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
/**
 * Create a new polygon with a unique ID
 */
const createPolygon = (points, type = 'external', additionalProps = {}) => ({
    id: (0, uuid_1.v4)(),
    points,
    type,
    ...additionalProps
});
exports.createPolygon = createPolygon;
/**
 * Clone a polygon with a new ID
 */
const clonePolygon = (polygon) => ({
    ...polygon,
    id: (0, uuid_1.v4)(),
    points: [...polygon.points]
});
exports.clonePolygon = clonePolygon;
/**
 * Validate polygon has minimum required points
 */
const isValidPolygon = (points) => {
    return points.length >= 3;
};
exports.isValidPolygon = isValidPolygon;
// =============================================================================
// EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================
// Legacy function names for compatibility
exports.isPointInPolygonObj = exports.isPointInPolygon;
exports.calculateLineIntersection = exports.calculateIntersection;
exports.getBoundingBox = exports.calculateBoundingBox;
exports.getPolygonArea = exports.calculatePolygonArea;
exports.getPolygonPerimeter = exports.calculatePolygonPerimeter;
exports.distanceToLineSegment = exports.perpendicularDistance;
// Default export with all functions
exports.default = {
    // Basic calculations
    distance: exports.distance,
    calculateBoundingBox: exports.calculateBoundingBox,
    calculateBoundingBoxRect: exports.calculateBoundingBoxRect,
    calculatePolygonArea: exports.calculatePolygonArea,
    calculatePolygonPerimeter: exports.calculatePolygonPerimeter,
    calculateCentroid: exports.calculateCentroid,
    // Point operations
    isPointInPolygon: exports.isPointInPolygon,
    isPointInPolygonXY: exports.isPointInPolygonXY,
    isPointInPolygonObj: exports.isPointInPolygonObj,
    getPointSideOfLine: exports.getPointSideOfLine,
    perpendicularDistance: exports.perpendicularDistance,
    distanceToLineSegment: exports.distanceToLineSegment,
    // Line intersections
    calculateIntersection: exports.calculateIntersection,
    calculateLineIntersection: exports.calculateLineIntersection,
    calculateLinePolygonIntersections: exports.calculateLinePolygonIntersections,
    // Convex hull
    calculateConvexHull: exports.calculateConvexHull,
    // Orientation
    isClockwise: exports.isClockwise,
    ensureClockwise: exports.ensureClockwise,
    ensureCounterClockwise: exports.ensureCounterClockwise,
    // Polygon operations
    slicePolygon: exports.slicePolygon,
    slicePolygonObject: exports.slicePolygonObject,
    simplifyPolygon: exports.simplifyPolygon,
    simplifyClosedPolygon: exports.simplifyClosedPolygon,
    doPolygonsIntersect: exports.doPolygonsIntersect,
    // Metrics
    calculateFeretDiameter: exports.calculateFeretDiameter,
    calculateMetrics: exports.calculateMetrics,
    // Visibility
    isBoxVisible: exports.isBoxVisible,
    // WebWorker operations
    calculatePolygonAreaAsync: exports.calculatePolygonAreaAsync,
    calculatePolygonPerimeterAsync: exports.calculatePolygonPerimeterAsync,
    calculateBoundingBoxAsync: exports.calculateBoundingBoxAsync,
    executePolygonWorkerOperation: exports.executePolygonWorkerOperation,
    // Utilities
    createPolygon: exports.createPolygon,
    clonePolygon: exports.clonePolygon,
    isValidPolygon: exports.isValidPolygon,
    // Cache
    polygonBoundingBoxCache: exports.polygonBoundingBoxCache
};
//# sourceMappingURL=polygonUtils.unified.js.map