// --- Enums ---
export enum EditMode {
  View,
  EditVertices,
  AddPoints,
  Slice,
  CreatePolygon,
  DeletePolygon,
}

// --- Types ---
export interface TransformState {
  zoom: number;
  translateX: number;
  translateY: number;
}

export interface InteractionState {
  isDraggingVertex: boolean;
  isPanning: boolean;
  panStart: Point | null;
  draggedVertexInfo: { polygonId: string; vertexIndex: number } | null;
  // Store original vertex position for undo/redo
  originalVertexPosition?: Point | null;
  // Add other interaction states as needed (e.g., slicing points)
  sliceStartPoint: Point | null;
  // Add point mode states
  addPointStartVertex: { polygonId: string; vertexIndex: number } | null;
  addPointEndVertex: { polygonId: string; vertexIndex: number } | null;
  isAddingPoints: boolean;
}

export interface Point {
  x: number;
  y: number;
}

// Define types for segmentation data
export interface Polygon {
  id: string;
  points: Point[];
  type: 'external' | 'internal';
  class?: string;
  color?: string;
}

export interface SegmentationData {
  image_id?: string;
  status?: string;
  result_data?: {
    polygons: Polygon[];
  };
  created_at?: string;
  updated_at?: string;
  polygons: Polygon[];
}

export interface ImageData {
  id?: string;
  project_id?: string;
  name?: string;
  width: number;
  height: number;
  src: string;
  storage_path?: string;
  storage_path_full?: string;
  thumbnail_path?: string;
  thumbnail_path_full?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  actualId?: string; // Added for handling ID mismatches
}

// Interface for the intersection point in slicing
export interface Intersection extends Point {
  edgeIndex: number;
}
