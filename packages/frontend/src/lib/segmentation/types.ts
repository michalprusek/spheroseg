/**
 * Represents a 2D point
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Represents a polygon in the segmentation
 */
export interface Polygon {
  id: string;
  points: Point[];
  holes?: Point[][];
  type: 'external' | 'internal';
  class?: string;
}

/**
 * Represents the result of a segmentation operation
 */
export interface SegmentationResult {
  id?: string;
  imageWidth: number;
  imageHeight: number;
  polygons: Polygon[];
  metadata?: Record<string, any>;
}
