import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SegmentationEditorV2 } from '../../SegmentationEditorV2';
import { setupAllContextMocks } from '@/test-utils/contextMocks';
import { MemoryRouterWrapper } from '@/test-utils/test-wrapper';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config';

// Mock API_BASE_URL
vi.mock('@/config', () => ({
  API_BASE_URL: 'http://test-api'
}));

// Mock useSegmentationV2 hook with customizable state for testing
vi.mock('../../hooks/segmentation', () => {
  // Create a mock state object that can be modified between tests
  const mockState = {
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
    error: null,
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
    useSegmentationV2: vi.fn(() => mockState),
    EditMode: {
      View: 'View',
      EditVertices: 'EditVertices',
      AddPolygon: 'AddPolygon',
      DeletePolygon: 'DeletePolygon',
      SlicePolygon: 'SlicePolygon',
      MergePolygons: 'MergePolygons',
    },
    // Export the mock state so tests can modify it
    _mockSegmentationState: mockState
  };
});

// Mock useSlicing hook
vi.mock('../../hooks/useSlicing', () => ({
  useSlicing: vi.fn(() => ({
    handleSliceAction: vi.fn(),
  })),
}));

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(() => mockNavigate),
  };
});

// Mock CanvasV2 component
vi.mock('../../components/canvas/CanvasV2', () => ({
  default: vi.fn(({ 
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
    canvasRef 
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
  )),
}));

// Mock ToolbarV2 component
vi.mock('../../components/toolbar/ToolbarV2', () => ({
  ToolbarV2: vi.fn(({ 
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
    isResegmenting
  }) => (
    <div data-testid="mock-toolbar">
      <button data-testid="edit-mode-view" onClick={() => setEditMode('View')}>View Mode</button>
      <button data-testid="edit-mode-edit" onClick={() => setEditMode('EditVertices')}>Edit Mode</button>
      <button data-testid="edit-mode-add" onClick={() => setEditMode('AddPolygon')}>Add Polygon</button>
      <button data-testid="edit-mode-delete" onClick={() => setEditMode('DeletePolygon')}>Delete Polygon</button>
      <button data-testid="edit-mode-slice" onClick={() => setEditMode('SlicePolygon')}>Slice Polygon</button>
      <button data-testid="zoom-in-btn" onClick={onZoomIn}>Zoom In</button>
      <button data-testid="zoom-out-btn" onClick={onZoomOut}>Zoom Out</button>
      <button data-testid="reset-view-btn" onClick={onResetView}>Reset View</button>
      <button data-testid="save-btn" onClick={onSave} disabled={isSaving}>Save {isSaving ? '(Saving...)' : ''}</button>
      <button data-testid="undo-btn" onClick={onUndo} disabled={!canUndo}>Undo</button>
      <button data-testid="redo-btn" onClick={onRedo} disabled={!canRedo}>Redo</button>
      <button data-testid="resegment-btn" onClick={onResegment} disabled={isResegmenting}>
        Resegment {isResegmenting ? '(Processing...)' : ''}
      </button>
      <div data-testid="current-mode">Current Mode: {editMode}</div>
    </div>
  )),
}));

// Mock toast for notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      const translations: Record<string, string> = {
        'segmentation.loading': 'Loading segmentation editor...',
        'segmentation.resegment.error.missingData': 'Missing project or image data for resegmentation',
        'segmentation.resegment.success': 'Resegmentation successful',
        'segmentation.resegment.error.failed': 'Resegmentation failed',
        'segmentation.resegment.error.exception': `Error during resegmentation: ${options?.error || ''}`,
        'segmentation.save.success': 'Segmentation saved successfully',
        'segmentation.save.error': 'Failed to save segmentation',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock fetch for API calls
global.fetch = vi.fn();
global.window.location.reload = vi.fn();

describe('SegmentationEditorV2 Component (Advanced Tests)', () => {
  beforeEach(() => {
    // Setup all context mocks
    setupAllContextMocks();
    
    // Reset fetch mock
    vi.mocked(global.fetch).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.info).mockReset();
    vi.mocked(window.location.reload).mockReset();
    vi.mocked(mockNavigate).mockReset();

    // Reset the mock state for each test
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    Object.assign(_mockSegmentationState, {
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
      error: null,
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

  // Tests for Image ID Resolution and URL Updates
  describe('Image ID Resolution and URL Updates', () => {
    it('should update URL when actualId differs from imageId', () => {
      // Set up mock with different actualId
      const { _mockSegmentationState } = require('../../hooks/segmentation');
      _mockSegmentationState.imageData = {
        ..._mockSegmentationState.imageData,
        id: 'actual-image-id',
        actualId: 'actual-image-id',
      };
      
      renderComponent({
        projectId: 'test-project-id',
        imageId: 'test-image-id',
      });
      
      // Check if the navigate function was called with the correct URL
      expect(mockNavigate).toHaveBeenCalledWith(
        '/projects/test-project-id/segmentation/actual-image-id',
        { replace: true }
      );
    });
    
    it('should not update URL when actualId matches imageId', () => {
      // Set up mock with matching actualId
      const { _mockSegmentationState } = require('../../hooks/segmentation');
      _mockSegmentationState.imageData = {
        ..._mockSegmentationState.imageData,
        id: 'test-image-id',
        actualId: 'test-image-id',
      };
      
      renderComponent({
        projectId: 'test-project-id',
        imageId: 'test-image-id',
      });
      
      // Check that navigate was not called
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // Tests for Error Handling
  describe('Error Handling', () => {
    it('should show loading state when isLoading is true', () => {
      // Set isLoading to true
      const { _mockSegmentationState } = require('../../hooks/segmentation');
      _mockSegmentationState.isLoading = true;
      
      renderComponent();
      
      // Check if loading message is displayed
      expect(screen.getByText('Loading segmentation editor...')).toBeInTheDocument();
    });
    
    it('should handle failed resegmentation API call gracefully', async () => {
      // Mock a failed fetch
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('API Error'));
      
      renderComponent();
      
      // Click resegment button
      fireEvent.click(screen.getByTestId('resegment-btn'));
      
      // Wait for fetch error handler to execute
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'segmentation.resegment.error.exception',
          { error: 'API Error' }
        );
      });
    });
    
    it('should handle server error during resegmentation', async () => {
      // Mock a server error response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);
      
      renderComponent();
      
      // Click resegment button
      fireEvent.click(screen.getByTestId('resegment-btn'));
      
      // Wait for the error handler
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'segmentation.resegment.error.exception',
          { error: 'Server responded with 500' }
        );
      });
    });
    
    it('should handle missing data for resegmentation', async () => {
      // Set imageData to null
      const { _mockSegmentationState } = require('../../hooks/segmentation');
      _mockSegmentationState.imageData = null;
      
      renderComponent();
      
      // Click resegment button
      fireEvent.click(screen.getByTestId('resegment-btn'));
      
      // Error should be displayed immediately, no fetch
      expect(toast.error).toHaveBeenCalledWith('segmentation.resegment.error.missingData');
      expect(global.fetch).not.toHaveBeenCalled();
    });
    
    it('should handle successful resegmentation but failed processing', async () => {
      // Mock a successful fetch but unsuccessful processing
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false }),
      } as Response);
      
      renderComponent();
      
      // Click resegment button
      fireEvent.click(screen.getByTestId('resegment-btn'));
      
      // Wait for the error handler
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('segmentation.resegment.error.failed');
      });
      
      // Page should not reload
      expect(window.location.reload).not.toHaveBeenCalled();
    });
  });

  // Tests for Canvas Interactions
  describe('Canvas Interactions', () => {
    it('should pass through mouse events to the canvas', () => {
      renderComponent();
      
      const canvas = screen.getByTestId('mock-canvas');
      
      // Create mock event objects
      const mockEvent = {
        clientX: 150,
        clientY: 150,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };
      
      // Trigger mouse events
      fireEvent.mouseDown(canvas, mockEvent);
      fireEvent.mouseMove(canvas, mockEvent);
      fireEvent.mouseUp(canvas, mockEvent);
      
      // Check if handlers were called
      const { _mockSegmentationState } = require('../../hooks/segmentation');
      expect(_mockSegmentationState.onMouseDown).toHaveBeenCalled();
      expect(_mockSegmentationState.onMouseMove).toHaveBeenCalled();
      expect(_mockSegmentationState.onMouseUp).toHaveBeenCalled();
    });
  });

  // Tests for Transform and View
  describe('Transform and View', () => {
    it('should correctly handle zoom in', () => {
      renderComponent();
      
      // Get the setTransform mock
      const { _mockSegmentationState } = require('../../hooks/segmentation');
      
      // Click zoom in button
      fireEvent.click(screen.getByTestId('zoom-in-btn'));
      
      // Check that setTransform was called
      expect(_mockSegmentationState.setTransform).toHaveBeenCalled();
      
      // Extract and call the transform function
      const transformFn = _mockSegmentationState.setTransform.mock.calls[0][0];
      const result = transformFn({ zoom: 1, translateX: 0, translateY: 0 });
      
      // Check result
      expect(result).toEqual({
        zoom: 1.2,
        translateX: 0,
        translateY: 0
      });
    });
    
    it('should correctly handle zoom out', () => {
      renderComponent();
      
      // Get the setTransform mock
      const { _mockSegmentationState } = require('../../hooks/segmentation');
      
      // Click zoom out button
      fireEvent.click(screen.getByTestId('zoom-out-btn'));
      
      // Check that setTransform was called
      expect(_mockSegmentationState.setTransform).toHaveBeenCalled();
      
      // Extract and call the transform function
      const transformFn = _mockSegmentationState.setTransform.mock.calls[0][0];
      const result = transformFn({ zoom: 1, translateX: 0, translateY: 0 });
      
      // Check result
      expect(result).toEqual({
        zoom: 0.8333333333333334, // 1 / 1.2
        translateX: 0,
        translateY: 0
      });
    });
    
    it('should handle reset view with an Element.getBoundingClientRect mock', () => {
      // Mock Element.getBoundingClientRect
      const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
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
      
      renderComponent();
      
      // Get the setTransform mock
      const { _mockSegmentationState } = require('../../hooks/segmentation');
      
      // Click reset view button
      fireEvent.click(screen.getByTestId('reset-view-btn'));
      
      // Check that setTransform was called
      expect(_mockSegmentationState.setTransform).toHaveBeenCalled();
      
      // Restore original getBoundingClientRect
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    });
  });

  // Tests for Edit Modes
  describe('Edit Modes', () => {
    it('should change edit mode when toolbar buttons are clicked', () => {
      renderComponent();
      
      // Get the setEditMode mock
      const { _mockSegmentationState } = require('../../hooks/segmentation');
      
      // Click edit mode buttons
      fireEvent.click(screen.getByTestId('edit-mode-view'));
      expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('View');
      
      fireEvent.click(screen.getByTestId('edit-mode-edit'));
      expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('EditVertices');
      
      fireEvent.click(screen.getByTestId('edit-mode-add'));
      expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('AddPolygon');
      
      fireEvent.click(screen.getByTestId('edit-mode-delete'));
      expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('DeletePolygon');
      
      fireEvent.click(screen.getByTestId('edit-mode-slice'));
      expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('SlicePolygon');
    });
  });

  // Additional Tests for Resegmentation
  describe('Resegmentation Process', () => {
    it('should handle successful resegmentation with proper toast notifications', async () => {
      // Mock a successful fetch and processing
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);
      
      renderComponent();
      
      // Mock timers to control setTimeout
      vi.useFakeTimers();
      
      // Click resegment button
      fireEvent.click(screen.getByTestId('resegment-btn'));
      
      // Wait for the fetch to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api/api/projects/test-project-id/images/test-image-id/segment',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ force: true }),
          })
        );
      });
      
      // Verify success toast was called
      expect(toast.success).toHaveBeenCalledWith('Resegmentation successful');
      
      // Advance timer to trigger page reload
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      // Verify page reload was called
      expect(window.location.reload).toHaveBeenCalled();
      
      // Restore real timers
      vi.useRealTimers();
    });
  });
});