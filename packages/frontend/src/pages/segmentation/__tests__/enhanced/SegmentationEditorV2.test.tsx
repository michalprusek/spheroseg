import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SegmentationEditorV2 } from '../../SegmentationEditorV2';
import { setupAllContextMocks } from '@/test-utils/contextMocks';
import { MemoryRouterWrapper } from '@/test-utils/test-wrapper';
import { toast } from 'sonner';

// Mock API_BASE_URL
vi.mock('@/config', () => ({
  API_BASE_URL: 'http://test-api',
}));

// Mock useSegmentationV2 hook with more test scenarios
vi.mock('../../hooks/segmentation', () => {
  // Create a mock for the hook that can be updated between tests
  const mockHookState = {
    imageData: {
      id: 'test-image-id',
      actualId: 'test-image-id',
      name: 'test-image.jpg',
      url: 'https://example.com/test-image.jpg',
      width: 800,
      height: 600,
    },
    segmentationData: {
      polygons: [
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
      ],
      width: 800,
      height: 600,
    },
    transform: { zoom: 1, translateX: 0, translateY: 0 },
    editMode: 'View',
    selectedPolygonId: null,
    hoveredVertex: null,
    tempPoints: [],
    interactionState: null,
    isLoading: false,
    isSaving: false,
    canUndo: false,
    canRedo: false,
    setEditMode: vi.fn(),
    setSelectedPolygonId: vi.fn(),
    setTransform: vi.fn(),
    setTempPoints: vi.fn(),
    setInteractionState: vi.fn(),
    setSegmentationDataWithHistory: vi.fn(),
    handleSave: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    getCanvasCoordinates: vi.fn(),
  };

  return {
    useSegmentationV2: vi.fn(() => mockHookState),
    EditMode: {
      View: 'View',
      EditVertices: 'EditVertices',
      AddPolygon: 'AddPolygon',
      DeletePolygon: 'DeletePolygon',
      SlicePolygon: 'SlicePolygon',
      MergePolygons: 'MergePolygons',
    },
    // Export the mock state so tests can update it
    _mockSegmentationState: mockHookState,
  };
});

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

// Mock CanvasV2 component with more interactive tests
vi.mock('../../components/canvas/CanvasV2', () => ({
  default: vi.fn(
    ({
      imageData,
      segmentationData,
      transform,
      editMode,
      selectedPolygonId,
      hoveredVertex,
      tempPoints,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      canvasRef,
    }) => (
      <div
        data-testid="mock-canvas"
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        <div data-testid="canvas-info">
          <div>Edit Mode: {editMode}</div>
          <div>Selected Polygon: {selectedPolygonId || 'none'}</div>
          <div>Zoom: {transform.zoom}x</div>
          <div>Polygons: {segmentationData?.polygons?.length || 0}</div>
          {imageData && <div>Image: {imageData.name}</div>}
        </div>
      </div>
    ),
  ),
}));

// Mock ToolbarV2 component with more detailed mock
vi.mock('../../components/toolbar/ToolbarV2', () => ({
  ToolbarV2: vi.fn(
    ({
      editMode,
      setEditMode,
      onZoomIn,
      onZoomOut,
      onResetView,
      onSave,
      onUndo,
      onRedo,
      onResegment,
      canUndo,
      canRedo,
      isSaving,
      isResegmenting,
    }) => (
      <div data-testid="mock-toolbar">
        <button data-testid="edit-mode-view" onClick={() => setEditMode('View')}>
          View Mode
        </button>
        <button data-testid="edit-mode-edit" onClick={() => setEditMode('EditVertices')}>
          Edit Mode
        </button>
        <button data-testid="edit-mode-add" onClick={() => setEditMode('AddPolygon')}>
          Add Polygon
        </button>
        <button data-testid="edit-mode-delete" onClick={() => setEditMode('DeletePolygon')}>
          Delete Polygon
        </button>
        <button data-testid="zoom-in-btn" onClick={onZoomIn}>
          Zoom In
        </button>
        <button data-testid="zoom-out-btn" onClick={onZoomOut}>
          Zoom Out
        </button>
        <button data-testid="reset-view-btn" onClick={onResetView}>
          Reset View
        </button>
        <button data-testid="save-btn" onClick={onSave} disabled={isSaving}>
          Save {isSaving ? '(Saving...)' : ''}
        </button>
        <button data-testid="undo-btn" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button data-testid="redo-btn" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
        <button data-testid="resegment-btn" onClick={onResegment} disabled={isResegmenting}>
          Resegment {isResegmenting ? '(Processing...)' : ''}
        </button>
        <div data-testid="current-mode">Current Mode: {editMode}</div>
      </div>
    ),
  ),
}));

// Mock toast for testing notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock react-i18next with a more complete translation set
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'segmentation.loading': 'Loading segmentation editor...',
        'segmentation.resegment.error.missingData': 'Missing project or image data for resegmentation',
        'segmentation.resegment.success': 'Resegmentation successful',
        'segmentation.resegment.error.failed': 'Resegmentation failed',
        'segmentation.resegment.error.exception': 'Error during resegmentation: {{error}}',
        'segmentation.save.success': 'Segmentation saved successfully',
        'segmentation.save.error': 'Failed to save segmentation',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock fetch for the resegmentation API call
global.fetch = vi.fn();
global.window.location.reload = vi.fn();

describe('SegmentationEditorV2 Component (Enhanced Tests)', () => {
  beforeEach(() => {
    // Setup all context mocks
    setupAllContextMocks();

    // Reset fetch mock
    vi.mocked(global.fetch).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(window.location.reload).mockReset();

    // Reset mock implementations to default for each test
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    Object.assign(_mockSegmentationState, {
      isLoading: false,
      isSaving: false,
      canUndo: false,
      canRedo: false,
      setEditMode: vi.fn(),
      setSelectedPolygonId: vi.fn(),
      setTransform: vi.fn(),
      setTempPoints: vi.fn(),
      setInteractionState: vi.fn(),
      setSegmentationDataWithHistory: vi.fn(),
      handleSave: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      onMouseDown: vi.fn(),
      onMouseMove: vi.fn(),
      onMouseUp: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouterWrapper>
        <SegmentationEditorV2 projectId="test-project-id" imageId="test-image-id" {...props} />
      </MemoryRouterWrapper>,
    );
  };

  it('renders the editor correctly', () => {
    renderComponent();

    // Check if the toolbar and canvas are rendered
    expect(screen.getByTestId('mock-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();

    // Check canvas info displayed correctly
    expect(screen.getByTestId('canvas-info')).toHaveTextContent('Edit Mode: View');
    expect(screen.getByTestId('canvas-info')).toHaveTextContent('Polygons: 1');
    expect(screen.getByTestId('canvas-info')).toHaveTextContent('Image: test-image.jpg');
  });

  it('shows loading state when data is loading', () => {
    // Override the mock to simulate loading state
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    _mockSegmentationState.isLoading = true;

    renderComponent();

    // Check if the loading message is displayed
    expect(screen.getByText('Loading segmentation editor...')).toBeInTheDocument();
  });

  it('handles different edit modes via toolbar', () => {
    renderComponent();

    // Get the setEditMode mock
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Click the edit mode buttons
    fireEvent.click(screen.getByTestId('edit-mode-edit'));
    expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('EditVertices');

    fireEvent.click(screen.getByTestId('edit-mode-add'));
    expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('AddPolygon');

    fireEvent.click(screen.getByTestId('edit-mode-delete'));
    expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('DeletePolygon');

    fireEvent.click(screen.getByTestId('edit-mode-view'));
    expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('View');
  });

  it('handles zoom in button click with zoom calculation', () => {
    renderComponent();

    // Get the setTransform mock
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Click the zoom in button
    fireEvent.click(screen.getByTestId('zoom-in-btn'));

    // Check if setTransform was called
    expect(_mockSegmentationState.setTransform).toHaveBeenCalled();

    // Get the transform update function
    const transformUpdateFn = _mockSegmentationState.setTransform.mock.calls[0][0];

    // Call the update function with a mock previous state
    const prevState = { zoom: 1, translateX: 0, translateY: 0 };
    const newState = transformUpdateFn(prevState);

    // Check if the zoom was increased by 1.2x
    expect(newState.zoom).toBeCloseTo(1.2);
    expect(newState.translateX).toBe(0);
    expect(newState.translateY).toBe(0);
  });

  it('handles zoom out button click with zoom calculation', () => {
    renderComponent();

    // Get the setTransform mock
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Click the zoom out button
    fireEvent.click(screen.getByTestId('zoom-out-btn'));

    // Check if setTransform was called
    expect(_mockSegmentationState.setTransform).toHaveBeenCalled();

    // Get the transform update function
    const transformUpdateFn = _mockSegmentationState.setTransform.mock.calls[0][0];

    // Call the update function with a mock previous state
    const prevState = { zoom: 1, translateX: 0, translateY: 0 };
    const newState = transformUpdateFn(prevState);

    // Check if the zoom was decreased by 1.2x
    expect(newState.zoom).toBeCloseTo(0.8333, 4);
    expect(newState.translateX).toBe(0);
    expect(newState.translateY).toBe(0);
  });

  it('handles reset view button click', () => {
    // Setup Element.getBoundingClientRect mock
    const mockGetBoundingClientRect = vi.fn(() => ({
      width: 1000,
      height: 800,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 800,
      toJSON: () => {},
    }));

    // Create a ref and spy on Element.getBoundingClientRect
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = mockGetBoundingClientRect;

    renderComponent();

    // Get the setTransform mock
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Click the reset view button
    fireEvent.click(screen.getByTestId('reset-view-btn'));

    // Check if setTransform was called
    expect(_mockSegmentationState.setTransform).toHaveBeenCalled();

    // Restore the original method
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it('handles successful resegmentation', async () => {
    // Setup mock for successful resegmentation
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as any);

    renderComponent();

    // Mock the timer
    vi.useFakeTimers();

    // Click the resegment button
    fireEvent.click(screen.getByTestId('resegment-btn'));

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/api/projects/test-project-id/images/test-image-id/segment',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ force: true }),
        }),
      );
    });

    // Check for toast success message
    expect(toast.success).toHaveBeenCalledWith('Resegmentation successful');

    // Fast-forward timer to trigger page reload
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Check if page reload was called
    expect(window.location.reload).toHaveBeenCalled();

    // Restore real timers
    vi.useRealTimers();
  });

  it('handles network error during resegmentation', async () => {
    // Setup mock for network error
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    renderComponent();

    // Click the resegment button
    fireEvent.click(screen.getByTestId('resegment-btn'));

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Check for error toast
    expect(toast.error).toHaveBeenCalledWith('segmentation.resegment.error.exception', { error: 'Network error' });
  });

  it('handles server error during resegmentation', async () => {
    // Setup mock for server error
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as any);

    renderComponent();

    // Click the resegment button
    fireEvent.click(screen.getByTestId('resegment-btn'));

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Check for error toast
    expect(toast.error).toHaveBeenCalledWith('segmentation.resegment.error.exception', {
      error: 'Server responded with 500',
    });
  });

  it('handles save button click', () => {
    renderComponent();

    // Get the handleSave mock
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Click the save button
    fireEvent.click(screen.getByTestId('save-btn'));

    // Check if handleSave was called
    expect(_mockSegmentationState.handleSave).toHaveBeenCalled();
  });

  it('enables undo/redo buttons based on history state', () => {
    // Set up mock with history
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    _mockSegmentationState.canUndo = true;
    _mockSegmentationState.canRedo = true;

    renderComponent();

    // Click the undo and redo buttons
    fireEvent.click(screen.getByTestId('undo-btn'));
    expect(_mockSegmentationState.undo).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('redo-btn'));
    expect(_mockSegmentationState.redo).toHaveBeenCalled();
  });

  it('handles mouse events on the canvas', () => {
    renderComponent();

    // Get mouse event handlers
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Create mock event
    const mockEvent = {
      clientX: 100,
      clientY: 100,
      preventDefault: vi.fn(),
    };

    // Trigger mouse events on the canvas
    fireEvent.mouseDown(screen.getByTestId('mock-canvas'), mockEvent);
    fireEvent.mouseMove(screen.getByTestId('mock-canvas'), mockEvent);
    fireEvent.mouseUp(screen.getByTestId('mock-canvas'), mockEvent);

    // Check if event handlers were called
    expect(_mockSegmentationState.onMouseDown).toHaveBeenCalled();
    expect(_mockSegmentationState.onMouseMove).toHaveBeenCalled();
    expect(_mockSegmentationState.onMouseUp).toHaveBeenCalled();
  });

  it('handles URL update when imageData.actualId differs from imageId', () => {
    // Setup mock with different actualId
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    _mockSegmentationState.imageData = {
      ..._mockSegmentationState.imageData,
      actualId: 'different-image-id', // Different from the imageId prop
    };

    // Get navigate mock
    const navigateMock = vi.mocked(require('react-router-dom').useNavigate)();

    renderComponent({
      projectId: 'test-project-id',
      imageId: 'test-image-id', // This will differ from actualId
    });

    // Check if navigate was called with the correct URL
    expect(navigateMock).toHaveBeenCalledWith('/projects/test-project-id/segmentation/different-image-id', {
      replace: true,
    });
  });

  it('does not update URL when imageData.actualId matches imageId', () => {
    // Setup mock with matching actualId
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    _mockSegmentationState.imageData = {
      ..._mockSegmentationState.imageData,
      actualId: 'test-image-id', // Matches the imageId prop
    };

    // Get navigate mock
    const navigateMock = vi.mocked(require('react-router-dom').useNavigate)();

    renderComponent({
      projectId: 'test-project-id',
      imageId: 'test-image-id', // This matches actualId
    });

    // Check that navigate was not called
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
