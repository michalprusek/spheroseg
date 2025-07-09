import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SegmentationEditorV2 } from '../SegmentationEditorV2';
import { EditMode } from '../hooks/segmentation';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: jest.fn() },
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/apiClient', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock the hooks
const mockHandleSliceAction = jest.fn();
const mockSetEditMode = jest.fn();
const mockSetTempPoints = jest.fn();

jest.mock('../hooks/segmentation', () => ({
  EditMode: {
    View: 'view',
    Slice: 'slice',
    CreatePolygon: 'create',
    EditVertices: 'edit',
  },
  useSegmentationV2: () => ({
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
    setSelectedPolygonId: jest.fn(),
    setTransform: jest.fn(),
    setTempPoints: mockSetTempPoints,
    setInteractionState: jest.fn(),
    setHoveredVertex: jest.fn(),
    fetchData: jest.fn(),
    setSegmentationDataWithHistory: jest.fn(),
    handleSave: jest.fn(),
    handleResegment: jest.fn(),
    undo: jest.fn(),
    redo: jest.fn(),
    onMouseDown: jest.fn(),
    onMouseMove: jest.fn(),
    onMouseUp: jest.fn(),
    getCanvasCoordinates: jest.fn(),
    handleWheelEvent: jest.fn(),
  }),
}));

jest.mock('../hooks/useSlicing', () => ({
  useSlicing: () => ({
    handleSliceAction: mockHandleSliceAction,
  }),
}));

describe('SegmentationEditorV2 - Slice Timing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock environment variable
    (import.meta as any).env = {
      VITE_SLICE_ACTION_DELAY: undefined, // Use default
    };
  });

  it('should trigger slice action after delay when 2 points are set', async () => {
    const { rerender } = render(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Mock the hook to return 2 temp points
    jest.mocked(require('../hooks/segmentation').useSegmentationV2).mockReturnValue({
      ...jest.mocked(require('../hooks/segmentation').useSegmentationV2)(),
      tempPoints: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
    });

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
    (import.meta as any).env = {
      VITE_SLICE_ACTION_DELAY: '100',
    };

    const { rerender } = render(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Mock the hook to return 2 temp points
    jest.mocked(require('../hooks/segmentation').useSegmentationV2).mockReturnValue({
      ...jest.mocked(require('../hooks/segmentation').useSegmentationV2)(),
      tempPoints: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
    });

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
    jest.mocked(require('../hooks/segmentation').useSegmentationV2).mockReturnValue({
      ...jest.mocked(require('../hooks/segmentation').useSegmentationV2)(),
      tempPoints: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
    });

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
    jest.mocked(require('../hooks/segmentation').useSegmentationV2).mockReturnValue({
      ...jest.mocked(require('../hooks/segmentation').useSegmentationV2)(),
      tempPoints: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
    });

    // Unmount before the delay completes
    setTimeout(() => unmount(), 25);

    // Wait longer than the delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Slice action should not have been called
    expect(mockHandleSliceAction).not.toHaveBeenCalled();
  });

  it('should not trigger slice action without selected polygon', async () => {
    // Mock the hook with no selected polygon
    jest.mocked(require('../hooks/segmentation').useSegmentationV2).mockReturnValue({
      ...jest.mocked(require('../hooks/segmentation').useSegmentationV2)(),
      selectedPolygonId: null,
      tempPoints: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
    });

    render(<SegmentationEditorV2 projectId="test-project" imageId="test-image" />);

    // Wait longer than the delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Slice action should not have been called
    expect(mockHandleSliceAction).not.toHaveBeenCalled();
  });
});
