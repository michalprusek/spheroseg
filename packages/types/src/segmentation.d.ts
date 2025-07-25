/**
 * Segmentation specific types
 */
import { Polygon } from './polygon';
export type ImageStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'saving' | 'without_segmentation';
export declare enum SegmentationStatus {
    QUEUED = "queued",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    SAVING = "saving",
    WITHOUT_SEGMENTATION = "without_segmentation"
}
export interface SegmentationData {
    id: string;
    image_id?: string;
    imageId?: string;
    status?: ImageStatus;
    result_data?: {
        polygons: Polygon[];
        [key: string]: unknown;
    };
    polygons: Polygon[];
    created_at?: string;
    updated_at?: string;
    parameters?: {
        model?: string;
        threshold?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
export interface SegmentationResult {
    id: string;
    polygons: Polygon[];
    [key: string]: unknown;
}
export interface SegmentationResultData {
    polygons?: Polygon[];
    contours?: Array<Array<[number, number]>>;
    hierarchy?: Array<[number, number, number, number]>;
    imageWidth: number;
    imageHeight: number;
    metadata?: {
        source?: 'resunet' | 'api' | 'empty' | 'cv2';
        timestamp?: string;
        modelType?: string;
        [key: string]: unknown;
    };
}
export interface SegmentationApiResponse {
    image_id: string;
    status: ImageStatus;
    result_data?: SegmentationResultData | null;
    parameters?: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    error?: string | null;
}
export type CanvasSegmentationData = SegmentationResultData;
