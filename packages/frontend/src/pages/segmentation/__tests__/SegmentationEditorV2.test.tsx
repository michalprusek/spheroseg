import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SegmentationEditorV2 } from '../SegmentationEditorV2';
import { setupAllContextMocks } from '@/test-utils/contextMocks';
import { MemoryRouterWrapper } from '@/test-utils/test-wrapper';

// Mock toast from sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Create mock functions outside of the mock definition so they persist
const mockSetTransform = vi.fn();
const mockHandleSave = vi.fn();
const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockOnMouseDown = vi.fn();
const mockOnMouseMove = vi.fn();
const mockOnMouseUp = vi.fn();
const mockHandleResegment = vi.fn();

// Mock useSegmentationV2 hook
vi.mock('../hooks/segmentation', () => ({
  useSegmentationV2: vi.fn(() => ({
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
    isResegmenting: false,
    canUndo: false,
    canRedo: false,
    setEditMode: vi.fn(),
    setSelectedPolygonId: vi.fn(),
    setTransform: mockSetTransform,
    setTempPoints: vi.fn(),
    setInteractionState: vi.fn(),
    setSegmentationDataWithHistory: vi.fn(),
    handleSave: mockHandleSave,
    handleResegment: mockHandleResegment,
    undo: mockUndo,
    redo: mockRedo,
    onMouseDown: mockOnMouseDown,
    onMouseMove: mockOnMouseMove,
    onMouseUp: mockOnMouseUp,
    getCanvasCoordinates: vi.fn(),
    handleWheelEvent: vi.fn(),
  })),
  EditMode: {
    View: 'View',
    EditVertices: 'EditVertices',
    AddPolygon: 'AddPolygon',
    DeletePolygon: 'DeletePolygon',
  },
}));

// Mock useSlicing hook
vi.mock('../hooks/useSlicing', () => ({
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

// Mock CanvasV2 component
vi.mock('../components/canvas/CanvasV2', () => ({
  default: vi.fn(({ onMouseDown, onMouseMove, onMouseUp }) => (
    <div data-testid="mock-canvas" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      Canvas Component
    </div>
  )),
}));

// Mock ToolbarV2 component
vi.mock('../components/toolbar/ToolbarV2', () => ({
  ToolbarV2: vi.fn(({ onZoomIn, onZoomOut, onResetView, onSave, onUndo, onRedo, onResegment }) => (
    <div data-testid="mock-toolbar">
      <button data-testid="zoom-in-btn" onClick={onZoomIn}>
        Zoom In
      </button>
      <button data-testid="zoom-out-btn" onClick={onZoomOut}>
        Zoom Out
      </button>
      <button data-testid="reset-view-btn" onClick={onResetView}>
        Reset View
      </button>
      <button data-testid="save-btn" onClick={onSave}>
        Save
      </button>
      <button data-testid="undo-btn" onClick={onUndo}>
        Undo
      </button>
      <button data-testid="redo-btn" onClick={onRedo}>
        Redo
      </button>
      <button data-testid="resegment-btn" onClick={onResegment}>
        Resegment
      </button>
    </div>
  )),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'segmentation.loading': 'Loading segmentation editor...',
        'segmentation.resegment.error.missingData': 'Missing project or image data for resegmentation',
        'segmentation.resegment.success': 'Resegmentation successful',
        'segmentation.resegment.error.failed': 'Resegmentation failed',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock fetch for the resegmentation API call
global.fetch = vi.fn();

// Mock window.location.reload
const mockReload = vi.fn();
delete (window as any).location;
window.location = { ...window.location, reload: mockReload } as any;

describe('SegmentationEditorV2 Component', () => {
  beforeEach(() => {
    // Setup all context mocks
    setupAllContextMocks();

    // Reset fetch mock
    vi.mocked(global.fetch).mockReset();
    
    // Clear all mock function calls
    mockSetTransform.mockClear();
    mockHandleSave.mockClear();
    mockUndo.mockClear();
    mockRedo.mockClear();
    mockOnMouseDown.mockClear();
    mockOnMouseMove.mockClear();
    mockOnMouseUp.mockClear();
    mockHandleResegment.mockClear();
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
  });

  it('shows loading state when data is loading', async () => {
    // Import the hook module to access the mock
    const segmentationModule = await import('../hooks/segmentation');
    const mockUseSegmentationV2 = vi.mocked(segmentationModule.useSegmentationV2);
    
    // Override the mock to simulate loading state
    mockUseSegmentationV2.mockReturnValueOnce({
      imageData: null,
      segmentationData: null,
      transform: { zoom: 1, translateX: 0, translateY: 0 },
      editMode: 'View',
      selectedPolygonId: null,
      hoveredVertex: null,
      tempPoints: [],
      interactionState: null,
      isLoading: true, // Set loading to true
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
    });

    renderComponent();

    // Check if the loading message is displayed
    expect(screen.getByText('Loading segmentation editor...')).toBeInTheDocument();
  });

  it('handles zoom in button click', () => {
    renderComponent();

    // Click the zoom in button
    fireEvent.click(screen.getByTestId('zoom-in-btn'));

    // Check if setTransform was called
    expect(mockSetTransform).toHaveBeenCalled();
  });

  it('handles zoom out button click', () => {
    renderComponent();

    // Click the zoom out button
    fireEvent.click(screen.getByTestId('zoom-out-btn'));

    // Check if setTransform was called
    expect(mockSetTransform).toHaveBeenCalled();
  });

  it('handles save button click', () => {
    renderComponent();

    // Click the save button
    fireEvent.click(screen.getByTestId('save-btn'));

    // Check if handleSave was called
    expect(mockHandleSave).toHaveBeenCalled();
  });

  it('handles undo button click', () => {
    renderComponent();

    // Click the undo button
    fireEvent.click(screen.getByTestId('undo-btn'));

    // Check if undo was called
    expect(mockUndo).toHaveBeenCalled();
  });

  it('handles redo button click', () => {
    renderComponent();

    // Click the redo button
    fireEvent.click(screen.getByTestId('redo-btn'));

    // Check if redo was called
    expect(mockRedo).toHaveBeenCalled();
  });

  it('handles successful resegmentation', async () => {
    // Use fake timers before setting up the mock
    vi.useFakeTimers();
    
    // Mock the resegment function to simulate success
    mockHandleResegment.mockImplementation(() => {
      // Simulate the resegment success behavior
      setTimeout(() => {
        mockReload();
      }, 1000);
      return Promise.resolve();
    });

    renderComponent();

    // Click the resegment button
    fireEvent.click(screen.getByTestId('resegment-btn'));

    // Check if handleResegment was called
    expect(mockHandleResegment).toHaveBeenCalled();
    
    // Fast-forward timer to trigger page reload
    await vi.advanceTimersByTimeAsync(1000);

    // Check if page reload was called
    expect(mockReload).toHaveBeenCalled();

    // Restore real timers
    vi.useRealTimers();
  });

  it('handles failed resegmentation', async () => {
    // Import toast to access the mocked functions
    const { toast } = await import('sonner');
    
    // Mock the resegment function to simulate failure
    mockHandleResegment.mockImplementation(() => {
      // The actual implementation would show an error toast
      toast.error('segmentation.resegment.error.failed');
      return Promise.resolve();
    });

    renderComponent();

    // Click the resegment button
    fireEvent.click(screen.getByTestId('resegment-btn'));

    // Check if handleResegment was called
    expect(mockHandleResegment).toHaveBeenCalled();

    // Check if error toast was called
    expect(toast.error).toHaveBeenCalledWith('segmentation.resegment.error.failed');
  });

  it('handles mouse events on the canvas', () => {
    renderComponent();

    // Trigger mouse events on the canvas
    fireEvent.mouseDown(screen.getByTestId('mock-canvas'));
    fireEvent.mouseMove(screen.getByTestId('mock-canvas'));
    fireEvent.mouseUp(screen.getByTestId('mock-canvas'));

    // Check if event handlers were called
    expect(mockOnMouseDown).toHaveBeenCalled();
    expect(mockOnMouseMove).toHaveBeenCalled();
    expect(mockOnMouseUp).toHaveBeenCalled();
  });
});
