/**
 * Segmentation Editor Test Utilities
 */

import { vi } from 'vitest';
import { Polygon, Point } from '@/pages/segmentation/types';

export const createMockPolygon = (id = 'polygon-1', points?: Point[]): Polygon => ({
  id,
  points: points || [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
  ],
  type: 'external',
  visible: true,
});

export const createMockSegmentation = (polygons?: Polygon[]) => ({
  id: 'segmentation-1',
  image_id: 'image-1',
  polygons: polygons || [createMockPolygon()],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const createMockEditorState = () => ({
  mode: 'View' as const,
  selectedPolygonId: null,
  hoveredPolygonId: null,
  hoveredVertexIndex: null,
  isDrawing: false,
  isPanning: false,
  tempPoints: [] as Point[],
  zoom: 1,
  offset: { x: 0, y: 0 },
  isDraggingVertex: false,
  draggedVertex: null,
});

export const createMockMouseEvent = (x: number, y: number, options = {}) => ({
  clientX: x,
  clientY: y,
  pageX: x,
  pageY: y,
  screenX: x,
  screenY: y,
  offsetX: x,
  offsetY: y,
  button: 0,
  buttons: 1,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  ...options,
});

export const createMockKeyboardEvent = (key: string, options = {}) => ({
  key,
  code: `Key${key.toUpperCase()}`,
  keyCode: key.charCodeAt(0),
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  ...options,
});

export const mockCanvasContext = () => ({
  canvas: { width: 800, height: 600 },
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
});
