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

export const IMAGE_FORMATS = {
  PNG: 'png',
  JPEG: 'jpeg',
  JPG: 'jpg',
  TIFF: 'tiff',
  TIF: 'tif',
  BMP: 'bmp',
} as const;

export const SUPPORTED_IMAGE_EXTENSIONS = Object.values(IMAGE_FORMATS);

export function isImageFormatSupported(extension: string): boolean {
  return SUPPORTED_IMAGE_EXTENSIONS.includes(extension.toLowerCase() as typeof SUPPORTED_IMAGE_EXTENSIONS[number]);
}

export function getImageExtension(filename: string): string {
  const parts = filename.split('.');
  return parts[parts.length - 1]?.toLowerCase() || '';
}

export function isImage(filename: string): boolean {
  const ext = getImageExtension(filename);
  return isImageFormatSupported(ext);
}

const imageUtils = {
  getImagePath: (imagePath: string): string => {
    return imagePath;
  },
  
  getImageDimensions: (width: number, height: number): ImageDimensions => {
    return { width, height };
  },
  
  isImageFormatSupported,
  getImageExtension,
  isImage,
};

export default imageUtils;