/**
 * Polygon WASM Utilities
 *
 * Utilities for working with WebAssembly-based polygon operations
 */
export interface WasmPolygonModule {
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    HEAP8: Int8Array;
    HEAP16: Int16Array;
    HEAP32: Int32Array;
    HEAPU8: Uint8Array;
    HEAPU16: Uint16Array;
    HEAPU32: Uint32Array;
    HEAPF32: Float32Array;
    HEAPF64: Float64Array;
    _simplifyPolygon: (pointsPtr: number, numPoints: number, tolerance: number, resultPtr: number) => number;
    _splitPolygon: (pointsPtr: number, numPoints: number, lineStartX: number, lineStartY: number, lineEndX: number, lineEndY: number, result1Ptr: number, result2Ptr: number) => number;
    _calculatePolygonArea: (pointsPtr: number, numPoints: number) => number;
    _calculatePolygonPerimeter: (pointsPtr: number, numPoints: number) => number;
    _pointInPolygon: (pointX: number, pointY: number, polygonPtr: number, numPoints: number) => number;
}
export declare class PolygonWasmProcessor {
    private module;
    initialize(_wasmUrl: string): Promise<void>;
    isInitialized(): boolean;
    simplifyPolygon(points: Array<{
        x: number;
        y: number;
    }>, _tolerance: number): Array<{
        x: number;
        y: number;
    }>;
    splitPolygon(points: Array<{
        x: number;
        y: number;
    }>, _lineStart: {
        x: number;
        y: number;
    }, _lineEnd: {
        x: number;
        y: number;
    }): [Array<{
        x: number;
        y: number;
    }>, Array<{
        x: number;
        y: number;
    }>] | null;
    calculateArea(points: Array<{
        x: number;
        y: number;
    }>): number;
    calculatePerimeter(points: Array<{
        x: number;
        y: number;
    }>): number;
    pointInPolygon(point: {
        x: number;
        y: number;
    }, polygon: Array<{
        x: number;
        y: number;
    }>): boolean;
    dispose(): void;
}
export declare const polygonWasmProcessor: PolygonWasmProcessor;
export declare const polygonWasm: PolygonWasmProcessor;
export declare function initializeWasm(wasmUrl?: string): Promise<void>;
export declare function isWasmInitialized(): boolean;
export declare function usePolygonWasm(): {
    load: () => Promise<void>;
    isPointInPolygon: (point: {
        x: number;
        y: number;
    }, polygon: Array<{
        x: number;
        y: number;
    }>) => boolean;
    distanceToSegment: (point: {
        x: number;
        y: number;
    }, segStart: {
        x: number;
        y: number;
    }, segEnd: {
        x: number;
        y: number;
    }) => number;
    calculateIntersection: () => null;
    calculatePolygonArea: (polygon: Array<{
        x: number;
        y: number;
    }>) => number;
    calculatePolygonPerimeter: (polygon: Array<{
        x: number;
        y: number;
    }>) => number;
    calculateBoundingBox: (polygon: Array<{
        x: number;
        y: number;
    }>) => {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } | null;
    doPolygonsIntersect: () => boolean;
};
export default polygonWasmProcessor;
//# sourceMappingURL=polygonWasmUtils.d.ts.map