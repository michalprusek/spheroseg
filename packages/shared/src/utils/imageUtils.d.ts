/**
 * Shared image utilities
 */
export interface ImageBase {
    id: string;
    name: string;
    path: string;
}
export interface ImageDimensions {
    width: number;
    height: number;
}
export interface ImageLoadOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}
export interface ImageData {
    id: string;
    project_id: string;
    user_id: string;
    name: string;
    storage_path: string;
    thumbnail_path?: string | null;
    file_size?: number;
    created_at?: Date | string;
    updated_at?: Date | string;
    width?: number;
    height?: number;
    segmentation_status?: string;
    [key: string]: unknown;
}
export declare const IMAGE_FORMATS: {
    readonly PNG: "png";
    readonly JPEG: "jpeg";
    readonly JPG: "jpg";
    readonly TIFF: "tiff";
    readonly TIF: "tif";
    readonly BMP: "bmp";
};
export declare const SUPPORTED_IMAGE_EXTENSIONS: ("png" | "jpeg" | "jpg" | "tiff" | "tif" | "bmp")[];
export declare function isImageFormatSupported(extension: string): boolean;
export declare function getImageExtension(filename: string): string;
export declare function isImage(filename: string): boolean;
declare const imageUtils: {
    getImagePath: (imagePath: string) => string;
    getImageDimensions: (width: number, height: number) => ImageDimensions;
    isImageFormatSupported: typeof isImageFormatSupported;
    getImageExtension: typeof getImageExtension;
    isImage: typeof isImage;
};
export default imageUtils;
//# sourceMappingURL=imageUtils.d.ts.map