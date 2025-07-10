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

const imageUtils = {
  getImagePath: (imagePath: string): string => {
    return imagePath;
  },
  
  getImageDimensions: (width: number, height: number): ImageDimensions => {
    return { width, height };
  }
};

export default imageUtils;