/**
 * Shared test utilities for segmentation tests
 */
import { vi } from 'vitest';
import { Point } from '@/types';

interface ImageData {
  id: string;
  actualId: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

interface Polygon {
  id: string;
  points: Point[];
  color?: string;
  label?: string;
  type?: 'external' | 'internal';
}

interface SegmentationData {
  polygons: Polygon[];
  width: number;
  height: number;
}

interface Transform {
  zoom: number;
  translateX: number;
  translateY: number;
}

interface InteractionState {
  isDraggingVertex: boolean;
  isPanning: boolean;
  panStart: Point | null;
  draggedVertexInfo: { polygonId: string; vertexIndex: number } | null;
  sliceStartPoint: Point | null;
  addPointStartVertex: { polygonId: string; vertexIndex: number } | null;
  addPointEndVertex: { polygonId: string; vertexIndex: number } | null;
  isAddingPoints: boolean;
}

/**
 * Creates a mock segmentation state for testing
 */
export const createMockSegmentationState = (overrides: Partial<ReturnType<typeof createDefaultState>> = {}) => {
  const defaultState = createDefaultState();

  // Merge with overrides
  return {
    ...defaultState,
    ...overrides,
    // Deep merge for nested objects
    segmentationData: overrides.segmentationData
      ? { ...defaultState.segmentationData, ...overrides.segmentationData }
      : defaultState.segmentationData,
    interactionState: overrides.interactionState
      ? { ...defaultState.interactionState, ...overrides.interactionState }
      : defaultState.interactionState,
    transform: overrides.transform ? { ...defaultState.transform, ...overrides.transform } : defaultState.transform,
    imageData: overrides.imageData ? { ...defaultState.imageData, ...overrides.imageData } : defaultState.imageData,
  };
};

/**
 * EditMode enum for tests
 */
export const TestEditMode = {
  View: 'View',
  EditVertices: 'EditVertices',
  AddPolygon: 'AddPolygon',
  DeletePolygon: 'DeletePolygon',
  SlicePolygon: 'SlicePolygon',
  MergePolygons: 'MergePolygons',
};

/**
 * Creates default sample polygons for testing
 */
export const createSamplePolygons = (): Polygon[] => [
  {
    id: 'polygon-1',
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ],
    color: '#FF0000',
    label: 'Cell 1',
  },
  {
    id: 'polygon-2',
    points: [
      { x: 300, y: 300 },
      { x: 400, y: 300 },
      { x: 400, y: 400 },
      { x: 300, y: 400 },
    ],
    color: '#00FF00',
    label: 'Cell 2',
  },
];

/**
 * Creates a default state for segmentation tests
 */
export const createDefaultState = () => ({
  imageData: {
    id: 'test-image-id',
    actualId: 'test-image-id',
    name: 'test-image.jpg',
    url: 'https://example.com/test-image.jpg',
    width: 800,
    height: 600,
  },
  segmentationData: {
    polygons: createSamplePolygons(),
    width: 800,
    height: 600,
  },
  transform: { zoom: 1, translateX: 0, translateY: 0 },
  editMode: TestEditMode.View,
  selectedPolygonId: null,
  hoveredVertex: null,
  tempPoints: [],
  interactionState: {
    isDraggingVertex: false,
    isPanning: false,
    panStart: null,
    draggedVertexInfo: null,
    sliceStartPoint: null,
    addPointStartVertex: null,
    addPointEndVertex: null,
    isAddingPoints: false,
  },
  isLoading: false,
  isSaving: false,
  error: null,
  canUndo: true,
  canRedo: false,
  setEditMode: vi.fn(),
  setSelectedPolygonId: vi.fn(),
  setTransform: vi.fn(),
  setTempPoints: vi.fn(),
  setInteractionState: vi.fn(),
  setSegmentationDataWithHistory: vi.fn(),
  setHoveredVertex: vi.fn(),
  handleSave: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  onMouseDown: vi.fn(),
  onMouseMove: vi.fn(),
  onMouseUp: vi.fn(),
  getCanvasCoordinates: vi.fn((x, y) => ({ x, y })),
  handleDeletePolygon: vi.fn(),
});

/**
 * Creates a mock for the segmentation hook
 */
export const createMockSegmentationHook = (overrides: Partial<ReturnType<typeof createDefaultState>> = {}) => {
  const mockState = createMockSegmentationState(overrides);

  return {
    useSegmentationV2: vi.fn(() => mockState),
    EditMode: TestEditMode,
    // Export the mock state so we can modify it during tests
    _mockSegmentationState: mockState,
  };
};

/**
 * Set up common mocks for segmentation tests
 */
export const setupSegmentationMocks = () => {
  // Mock config
  vi.mock('@/config', () => ({
    API_BASE_URL: 'http://test-api',
  }));

  // Mock useSlicing hook
  vi.mock('../../hooks/useSlicing', () => ({
    useSlicing: vi.fn(() => ({
      handleSliceAction: vi.fn(),
    })),
  }));

  // Mock react-router-dom's useNavigate
  vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
      ...actual,
      useNavigate: vi.fn(() => vi.fn()),
    };
  });
};
