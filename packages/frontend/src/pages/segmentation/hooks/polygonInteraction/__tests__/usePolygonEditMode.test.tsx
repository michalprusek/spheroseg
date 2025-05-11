import { renderHook, act } from '@testing-library/react-hooks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SegmentationResult, Point } from '@/lib/segmentation';
import { usePolygonEditMode } from '../usePolygonEditMode';

// Mock the dependencies
vi.mock('../editMode/useSlicingMode', () => ({
  useSlicingMode: () => ({
    slicingMode: false,
    sliceStartPoint: null,
    cursorPosition: { x: 120, y: 120 },
    toggleSlicingMode: vi.fn(),
    handleSlicingClick: vi.fn(),
    updateCursorPosition: vi.fn(),
    setSlicingMode: vi.fn(),
  }),
}));

vi.mock('../editMode/usePointAddingMode', () => ({
  usePointAddingMode: () => ({
    pointAddingMode: false,
    hoveredSegment: null,
    tempPoints: [],
    selectedVertexIndex: null,
    sourcePolygonId: null,
    selectedPolygonPoints: null,
    togglePointAddingMode: vi.fn(),
    handlePointAddingClick: vi.fn(),
    updatePointAddingPosition: vi.fn(),
    setPointAddingMode: vi.fn(),
  }),
}));

vi.mock('../editMode/useEditModeSwitcher', () => ({
  useEditModeSwitcher: ({ editModeCore, slicingMode, pointAddingMode }) => {
    // Create spy functions that we can track
    const toggleEditMode = vi.fn(() => {
      // Simulate the implementation
      if (editModeCore.editMode) {
        editModeCore.toggleEditMode();
      } else {
        if (slicingMode.slicingMode) slicingMode.setSlicingMode(false);
        if (pointAddingMode.pointAddingMode) pointAddingMode.setPointAddingMode(false);
        editModeCore.toggleEditMode();
      }
    });

    const toggleSlicingMode = vi.fn(() => {
      // Simulate the implementation
      if (slicingMode.slicingMode) {
        slicingMode.toggleSlicingMode();
      } else {
        if (editModeCore.editMode) editModeCore.setEditMode(false);
        if (pointAddingMode.pointAddingMode) pointAddingMode.setPointAddingMode(false);
        slicingMode.toggleSlicingMode();
      }
    });

    const togglePointAddingMode = vi.fn(() => {
      // Simulate the implementation
      if (pointAddingMode.pointAddingMode) {
        pointAddingMode.togglePointAddingMode();
      } else {
        if (editModeCore.editMode) editModeCore.setEditMode(false);
        if (slicingMode.slicingMode) slicingMode.setSlicingMode(false);
        pointAddingMode.togglePointAddingMode();
      }
    });

    const exitAllEditModes = vi.fn(() => {
      // Simulate the implementation
      if (editModeCore.editMode) editModeCore.setEditMode(false);
      if (slicingMode.slicingMode) slicingMode.setSlicingMode(false);
      if (pointAddingMode.pointAddingMode) pointAddingMode.setPointAddingMode(false);
    });

    return {
      toggleEditMode,
      toggleSlicingMode,
      togglePointAddingMode,
      exitAllEditModes,
    };
  },
}));

vi.mock('../editMode/useAutoPointAdding', () => ({
  useAutoPointAdding: () => ({
    resetLastAutoAddedPoint: vi.fn(),
  }),
}));

vi.mock('../editMode/useEditModeClickHandlers', () => ({
  useEditModeClickHandlers: () => ({
    handleEditModeClick: vi.fn(),
    handleEditMouseMove: vi.fn(),
  }),
}));

vi.mock('../../../../../shared/utils/editModeManager', () => ({
  useEditModeManager: () => ({
    editMode: false,
    tempPoints: { points: [] },
    cursorPosition: { x: 100, y: 100 },
    isShiftPressed: false,
    toggleEditMode: vi.fn(),
    setEditMode: vi.fn(),
    addPointToTemp: vi.fn(),
  }),
  createEditModeParams: vi.fn((params) => params),
}));

// Create a test segmentation for testing
const createTestSegmentation = (count: number = 3): SegmentationResult => {
  const createTestPolygon = (id: string, numPoints: number = 4) => {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      points.push({
        x: 100 + Math.cos(angle) * 50,
        y: 100 + Math.sin(angle) * 50,
      });
    }
    return {
      id,
      points,
      label: 'test',
      color: '#FF0000',
      metadata: {},
    };
  };

  const polygons = [];
  for (let i = 0; i < count; i++) {
    polygons.push(createTestPolygon(`polygon-${i}`, 3 + i));
  }

  return {
    polygons,
    image: { width: 500, height: 500 },
    contours: [],
    metadata: {},
  };
};

describe('usePolygonEditMode Hook', () => {
  let mockSegmentation: SegmentationResult;
  let mockSetSegmentation: ReturnType<typeof vi.fn>;
  let selectedPolygonId: string | null;
  let zoom: number;
  let offset: { x: number; y: number };

  beforeEach(() => {
    mockSegmentation = createTestSegmentation(3);
    mockSetSegmentation = vi.fn();
    selectedPolygonId = 'polygon-1';
    zoom = 1;
    offset = { x: 0, y: 0 };
    vi.clearAllMocks();
  });

  const renderPolygonEditModeHook = () =>
    renderHook(() => usePolygonEditMode(mockSegmentation, mockSetSegmentation, selectedPolygonId, zoom, offset));

  it('should initialize with default values', () => {
    const { result } = renderPolygonEditModeHook();

    // Check if the hook returns the expected properties
    expect(result.current).toHaveProperty('editMode');
    expect(result.current).toHaveProperty('tempPoints');
    expect(result.current).toHaveProperty('cursorPosition');
    expect(result.current).toHaveProperty('isShiftPressed');
    expect(result.current).toHaveProperty('slicingMode');
    expect(result.current).toHaveProperty('sliceStartPoint');
    expect(result.current).toHaveProperty('pointAddingMode');
    expect(result.current).toHaveProperty('hoveredSegment');
    expect(result.current).toHaveProperty('pointAddingTempPoints');
    expect(result.current).toHaveProperty('toggleEditMode');
    expect(result.current).toHaveProperty('toggleSlicingMode');
    expect(result.current).toHaveProperty('togglePointAddingMode');
    expect(result.current).toHaveProperty('exitAllEditModes');
    expect(result.current).toHaveProperty('handleEditModeClick');
    expect(result.current).toHaveProperty('handleEditMouseMove');

    // Check initial values
    expect(result.current.editMode).toBe(false);
    expect(result.current.slicingMode).toBe(false);
    expect(result.current.pointAddingMode).toBe(false);
    expect(result.current.isShiftPressed).toBe(false);
    expect(result.current.sliceStartPoint).toBe(null);
  });

  it('should handle toggling edit mode', () => {
    const { result } = renderPolygonEditModeHook();

    act(() => {
      result.current.toggleEditMode();
    });

    expect(result.current.toggleEditMode).toHaveBeenCalled();
  });

  it('should handle toggling slicing mode', () => {
    const { result } = renderPolygonEditModeHook();

    act(() => {
      result.current.toggleSlicingMode();
    });

    expect(result.current.toggleSlicingMode).toHaveBeenCalled();
  });

  it('should handle toggling point adding mode', () => {
    const { result } = renderPolygonEditModeHook();

    act(() => {
      result.current.togglePointAddingMode();
    });

    expect(result.current.togglePointAddingMode).toHaveBeenCalled();
  });

  it('should handle exiting all edit modes', () => {
    const { result } = renderPolygonEditModeHook();

    act(() => {
      result.current.exitAllEditModes();
    });

    expect(result.current.exitAllEditModes).toHaveBeenCalled();
  });

  it('should handle click events in edit mode', () => {
    const { result } = renderPolygonEditModeHook();

    act(() => {
      result.current.handleEditModeClick(150, 150);
    });

    expect(result.current.handleEditModeClick).toHaveBeenCalledWith(150, 150);
  });

  it('should handle mouse move events in edit mode', () => {
    const { result } = renderPolygonEditModeHook();

    act(() => {
      result.current.handleEditMouseMove(200, 200);
    });

    expect(result.current.handleEditMouseMove).toHaveBeenCalledWith(200, 200);
  });

  it('should work with null segmentation', () => {
    mockSegmentation = null as unknown as SegmentationResult;

    const { result } = renderPolygonEditModeHook();

    // Should not throw errors even with null segmentation
    expect(() => {
      act(() => {
        result.current.toggleEditMode();
        result.current.toggleSlicingMode();
        result.current.togglePointAddingMode();
        result.current.exitAllEditModes();
        result.current.handleEditModeClick(100, 100);
        result.current.handleEditMouseMove(200, 200);
      });
    }).not.toThrow();
  });

  it('should work with null selectedPolygonId', () => {
    selectedPolygonId = null;

    const { result } = renderPolygonEditModeHook();

    // Should not throw errors even with null selectedPolygonId
    expect(() => {
      act(() => {
        result.current.toggleEditMode();
        result.current.toggleSlicingMode();
        result.current.togglePointAddingMode();
        result.current.exitAllEditModes();
        result.current.handleEditModeClick(100, 100);
        result.current.handleEditMouseMove(200, 200);
      });
    }).not.toThrow();
  });

  it('should work with different zoom and offset values', () => {
    zoom = 2;
    offset = { x: 50, y: 50 };

    const { result } = renderPolygonEditModeHook();

    // Should initialize properly with different zoom and offset
    expect(result.current).toHaveProperty('editMode');
    expect(result.current).toHaveProperty('tempPoints');
    expect(result.current).toHaveProperty('cursorPosition');

    // Should not throw errors with different zoom and offset
    expect(() => {
      act(() => {
        result.current.handleEditModeClick(100, 100);
        result.current.handleEditMouseMove(200, 200);
      });
    }).not.toThrow();
  });

  it('should handle cursor position correctly', () => {
    const { result } = renderPolygonEditModeHook();

    // Initial cursor position should be from editModeCore or slicingMode
    expect(result.current.cursorPosition).toEqual({ x: 100, y: 100 });
  });
});
