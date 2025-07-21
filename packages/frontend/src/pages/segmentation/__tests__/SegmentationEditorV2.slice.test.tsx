import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SegmentationEditorV2 } from '../SegmentationEditorV2';
import { EditMode } from '../hooks/segmentation/types';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock the hooks
const mockHandleSliceAction = vi.fn();
const mockSetEditMode = vi.fn();
const mockSetTempPoints = vi.fn();

// Create a mocked hook that can be modified
const mockSegmentationHook = vi.fn(() => ({
  imageData: { id: 'test-image', width: 1000, height: 1000 },
  segmentationData: { polygons: [{ id: 'poly1', points: [] }] },
  transform: { zoom: 1, translateX: 0, translateY: 0 },
  editMode: EditMode.Slice,
  selectedPolygonId: 'poly1',
  hoveredVertex: null,
  tempPoints: [],
  interactionState: {},
  isLoading: false,
  isSaving: false,
  isResegmenting: false,
  canUndo: false,
  canRedo: false,
  setEditMode: mockSetEditMode,
  setSelectedPolygonId: vi.fn(),
  setTransform: vi.fn(),
  setTempPoints: mockSetTempPoints,
  setInteractionState: vi.fn(),
  setHoveredVertex: vi.fn(),
  fetchData: vi.fn(),
  setSegmentationDataWithHistory: vi.fn(),
  handleSave: vi.fn(),
  handleResegment: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  onMouseDown: vi.fn(),
  onMouseMove: vi.fn(),
  onMouseUp: vi.fn(),
  getCanvasCoordinates: vi.fn(),
  handleWheelEvent: vi.fn(),
}));

vi.mock('../hooks/segmentation', () => ({
  EditMode: {
    View: 0,
    EditVertices: 1,
    AddPoints: 2,
    Slice: 3,
    CreatePolygon: 4,
    DeletePolygon: 5,
  },
  useSegmentationV2: mockSegmentationHook,
}));

vi.mock('../hooks/useSlicing', () => ({
  useSlicing: () => ({
    handleSliceAction: mockHandleSliceAction,
  }),
}));

const createMockSegmentationData = (tempPoints: Array<{ x: number; y: number }> = []) => ({
  imageData: { id: 'test-image', width: 1000, height: 1000 },
  segmentationData: { polygons: [{ id: 'poly1', points: [] }] },
  transform: { zoom: 1, translateX: 0, translateY: 0 },
  editMode: EditMode.Slice,
  selectedPolygonId: 'poly1',
  hoveredVertex: null,
  tempPoints,
  interactionState: {},
  isLoading: false,
  isSaving: false,
  isResegmenting: false,
  canUndo: false,
  canRedo: false,
  setEditMode: mockSetEditMode,
  setSelectedPolygonId: vi.fn(),
  setTransform: vi.fn(),
  setTempPoints: mockSetTempPoints,
  setInteractionState: vi.fn(),
  setHoveredVertex: vi.fn(),
  fetchData: vi.fn(),
  setSegmentationDataWithHistory: vi.fn(),
  handleSave: vi.fn(),
  handleResegment: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  onMouseDown: vi.fn(),
  onMouseMove: vi.fn(),
  onMouseUp: vi.fn(),
  getCanvasCoordinates: vi.fn(),
  handleWheelEvent: vi.fn(),
});

describe('SegmentationEditorV2 - Slice Timing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variable
    (import.meta as unknown).env = {
      VITE_SLICE_ACTION_DELAY: undefined, // Use default
    };
  });

  it('should trigger slice action after delay when 2 points are set', async () => {
    const { rerender } = render(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Mock the hook to return 2 temp points
    mockSegmentationHook.mockReturnValue(createMockSegmentationData([
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ]));

    mockHandleSliceAction.mockReturnValue(true);

    // Trigger re-render with 2 points
    rerender(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Slice action should not be called immediately
    expect(mockHandleSliceAction).not.toHaveBeenCalled();

    // Wait for the delay (default 50ms)
    await waitFor(
      () => {
        expect(mockHandleSliceAction).toHaveBeenCalled();
      },
      { timeout: 100 },
    );

    expect(mockHandleSliceAction).toHaveBeenCalledTimes(1);
  });

  it('should use custom delay from environment variable', async () => {
    // Set custom delay
    (import.meta as unknown).env = {
      VITE_SLICE_ACTION_DELAY: '100',
    };

    const { rerender } = render(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Mock the hook to return 2 temp points
    mockSegmentationHook.mockReturnValue(createMockSegmentationData([
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ]));

    mockHandleSliceAction.mockReturnValue(true);

    // Trigger re-render with 2 points
    rerender(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Slice action should not be called after 50ms
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(mockHandleSliceAction).not.toHaveBeenCalled();

    // But should be called after 100ms
    await waitFor(
      () => {
        expect(mockHandleSliceAction).toHaveBeenCalled();
      },
      { timeout: 150 },
    );
  });

  it('should handle slice action errors gracefully', async () => {
    const { rerender } = render(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Mock the hook to return 2 temp points
    mockSegmentationHook.mockReturnValue(createMockSegmentationData([
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ]));

    // Make handleSliceAction throw an error
    mockHandleSliceAction.mockImplementation(() => {
      throw new Error('Slice failed');
    });

    // Trigger re-render with 2 points
    rerender(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Wait for the delay and error handling
    await waitFor(
      () => {
        expect(mockHandleSliceAction).toHaveBeenCalled();
      },
      { timeout: 100 },
    );

    // Error should be logged and toast shown
    expect(toast.error).toHaveBeenCalledWith('segmentation.sliceError');
  });

  it('should cancel slice action if component unmounts', async () => {
    const { unmount } = render(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Mock the hook to return 2 temp points
    mockSegmentationHook.mockReturnValue(createMockSegmentationData([
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ]));

    // Unmount before the delay completes
    setTimeout(() => unmount(), 25);

    // Wait longer than the delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Slice action should not have been called
    expect(mockHandleSliceAction).not.toHaveBeenCalled();
  });

  it('should not trigger slice action without selected polygon', async () => {
    // Mock the hook with no selected polygon
    const mockData = createMockSegmentationData([
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ]);
    mockSegmentationHook.mockReturnValue({
      ...mockData,
      selectedPolygonId: null,
    });

    render(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Wait longer than the delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Slice action should not have been called
    expect(mockHandleSliceAction).not.toHaveBeenCalled();
  });
});
