import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SegmentationPage } from '../SegmentationPage';
import { setupAllContextMocks } from '@/test-utils/contextMocks';
import { MemoryRouterWrapper } from '@/test-utils/test-wrapper';
import { useParams } from 'react-router-dom';

// Mock useSegmentationV2 hook
vi.mock('../hooks/segmentation/useSegmentationV2', () => {
  const mockSetEditMode = vi.fn();
  const mockSetTransform = vi.fn();
  const mockSetHoveredVertex = vi.fn();
  const mockSetSelectedPolygonId = vi.fn();
  const mockSetTempPoints = vi.fn();
  const mockSetInteractionState = vi.fn();
  const mockHandleSave = vi.fn();
  const mockHandleResegment = vi.fn();
  const mockOnMouseDown = vi.fn();
  const mockOnMouseMove = vi.fn();
  const mockOnMouseUp = vi.fn();
  const mockHandleWheel = vi.fn();
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();
  const mockHandleDeletePolygon = vi.fn();

  return {
    useSegmentationV2: vi.fn(() => ({
      imageData: {
        id: 'test-image-id',
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
      error: null,
      canUndo: true,
      canRedo: false,
      setEditMode: mockSetEditMode,
      setTransform: mockSetTransform,
      setHoveredVertex: mockSetHoveredVertex,
      setSelectedPolygonId: mockSetSelectedPolygonId,
      setTempPoints: mockSetTempPoints,
      setInteractionState: mockSetInteractionState,
      handleSave: mockHandleSave,
      handleResegment: mockHandleResegment,
      onMouseDown: mockOnMouseDown,
      onMouseMove: mockOnMouseMove,
      onMouseUp: mockOnMouseUp,
      handleWheel: mockHandleWheel,
      undo: mockUndo,
      redo: mockRedo,
      handleDeletePolygon: mockHandleDeletePolygon,
    })),
    EditMode: {
      View: 'View',
      EditVertices: 'EditVertices',
      AddPolygon: 'AddPolygon',
      DeletePolygon: 'DeletePolygon',
      CreatePolygon: 'CreatePolygon',
      Slice: 'Slice',
      AddPoints: 'AddPoints',
    },
  };
});

// Mock useSegmentationKeyboard hook
vi.mock('../hooks/useSegmentationKeyboard', () => {
  const mockKeyboardHook = {
    isShiftPressed: false,
  };
  return {
    useSegmentationKeyboard: vi.fn(() => mockKeyboardHook),
    getMockKeyboardHook: () => mockKeyboardHook,
  };
});

// Mock useProjectData hook
const mockProjectImages = [
  { id: 'test-image-id-1', name: 'image1.jpg' },
  { id: 'test-image-id-2', name: 'image2.jpg' },
  { id: 'test-image-id-3', name: 'image3.jpg' },
];

vi.mock('@/hooks/useProjectData', () => {
  return {
    useProjectData: vi.fn((projectId) => ({
      images: mockProjectImages,
      loading: false,
    })),
  };
});

// Mock navigate
const mockNavigate = vi.fn();

// Mock react-router-dom's useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({
      projectId: 'test-project-id',
      imageId: 'test-image-id-2',
    })),
    useNavigate: vi.fn(() => mockNavigate),
  };
});

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock CanvasV2 component
vi.mock('../components/canvas/CanvasV2', () => ({
  default: vi.fn(({ onWheel, onMouseDown, onMouseUp, onMouseMove }) => (
    <div
      data-testid="mock-canvas"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
    >
      Canvas Component
    </div>
  )),
}));

// Mock ToolbarV2 component
vi.mock('../components/toolbar/ToolbarV2', () => {
  const MockToolbar = vi.fn(
    ({ onZoomIn, onZoomOut, onSave, onUndo, onRedo, onResetView, onResegment, setEditMode }) => (
      <div data-testid="mock-toolbar">
        <button data-testid="zoom-in-btn" onClick={onZoomIn}>
          Zoom In
        </button>
        <button data-testid="zoom-out-btn" onClick={onZoomOut}>
          Zoom Out
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
        <button data-testid="reset-view-btn" onClick={onResetView}>
          Reset View
        </button>
        <button data-testid="resegment-btn" onClick={onResegment}>
          Resegment
        </button>
        <button data-testid="edit-mode-btn" onClick={() => setEditMode('CreatePolygon')}>
          Create Polygon
        </button>
      </div>
    ),
  );
  return { ToolbarV2: MockToolbar };
});

// Mock StatusBarV2 component
vi.mock('../components/statusbar/StatusBarV2', () => ({
  StatusBarV2: vi.fn(({ zoom, polygonCount, vertexCount }) => (
    <div data-testid="mock-statusbar">
      Status Bar - Zoom: {zoom}, Polygons: {polygonCount}, Vertices: {vertexCount}
    </div>
  )),
}));

// Mock KeyboardShortcutsHelp component
vi.mock('../components/keyboard/KeyboardShortcutsHelp', () => ({
  default: vi.fn(({ onClose }) => (
    <div data-testid="mock-keyboard-shortcuts">
      Keyboard Shortcuts Help
      <button onClick={onClose} data-testid="close-shortcuts-btn">
        Close
      </button>
    </div>
  )),
}));

describe('SegmentationPage Component', () => {
  beforeEach(() => {
    // Setup all context mocks
    setupAllContextMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouterWrapper initialEntries={['/projects/test-project-id/segmentation/test-image-id-2']}>
        <SegmentationPage />
      </MemoryRouterWrapper>,
    );
  };

  it('renders the segmentation page correctly', () => {
    renderComponent();

    // Check if the toolbar and canvas are rendered
    expect(screen.getByTestId('mock-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('mock-statusbar')).toBeInTheDocument();

    // Check project navigation controls - the translation key is returned
    expect(screen.getByText('segmentation.backToProject')).toBeInTheDocument();
  });

  it('shows loading state when data is loading', () => {
    // Override the mock to simulate loading state
    const originalUseSegmentationV2 = vi.mocked(require('../hooks/segmentation').useSegmentationV2);
    originalUseSegmentationV2.mockReturnValueOnce({
      ...originalUseSegmentationV2(),
      isLoading: true,
    });

    renderComponent();

    // Check if the loading spinner is shown (div with animate-spin class)
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows keyboard shortcuts when the keyboard button is clicked', async () => {
    renderComponent();

    // Find and click the keyboard shortcuts button
    const keyboardButton = screen.getByLabelText(/Toggle Keyboard Shortcuts/i);
    fireEvent.click(keyboardButton);

    // Check if the keyboard shortcuts help is displayed
    await waitFor(() => {
      expect(screen.getByTestId('mock-keyboard-shortcuts')).toBeInTheDocument();
    });

    // Click the close button
    fireEvent.click(screen.getByTestId('close-shortcuts-btn'));

    // Check if the keyboard shortcuts help is closed
    await waitFor(() => {
      expect(screen.queryByTestId('mock-keyboard-shortcuts')).not.toBeInTheDocument();
    });
  });

  it('displays error message when image data is not available', () => {
    // Override the mock to simulate no image data
    const originalUseSegmentationV2 = vi.mocked(require('../hooks/segmentation').useSegmentationV2);
    originalUseSegmentationV2.mockReturnValueOnce({
      ...originalUseSegmentationV2(),
      imageData: null,
      error: 'Image not found',
    });

    renderComponent();

    // Check if the error message is displayed
    expect(screen.getByText(/Image Not Found/i)).toBeInTheDocument();
    expect(screen.getByText(/Return to Project/i)).toBeInTheDocument();
    expect(screen.getByText('Image not found')).toBeInTheDocument();
  });

  it('displays image name and navigation controls', () => {
    renderComponent();

    // Check if the image name and navigation info is displayed
    expect(screen.getByText(/image2.jpg/i)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 3/i)).toBeInTheDocument();

    // Check if navigation buttons are present
    expect(screen.getByLabelText(/Previous Image/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Next Image/i)).toBeInTheDocument();
  });

  it('handles toolbar actions correctly', () => {
    renderComponent();

    // Get all toolbar buttons
    const zoomInBtn = screen.getByTestId('zoom-in-btn');
    const zoomOutBtn = screen.getByTestId('zoom-out-btn');
    const saveBtn = screen.getByTestId('save-btn');
    const undoBtn = screen.getByTestId('undo-btn');
    const redoBtn = screen.getByTestId('redo-btn');
    const resetViewBtn = screen.getByTestId('reset-view-btn');
    const resegmentBtn = screen.getByTestId('resegment-btn');
    const editModeBtn = screen.getByTestId('edit-mode-btn');

    // Test clicking each button
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
    fireEvent.click(saveBtn);
    fireEvent.click(undoBtn);
    fireEvent.click(redoBtn);
    fireEvent.click(resetViewBtn);
    fireEvent.click(resegmentBtn);
    fireEvent.click(editModeBtn);

    // Get module and check mock functions were called
    const segmentationModule = require('../hooks/segmentation');

    // Verify that setTransform was called for zoom in/out
    expect(segmentationModule.useSegmentationV2().setTransform).toHaveBeenCalled();

    // Verify other actions
    expect(segmentationModule.useSegmentationV2().handleSave).toHaveBeenCalled();
    expect(segmentationModule.useSegmentationV2().undo).toHaveBeenCalled();
    expect(segmentationModule.useSegmentationV2().redo).toHaveBeenCalled();
    expect(segmentationModule.useSegmentationV2().handleResegment).toHaveBeenCalled();
    expect(segmentationModule.useSegmentationV2().setEditMode).toHaveBeenCalledWith('CreatePolygon');
  });

  it('handles navigation between images', () => {
    renderComponent();

    // Test next image button
    const nextButton = screen.getByLabelText(/Next Image/i);
    fireEvent.click(nextButton);

    // Check navigate was called with correct args
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/\/projects\/test-project-id\/segmentation\/test-image-id-3\?t=/),
    );

    // Test previous image button
    const prevButton = screen.getByLabelText(/Previous Image/i);
    fireEvent.click(prevButton);

    // Check navigate was called with correct args
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/\/projects\/test-project-id\/segmentation\/test-image-id-1\?t=/),
    );

    // Test back to project button
    const backButton = screen.getByText(/Back to Project/i);
    fireEvent.click(backButton);

    // Check navigate was called with correct project path
    expect(mockNavigate).toHaveBeenCalledWith('/project/test-project-id');
  });

  it('handles canvas events correctly', () => {
    renderComponent();

    const canvas = screen.getByTestId('mock-canvas');

    // Test mouse events
    fireEvent.mouseDown(canvas);
    fireEvent.mouseMove(canvas);
    fireEvent.mouseUp(canvas);

    // Test wheel event
    fireEvent.wheel(canvas, { deltaY: -100 });

    // Check event handlers were called
    const segmentationModule = require('../hooks/segmentation');
    expect(segmentationModule.useSegmentationV2().onMouseDown).toHaveBeenCalled();
    expect(segmentationModule.useSegmentationV2().onMouseMove).toHaveBeenCalled();
    expect(segmentationModule.useSegmentationV2().onMouseUp).toHaveBeenCalled();
    expect(segmentationModule.useSegmentationV2().handleWheel).toHaveBeenCalled();
  });

  it('handles project loading state', () => {
    const useProjectDataMock = vi.mocked(require('@/hooks/useProjectData').useProjectData);
    useProjectDataMock.mockReturnValueOnce({
      images: [],
      loading: true,
    });

    renderComponent();

    // Check if the loading spinner is shown
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('disables navigation buttons appropriately', () => {
    // Mock test-image-id-1 as current (first image)
    vi.mocked(useParams).mockReturnValueOnce({
      projectId: 'test-project-id',
      imageId: 'test-image-id-1',
    });

    renderComponent();

    // Previous button should be disabled for first image
    expect(screen.getByLabelText(/Previous Image/i)).toBeDisabled();
    expect(screen.getByLabelText(/Next Image/i)).not.toBeDisabled();

    // Mock test-image-id-3 as current (last image)
    vi.mocked(useParams).mockReturnValueOnce({
      projectId: 'test-project-id',
      imageId: 'test-image-id-3',
    });

    renderComponent();

    // Next button should be disabled for last image
    expect(screen.getByLabelText(/Previous Image/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/Next Image/i)).toBeDisabled();
  });

  it('shows error page when there are no images in the project', () => {
    // Mock empty project
    const useProjectDataMock = vi.mocked(require('@/hooks/useProjectData').useProjectData);
    useProjectDataMock.mockReturnValueOnce({
      images: [],
      loading: false,
    });

    // Mock segmentation hook with error
    const originalUseSegmentationV2 = vi.mocked(require('../hooks/segmentation').useSegmentationV2);
    originalUseSegmentationV2.mockReturnValueOnce({
      ...originalUseSegmentationV2(),
      imageData: null,
      error: 'No images found in this project',
    });

    renderComponent();

    // Check if error message is displayed
    expect(screen.getByText(/Image Not Found/i)).toBeInTheDocument();
    expect(screen.getByText('No images found in this project')).toBeInTheDocument();
  });

  it('handles keyboard shortcuts through useSegmentationKeyboard hook', () => {
    renderComponent();

    // Verify that useSegmentationKeyboard was called with all the necessary handlers
    const useSegmentationKeyboard = vi.mocked(require('../hooks/useSegmentationKeyboard').useSegmentationKeyboard);

    expect(useSegmentationKeyboard).toHaveBeenCalledWith(
      expect.objectContaining({
        onUndo: expect.any(Function),
        onRedo: expect.any(Function),
        onSave: expect.any(Function),
        onDelete: expect.any(Function),
        onZoomIn: expect.any(Function),
        onZoomOut: expect.any(Function),
        onResetView: expect.any(Function),
      }),
    );
  });

  it('handles deletion of selected polygon', () => {
    // Mock a selected polygon
    const originalUseSegmentationV2 = vi.mocked(require('../hooks/segmentation').useSegmentationV2);
    originalUseSegmentationV2.mockReturnValueOnce({
      ...originalUseSegmentationV2(),
      selectedPolygonId: 'polygon-1',
    });

    // Get the hooks to test them directly
    renderComponent();

    // Get useSegmentationKeyboard call and extract the onDelete handler
    const useSegmentationKeyboardCalls = vi.mocked(require('../hooks/useSegmentationKeyboard').useSegmentationKeyboard)
      .mock.calls;
    const { onDelete } = useSegmentationKeyboardCalls[0][0];

    // Call the onDelete handler
    onDelete();

    // Verify handleDeletePolygon was called
    const segmentationModule = require('../hooks/segmentation');
    expect(segmentationModule.useSegmentationV2().handleDeletePolygon).toHaveBeenCalled();
  });
});
