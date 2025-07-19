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
import { Point } from '@spheroseg/types';
export type { Point } from '@spheroseg/types';
/**
 * Interface representing a bounding box
 */
export interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
/**
 * Alternative bounding box format (for compatibility)
 */
export interface BoundingBoxRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * Generic Polygon interface
 */
export interface Polygon {
    id: string;
    points: Point[];
    type?: 'external' | 'internal';
    [key: string]: unknown;
}
/**
 * Intersection interface used for polygon slicing
 */
export interface Intersection extends Point {
    edgeIndex: number;
    distance?: number;
}
/**
 * Metrics interface for polygon measurements
 */
export interface PolygonMetrics {
    area: number;
    perimeter: number;
    circularity: number;
    equivalentDiameter: number;
    aspectRatio: number;
    solidity: number;
    convexity: number;
    compactness: number;
    sphericity: number;
    feretDiameter: {
        max: number;
        min: number;
        angle: number;
    };
    centroid: Point;
}
/**
 * Worker message types for WebWorker operations
 */
export interface WorkerRequest {
    id: string;
    operation: string;
    data: Record<string, unknown>;
}
export interface WorkerResponse {
    id: string;
    operation: string;
    result: unknown;
    error?: string;
}
/**
 * Interface for the polygon worker
 */
export interface PolygonWorker {
    isReady: boolean;
    calculatePolygonArea: (points: Point[]) => Promise<number>;
    calculatePolygonPerimeter: (points: Point[]) => Promise<number>;
    calculateBoundingBox: (points: Point[]) => Promise<BoundingBox | null>;
}
/**
 * Calculate the distance between two points
 * @param p1 First point
 * @param p2 Second point
 * @returns Distance between the points
 */
export declare const distance: (p1: Point, p2: Point) => number;
/**
 * Calculate the bounding box of a polygon
 * @param points Array of points defining the polygon
 * @returns Bounding box of the polygon
 */
export declare const calculateBoundingBox: (points: Point[]) => BoundingBox;
/**
 * Calculate the bounding box in rect format (x, y, width, height)
 * @param points Array of points defining the polygon
 * @returns Bounding box in rect format
 */
export declare const calculateBoundingBoxRect: (points: Point[]) => BoundingBoxRect;
/**
 * Calculate polygon area using the Shoelace formula
 * @param points Array of points defining the polygon
 * @returns Area of the polygon
 */
export declare const calculatePolygonArea: (points: Point[]) => number;
/**
 * Calculate polygon perimeter
 * @param points Array of points defining the polygon
 * @returns Perimeter of the polygon
 */
export declare const calculatePolygonPerimeter: (points: Point[]) => number;
/**
 * Calculate the centroid of a polygon
 * @param points Array of points defining the polygon
 * @returns Centroid of the polygon
 */
export declare const calculateCentroid: (points: Point[]) => Point;
/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param point Point to check
 * @param polygon Array of points defining the polygon
 * @returns True if the point is inside the polygon, false otherwise
 */
export declare const isPointInPolygon: (point: Point, polygon: Point[]) => boolean;
/**
 * Check if a point is inside a polygon (alternative signature for compatibility)
 * @param x X coordinate of the point
 * @param y Y coordinate of the point
 * @param points Array of points defining the polygon
 * @returns True if the point is inside the polygon, false otherwise
 */
export declare const isPointInPolygonXY: (x: number, y: number, points: Point[]) => boolean;
/**
 * Determines which side of a line a point falls on
 * @param point Point to check
 * @param lineStart Start point of the line
 * @param lineEnd End point of the line
 * @returns Positive value if point is on one side, negative if on the other, 0 if on the line
 */
export declare const getPointSideOfLine: (point: Point, lineStart: Point, lineEnd: Point) => number;
/**
 * Calculate perpendicular distance from a point to a line segment
 * @param point Point to calculate distance from
 * @param lineStart Start point of the line segment
 * @param lineEnd End point of the line segment
 * @returns Perpendicular distance from the point to the line segment
 */
export declare const perpendicularDistance: (point: Point, lineStart: Point, lineEnd: Point) => number;
/**
 * Calculate the intersection point of two line segments
 * @param p1 Start point of the first line segment
 * @param p2 End point of the first line segment
 * @param p3 Start point of the second line segment
 * @param p4 End point of the second line segment
 * @returns Intersection point or null if the lines don't intersect
 */
export declare const calculateIntersection: (p1: Point, p2: Point, p3: Point, p4: Point) => Point | null;
/**
 * Calculate the intersection point of an infinite line with a line segment
 * Used for polygon slicing where the slice line extends infinitely
 * @param lineStart Start point of the infinite line
 * @param lineEnd End point of the infinite line (defines direction)
 * @param segStart Start point of the line segment
 * @param segEnd End point of the line segment
 * @returns Intersection point or null if the lines don't intersect
 */
export declare const calculateLineSegmentIntersection: (lineStart: Point, lineEnd: Point, segStart: Point, segEnd: Point) => Point | null;
/**
 * Calculate all intersection points between a line and a polygon
 * @param lineStart Start point of the line
 * @param lineEnd End point of the line
 * @param polygon Array of points defining the polygon
 * @returns Array of intersection points with edge indices and distances
 */
export declare const calculateLinePolygonIntersections: (lineStart: Point, lineEnd: Point, polygon: Point[]) => Intersection[];
/**
 * Calculate the convex hull of a set of points using the Graham scan algorithm
 * @param points Array of points
 * @returns Array of points defining the convex hull
 */
export declare const calculateConvexHull: (points: Point[]) => Point[];
/**
 * Determine if a polygon is oriented clockwise
 * @param points Array of points defining the polygon
 * @returns True if the polygon is oriented clockwise, false otherwise
 */
export declare const isClockwise: (points: Point[]) => boolean;
/**
 * Ensure a polygon is oriented clockwise
 * @param points Array of points defining the polygon
 * @returns Array of points with clockwise orientation
 */
export declare const ensureClockwise: (points: Point[]) => Point[];
/**
 * Ensure a polygon is oriented counter-clockwise
 * @param points Array of points defining the polygon
 * @returns Array of points with counter-clockwise orientation
 */
export declare const ensureCounterClockwise: (points: Point[]) => Point[];
/**
 * Slice a polygon with a line, returning two new polygons
 * @param polygon Array of points defining the polygon
 * @param sliceStart Start point of the slice line
 * @param sliceEnd End point of the slice line
 * @returns Array of sliced polygons (0, 1, or 2 polygons)
 */
export declare const slicePolygon: (polygon: Point[], sliceStart: Point, sliceEnd: Point) => Point[][];
/**
 * Slice a polygon object, returning new polygon objects
 * @param polygon Polygon object to slice
 * @param sliceStart Start point of the slice line
 * @param sliceEnd End point of the slice line
 * @returns Object with success flag and resulting polygons
 */
export declare const slicePolygonObject: (polygon: Polygon, sliceStart: Point, sliceEnd: Point) => {
    success: boolean;
    polygons: Polygon[];
};
/**
 * Simplify a polygon using the Ramer-Douglas-Peucker algorithm
 * @param points Array of points defining the polygon
 * @param epsilon Epsilon value for simplification (higher values = more simplification)
 * @returns Simplified array of points
 */
export declare const simplifyPolygon: (points: Point[], epsilon?: number) => Point[];
/**
 * Simplify a closed polygon using the Ramer-Douglas-Peucker algorithm
 * @param points Array of points defining the closed polygon
 * @param epsilon Epsilon value for simplification (higher values = more simplification)
 * @returns Simplified array of points
 */
export declare const simplifyClosedPolygon: (points: Point[], epsilon: number) => Point[];
/**
 * Check if two polygons intersect
 * @param poly1 First polygon
 * @param poly2 Second polygon
 * @returns True if the polygons intersect, false otherwise
 */
export declare const doPolygonsIntersect: (poly1: Point[], poly2: Point[]) => boolean;
/**
 * Calculate the Feret diameter (maximum caliper diameter) of a polygon
 * @param points Array of points defining the polygon
 * @returns Object with maximum diameter, minimum diameter, and angle
 */
export declare const calculateFeretDiameter: (points: Point[]) => {
    max: number;
    min: number;
    angle: number;
};
/**
 * Calculate comprehensive metrics for a polygon
 * @param polygon External polygon
 * @param holes Array of internal polygons (holes)
 * @returns Object with calculated metrics
 */
export declare const calculateMetrics: (polygon: Polygon, holes?: Polygon[]) => PolygonMetrics;
/**
 * Check if a bounding box is visible in the viewport
 * @param box Bounding box to check
 * @param viewport Viewport bounding box
 * @param margin Margin to add to viewport (default: 100)
 * @returns True if the box is visible in the viewport
 */
export declare const isBoxVisible: (box: BoundingBox, viewport: BoundingBox, margin?: number) => boolean;
/**
 * Base function to execute polygon worker operations with error handling
 */
export declare const executePolygonWorkerOperation: <T>(points: Point[], polygonWorker: PolygonWorker, operation: (points: Point[]) => Promise<T>, _operationName: string, defaultValue: T) => Promise<T>;
/**
 * Calculate polygon area using WebWorker
 */
export declare const calculatePolygonAreaAsync: (points: Point[], polygonWorker: PolygonWorker) => Promise<number>;
/**
 * Calculate polygon perimeter using WebWorker
 */
export declare const calculatePolygonPerimeterAsync: (points: Point[], polygonWorker: PolygonWorker) => Promise<number>;
/**
 * Calculate bounding box using WebWorker
 */
export declare const calculateBoundingBoxAsync: (points: Point[], polygonWorker: PolygonWorker) => Promise<BoundingBox | null>;
/**
 * Memoize bounding box calculations for polygons
 */
export declare class PolygonBoundingBoxCache {
    private cache;
    getBoundingBox(polygonId: string, points: Point[]): BoundingBox;
    invalidate(polygonId: string): void;
    clear(): void;
    size(): number;
}
export declare const polygonBoundingBoxCache: PolygonBoundingBoxCache;
/**
 * Create a new polygon with a unique ID
 */
export declare const createPolygon: (points: Point[], type?: "external" | "internal", additionalProps?: Record<string, unknown>) => Polygon;
/**
 * Clone a polygon with a new ID
 */
export declare const clonePolygon: (polygon: Polygon) => Polygon;
/**
 * Validate polygon has minimum required points
 */
export declare const isValidPolygon: (points: Point[]) => boolean;
export declare const isPointInPolygonObj: (point: Point, polygon: Point[]) => boolean;
export declare const calculateLineIntersection: (p1: Point, p2: Point, p3: Point, p4: Point) => Point | null;
export declare const getBoundingBox: (points: Point[]) => BoundingBox;
export declare const getPolygonArea: (points: Point[]) => number;
export declare const getPolygonPerimeter: (points: Point[]) => number;
export declare const distanceToLineSegment: (point: Point, lineStart: Point, lineEnd: Point) => number;
declare const _default: {
    distance: (p1: Point, p2: Point) => number;
    calculateBoundingBox: (points: Point[]) => BoundingBox;
    calculateBoundingBoxRect: (points: Point[]) => BoundingBoxRect;
    calculatePolygonArea: (points: Point[]) => number;
    calculatePolygonPerimeter: (points: Point[]) => number;
    calculateCentroid: (points: Point[]) => Point;
    isPointInPolygon: (point: Point, polygon: Point[]) => boolean;
    isPointInPolygonXY: (x: number, y: number, points: Point[]) => boolean;
    isPointInPolygonObj: (point: Point, polygon: Point[]) => boolean;
    getPointSideOfLine: (point: Point, lineStart: Point, lineEnd: Point) => number;
    perpendicularDistance: (point: Point, lineStart: Point, lineEnd: Point) => number;
    distanceToLineSegment: (point: Point, lineStart: Point, lineEnd: Point) => number;
    calculateIntersection: (p1: Point, p2: Point, p3: Point, p4: Point) => Point | null;
    calculateLineIntersection: (p1: Point, p2: Point, p3: Point, p4: Point) => Point | null;
    calculateLinePolygonIntersections: (lineStart: Point, lineEnd: Point, polygon: Point[]) => Intersection[];
    calculateConvexHull: (points: Point[]) => Point[];
    isClockwise: (points: Point[]) => boolean;
    ensureClockwise: (points: Point[]) => Point[];
    ensureCounterClockwise: (points: Point[]) => Point[];
    slicePolygon: (polygon: Point[], sliceStart: Point, sliceEnd: Point) => Point[][];
    slicePolygonObject: (polygon: Polygon, sliceStart: Point, sliceEnd: Point) => {
        success: boolean;
        polygons: Polygon[];
    };
    simplifyPolygon: (points: Point[], epsilon?: number) => Point[];
    simplifyClosedPolygon: (points: Point[], epsilon: number) => Point[];
    doPolygonsIntersect: (poly1: Point[], poly2: Point[]) => boolean;
    calculateFeretDiameter: (points: Point[]) => {
        max: number;
        min: number;
        angle: number;
    };
    calculateMetrics: (polygon: Polygon, holes?: Polygon[]) => PolygonMetrics;
    isBoxVisible: (box: BoundingBox, viewport: BoundingBox, margin?: number) => boolean;
    calculatePolygonAreaAsync: (points: Point[], polygonWorker: PolygonWorker) => Promise<number>;
    calculatePolygonPerimeterAsync: (points: Point[], polygonWorker: PolygonWorker) => Promise<number>;
    calculateBoundingBoxAsync: (points: Point[], polygonWorker: PolygonWorker) => Promise<BoundingBox | null>;
    executePolygonWorkerOperation: <T>(points: Point[], polygonWorker: PolygonWorker, operation: (points: Point[]) => Promise<T>, _operationName: string, defaultValue: T) => Promise<T>;
    createPolygon: (points: Point[], type?: "external" | "internal", additionalProps?: Record<string, unknown>) => Polygon;
    clonePolygon: (polygon: Polygon) => Polygon;
    isValidPolygon: (points: Point[]) => boolean;
    polygonBoundingBoxCache: PolygonBoundingBoxCache;
};
export default _default;
//# sourceMappingURL=polygonUtils.unified.d.ts.map