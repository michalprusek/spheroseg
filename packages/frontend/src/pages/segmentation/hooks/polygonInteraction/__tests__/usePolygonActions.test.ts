import { renderHook, act } from '@testing-library/react';
import { usePolygonActions } from '../usePolygonActions';
import { SegmentationResult, Point } from '@/lib/segmentation';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/lib/apiClient');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('new-uuid-1234'),
}));

// Mock point editor utility
vi.mock('../geometry/usePointEditor', () => ({
  usePointEditor: () => ({
    removePoint: vi.fn().mockImplementation((polygonId, vertexIndex) => {
      // Return success for polygon '1' and failure for others
      return polygonId === '1';
    }),
    duplicatePoint: vi.fn().mockImplementation((polygonId, vertexIndex) => {
      // Return success for polygon '1' and failure for others
      return polygonId === '1';
    }),
    addPoint: vi.fn().mockImplementation((polygonId, point) => {
      // Return success for polygon '1' and failure for others
      return polygonId === '1';
    }),
    simplifyPolygon: vi.fn().mockImplementation((polygonId, tolerance) => {
      // Return success for polygon '1' and failure for others
      return polygonId === '1';
    }),
  }),
}));

// Mock polygon edit mode actions
vi.mock('../actions/usePolygonEditModeActions', () => ({
  usePolygonEditModeActions: (
    setSelectedPolygonId: (id: string | null) => void,
    togglePointAddingMode: () => void,
    toggleSlicingMode: () => void,
  ) => ({
    handleSlicePolygon: vi.fn().mockImplementation((polygonId: string) => {
      setSelectedPolygonId(polygonId);
      toggleSlicingMode();
    }),
    handleEditPolygon: vi.fn().mockImplementation((polygonId: string) => {
      setSelectedPolygonId(polygonId);
      togglePointAddingMode();
    }),
  }),
}));

// Mock polygon simplify action
vi.mock('../actions/usePolygonSimplifyAction', () => ({
  usePolygonSimplifyAction: (
    segmentation: SegmentationResult | null,
    setSegmentation: (seg: SegmentationResult | null) => void,
    selectedPolygonId: string | null,
  ) => ({
    simplifySelectedPolygon: vi.fn().mockImplementation((tolerance: number = 1.0) => {
      if (!selectedPolygonId) return false;
      // Return success for polygon '1' and failure for others
      return selectedPolygonId === '1';
    }),
  }),
}));

const createPolygon = (
  id: string,
  points: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
  ],
) => ({
  id,
  label: 'TestPolygon',
  points: [...points],
  color: '#FF0000',
  metadata: {},
});

describe('usePolygonActions', () => {
  let segmentation: SegmentationResult;
  let setSegmentation: ReturnType<typeof vi.fn>;
  let selectedPolygonId: string | null;
  let setSelectedPolygonId: ReturnType<typeof vi.fn>;
  let togglePointAddingMode: ReturnType<typeof vi.fn>;
  let toggleSlicingMode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    segmentation = {
      polygons: [createPolygon('1'), createPolygon('2')],
      image: { width: 100, height: 100 },
      contours: [],
      metadata: {},
    };
    setSegmentation = vi.fn();
    selectedPolygonId = '1';
    setSelectedPolygonId = vi.fn();
    togglePointAddingMode = vi.fn();
    toggleSlicingMode = vi.fn();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.clearAllMocks();
  });

  const renderPolygonActionsHook = () =>
    renderHook(() =>
      usePolygonActions(
        segmentation,
        setSegmentation,
        selectedPolygonId,
        setSelectedPolygonId,
        togglePointAddingMode,
        toggleSlicingMode,
      ),
    );

  describe('handleDuplicatePolygon', () => {
    it('should duplicate the selected polygon', () => {
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleDuplicatePolygon();
      });

      // Check that setSegmentation was called with a new polygon
      expect(setSegmentation).toHaveBeenCalledTimes(1);
      const newSegmentation = vi.mocked(setSegmentation).mock.calls[0][0];

      expect(newSegmentation.polygons.length).toBe(3);
      expect(newSegmentation.polygons[2].id).toBe('new-uuid-1234');
      expect(newSegmentation.polygons[2].points[0].x).toBe(20); // Check offset (0 + 20)
      expect(newSegmentation.polygons[2].points[0].y).toBe(20); // Check offset (0 + 20)

      // Check that the new polygon was selected
      expect(setSelectedPolygonId).toHaveBeenCalledWith('new-uuid-1234');

      // Check that success toast was shown
      expect(toast.success).toHaveBeenCalledWith('segmentation.polygonDuplicated');
    });

    it('should return undefined if no polygon is selected', () => {
      selectedPolygonId = null;
      const { result } = renderPolygonActionsHook();

      let returnValue;
      act(() => {
        returnValue = result.current.handleDuplicatePolygon();
      });

      expect(returnValue).toBeUndefined();
      expect(setSegmentation).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should return undefined if segmentation is null', () => {
      segmentation = null as unknown as SegmentationResult;
      const { result } = renderPolygonActionsHook();

      let returnValue;
      act(() => {
        returnValue = result.current.handleDuplicatePolygon();
      });

      expect(returnValue).toBeUndefined();
      expect(setSegmentation).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should return undefined if selected polygon not found', () => {
      selectedPolygonId = 'non-existent-id';
      const { result } = renderPolygonActionsHook();

      let returnValue;
      act(() => {
        returnValue = result.current.handleDuplicatePolygon();
      });

      expect(returnValue).toBeUndefined();
      expect(setSegmentation).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('handleDeletePolygon', () => {
    it('should delete the selected polygon', () => {
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleDeletePolygon();
      });

      // Check that setSegmentation was called with filtered polygons
      expect(setSegmentation).toHaveBeenCalledTimes(1);
      const newSegmentation = vi.mocked(setSegmentation).mock.calls[0][0];

      expect(newSegmentation.polygons.length).toBe(1);
      expect(newSegmentation.polygons[0].id).toBe('2');

      // Check that selection was cleared
      expect(setSelectedPolygonId).toHaveBeenCalledWith(null);

      // Check that success toast was shown
      expect(toast.success).toHaveBeenCalledWith('segmentation.polygonDeleted');
    });

    it('should return undefined if no polygon is selected', () => {
      selectedPolygonId = null;
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleDeletePolygon();
      });

      expect(setSegmentation).not.toHaveBeenCalled();
      expect(setSelectedPolygonId).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should return undefined if segmentation is null', () => {
      segmentation = null as unknown as SegmentationResult;
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleDeletePolygon();
      });

      expect(setSegmentation).not.toHaveBeenCalled();
      expect(setSelectedPolygonId).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteVertex', () => {
    it('should delete a vertex successfully', () => {
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleDeleteVertex('1', 1);
      });

      // Check that success toast was shown
      expect(toast.success).toHaveBeenCalledWith('segmentation.vertexDeleted');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should show error if vertex deletion fails', () => {
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleDeleteVertex('2', 1); // Using polygon '2' which will fail in mock
      });

      // Check that error toast was shown
      expect(toast.error).toHaveBeenCalledWith('segmentation.vertexDeleteFailed');
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('handleDuplicateVertex', () => {
    it('should duplicate a vertex successfully', () => {
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleDuplicateVertex('1', 1);
      });

      // Check that success toast was shown
      expect(toast.success).toHaveBeenCalledWith('segmentation.vertexDuplicated');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should show error if vertex duplication fails', () => {
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleDuplicateVertex('2', 1); // Using polygon '2' which will fail in mock
      });

      // Check that error toast was shown
      expect(toast.error).toHaveBeenCalledWith('segmentation.vertexDuplicateFailed');
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('handleSlicePolygon', () => {
    it('should set selected polygon ID and toggle slicing mode', () => {
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleSlicePolygon('2');
      });

      // Check that polygon was selected
      expect(setSelectedPolygonId).toHaveBeenCalledWith('2');

      // Check that slicing mode was toggled
      expect(toggleSlicingMode).toHaveBeenCalledTimes(1);
      expect(togglePointAddingMode).not.toHaveBeenCalled();
    });
  });

  describe('handleEditPolygon', () => {
    it('should set selected polygon ID and toggle point adding mode', () => {
      const { result } = renderPolygonActionsHook();

      act(() => {
        result.current.handleEditPolygon('2');
      });

      // Check that polygon was selected
      expect(setSelectedPolygonId).toHaveBeenCalledWith('2');

      // Check that point adding mode was toggled
      expect(togglePointAddingMode).toHaveBeenCalledTimes(1);
      expect(toggleSlicingMode).not.toHaveBeenCalled();
    });
  });

  describe('simplifySelectedPolygon', () => {
    it('should call the underlying implementation', () => {
      const { result } = renderPolygonActionsHook();

      let returnValue;
      act(() => {
        returnValue = result.current.simplifySelectedPolygon(2.0);
      });

      // Function should return true for polygon '1'
      expect(returnValue).toBe(true);
    });

    it('should handle failure case', () => {
      selectedPolygonId = '2'; // Will fail in mock
      const { result } = renderPolygonActionsHook();

      let returnValue;
      act(() => {
        returnValue = result.current.simplifySelectedPolygon(2.0);
      });

      // Function should return false for polygon '2'
      expect(returnValue).toBe(false);
    });
  });

  describe('addPointToPolygon and removePointFromPolygon', () => {
    it('should expose the point editor methods', () => {
      const { result } = renderPolygonActionsHook();

      expect(result.current.addPointToPolygon).toBeDefined();
      expect(result.current.removePointFromPolygon).toBeDefined();

      // Call the methods to ensure they work
      let addResult;
      let removeResult;

      act(() => {
        addResult = result.current.addPointToPolygon('1', { x: 5, y: 5 });
        removeResult = result.current.removePointFromPolygon('1', 0);
      });

      expect(addResult).toBe(true);
      expect(removeResult).toBe(true);
    });
  });
});
