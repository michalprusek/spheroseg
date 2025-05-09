import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SegmentationEditorV2 } from '../SegmentationEditorV2';
import { setupAllContextMocks } from '@/test-utils/contextMocks';
import { MemoryRouterWrapper } from '@/test-utils/test-wrapper';

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
    <div 
      data-testid="mock-canvas"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      Canvas Component
    </div>
  )),
}));

// Mock ToolbarV2 component
vi.mock('../components/toolbar/ToolbarV2', () => ({
  ToolbarV2: vi.fn(({ 
    onZoomIn, 
    onZoomOut, 
    onResetView, 
    onSave, 
    onUndo, 
    onRedo, 
    onResegment 
  }) => (
    <div data-testid="mock-toolbar">
      <button data-testid="zoom-in-btn" onClick={onZoomIn}>Zoom In</button>
      <button data-testid="zoom-out-btn" onClick={onZoomOut}>Zoom Out</button>
      <button data-testid="reset-view-btn" onClick={onResetView}>Reset View</button>
      <button data-testid="save-btn" onClick={onSave}>Save</button>
      <button data-testid="undo-btn" onClick={onUndo}>Undo</button>
      <button data-testid="redo-btn" onClick={onRedo}>Redo</button>
      <button data-testid="resegment-btn" onClick={onResegment}>Resegment</button>
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
global.window.location.reload = vi.fn();

describe('SegmentationEditorV2 Component', () => {
  beforeEach(() => {
    // Setup all context mocks
    setupAllContextMocks();
    
    // Reset fetch mock
    vi.mocked(global.fetch).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouterWrapper>
        <SegmentationEditorV2 
          projectId="test-project-id" 
          imageId="test-image-id" 
          {...props} 
        />
      </MemoryRouterWrapper>
    );
  };

  it('renders the editor correctly', () => {
    renderComponent();
    
    // Check if the toolbar and canvas are rendered
    expect(screen.getByTestId('mock-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
  });

  it('shows loading state when data is loading', () => {
    // Override the mock to simulate loading state
    const originalUseSegmentationV2 = vi.mocked(require('../hooks/segmentation').useSegmentationV2);
    originalUseSegmentationV2.mockReturnValueOnce({
      ...originalUseSegmentationV2(),
      isLoading: true,
    });
    
    renderComponent();
    
    // Check if the loading message is displayed
    expect(screen.getByText('Loading segmentation editor...')).toBeInTheDocument();
  });

  it('handles zoom in button click', () => {
    renderComponent();
    
    // Get the setTransform mock
    const { setTransform } = require('../hooks/segmentation').useSegmentationV2();
    
    // Click the zoom in button
    fireEvent.click(screen.getByTestId('zoom-in-btn'));
    
    // Check if setTransform was called with the expected update function
    expect(setTransform).toHaveBeenCalled();
  });

  it('handles zoom out button click', () => {
    renderComponent();
    
    // Get the setTransform mock
    const { setTransform } = require('../hooks/segmentation').useSegmentationV2();
    
    // Click the zoom out button
    fireEvent.click(screen.getByTestId('zoom-out-btn'));
    
    // Check if setTransform was called with the expected update function
    expect(setTransform).toHaveBeenCalled();
  });

  it('handles save button click', () => {
    renderComponent();
    
    // Get the handleSave mock
    const { handleSave } = require('../hooks/segmentation').useSegmentationV2();
    
    // Click the save button
    fireEvent.click(screen.getByTestId('save-btn'));
    
    // Check if handleSave was called
    expect(handleSave).toHaveBeenCalled();
  });

  it('handles undo button click', () => {
    renderComponent();
    
    // Get the undo mock
    const { undo } = require('../hooks/segmentation').useSegmentationV2();
    
    // Click the undo button
    fireEvent.click(screen.getByTestId('undo-btn'));
    
    // Check if undo was called
    expect(undo).toHaveBeenCalled();
  });

  it('handles redo button click', () => {
    renderComponent();
    
    // Get the redo mock
    const { redo } = require('../hooks/segmentation').useSegmentationV2();
    
    // Click the redo button
    fireEvent.click(screen.getByTestId('redo-btn'));
    
    // Check if redo was called
    expect(redo).toHaveBeenCalled();
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
        expect.stringContaining('/api/projects/test-project-id/images/test-image-id/segment'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ force: true }),
        })
      );
    });
    
    // Fast-forward timer to trigger page reload
    vi.advanceTimersByTime(1000);
    
    // Check if page reload was called
    expect(window.location.reload).toHaveBeenCalled();
    
    // Restore real timers
    vi.useRealTimers();
  });

  it('handles failed resegmentation', async () => {
    // Setup mock for failed resegmentation
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: false }),
    } as any);
    
    // Mock toast
    const mockToast = { error: vi.fn(), success: vi.fn() };
    vi.mock('sonner', () => ({
      toast: mockToast,
    }));
    
    renderComponent();
    
    // Click the resegment button
    fireEvent.click(screen.getByTestId('resegment-btn'));
    
    // Wait for the fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    
    // Check if error toast was called
    expect(require('sonner').toast.error).toHaveBeenCalledWith(
      'segmentation.resegment.error.failed'
    );
  });

  it('handles mouse events on the canvas', () => {
    renderComponent();
    
    // Get mouse event handlers
    const { onMouseDown, onMouseMove, onMouseUp } = require('../hooks/segmentation').useSegmentationV2();
    
    // Trigger mouse events on the canvas
    fireEvent.mouseDown(screen.getByTestId('mock-canvas'));
    fireEvent.mouseMove(screen.getByTestId('mock-canvas'));
    fireEvent.mouseUp(screen.getByTestId('mock-canvas'));
    
    // Check if event handlers were called
    expect(onMouseDown).toHaveBeenCalled();
    expect(onMouseMove).toHaveBeenCalled();
    expect(onMouseUp).toHaveBeenCalled();
  });
});