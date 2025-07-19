/**
 * Upload Strategy Pattern Implementation
 *
 * Provides different upload strategies for various file types and scenarios
 */
import type { UploadOptions, UploadResult, ChunkInfo } from './types';
export interface UploadStrategy {
    name: string;
    canHandle(file: File): boolean;
    upload(file: File, options: UploadOptions): Promise<UploadResult>;
    supportsChunking: boolean;
    supportsResume: boolean;
}
/**
 * Base upload strategy with common functionality
 */
export declare abstract class BaseUploadStrategy implements UploadStrategy {
    abstract name: string;
    abstract canHandle(file: File): boolean;
    supportsChunking: boolean;
    supportsResume: boolean;
    abstract upload(file: File, options: UploadOptions): Promise<UploadResult>;
    protected readFileAsArrayBuffer(file: File): Promise<ArrayBuffer>;
    protected createChunks(file: File, chunkSize: number): Promise<ChunkInfo[]>;
    protected calculateHash(blob: Blob): Promise<string>;
    protected createFormData(file: File | Blob, options: UploadOptions, additionalData?: Record<string, string | number | boolean>): FormData;
}
/**
 * Standard upload strategy for small files
 */
export declare class StandardUploadStrategy extends BaseUploadStrategy {
    name: string;
    maxFileSize: number;
    canHandle(file: File): boolean;
    upload(file: File, options: UploadOptions): Promise<UploadResult>;
}
/**
 * Chunked upload strategy for large files
 */
export declare class ChunkedUploadStrategy extends BaseUploadStrategy {
    name: string;
    supportsChunking: boolean;
    supportsResume: boolean;
    chunkSize: number;
    canHandle(file: File): boolean;
    upload(file: File, options: UploadOptions): Promise<UploadResult>;
    private initializeUpload;
    private uploadChunk;
    private checkExistingChunks;
    private finalizeUpload;
}
/**
 * Image-specific upload strategy with optimization
 */
export declare class ImageUploadStrategy extends BaseUploadStrategy {
    name: string;
    supportedTypes: string[];
    maxDimension: number;
    quality: number;
    canHandle(file: File): boolean;
    upload(file: File, options: UploadOptions): Promise<UploadResult>;
    private shouldOptimizeImage;
    private getImageDimensions;
    private optimizeImage;
}
/**
 * Special handling for TIFF/BMP images
 */
export declare class SpecialImageUploadStrategy extends StandardUploadStrategy {
    name: string;
    supportedTypes: string[];
    canHandle(file: File): boolean;
    upload(file: File, options: UploadOptions): Promise<UploadResult>;
}
/**
 * Avatar upload strategy with cropping support
 */
export declare class AvatarUploadStrategy extends ImageUploadStrategy {
    name: string;
    maxFileSize: number;
    maxDimension: number;
    canHandle(file: File): boolean;
    upload(file: File, options: UploadOptions): Promise<UploadResult>;
}
export declare function createUploadStrategy(file: File, type?: string): UploadStrategy;
//# sourceMappingURL=strategies.d.ts.map