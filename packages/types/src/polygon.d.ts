/**
 * Types related to polygons and geometric objects
 */
export interface Point {
    x: number;
    y: number;
}
export interface Polygon {
    id: string;
    points: Point[];
    type?: 'external' | 'internal';
    class?: string;
    color?: string;
    parentId?: string;
    [key: string]: unknown;
}
export interface VertexHoverInfo {
    polygonId: string | null;
    vertexIndex: number | null;
}
export interface VertexDragInfo {
    polygonId: string | null;
    vertexIndex: number | null;
    isDragging: boolean;
}
export interface DragInfo {
    isDragging: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
}
export interface TempPointsInfo {
    points: Point[];
    polygonId?: string | null;
    startIndex?: number | null;
    endIndex?: number | null;
}
export interface TransformState {
    zoom: number;
    translateX: number;
    translateY: number;
}
export declare enum EditMode {
    View = "VIEW",
    Edit = "EDIT",
    Slice = "SLICE",
    PointAdding = "POINT_ADDING"
}
export interface InteractionState {
    isDraggingVertex: boolean;
    isPanning: boolean;
    panStart: Point | null;
    draggedVertexInfo: {
        polygonId: string;
        vertexIndex: number;
        originalPoint: Point;
    } | null;
    sliceStartPoint: Point | null;
}
