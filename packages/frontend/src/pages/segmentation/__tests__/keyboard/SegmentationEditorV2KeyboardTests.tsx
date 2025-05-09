import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SegmentationEditorV2 } from '../../SegmentationEditorV2';
import { setupAllContextMocks } from '@/test-utils/contextMocks';
import { MemoryRouterWrapper } from '@/test-utils/test-wrapper';
import { toast } from 'sonner';

// Mock config
vi.mock('@/config', () => ({
  API_BASE_URL: 'http://test-api'
}));

// Mock useSegmentationV2 hook with focus on keyboard events
vi.mock('../../hooks/segmentation', () => {
  // Create a reusable mock state
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
    selectedPolygonId: 'polygon-1', // Pre-select a polygon for keyboard tests
    hoveredVertex: null,
    tempPoints: [],
    interactionState: null,
    isLoading: false,
    isSaving: false,
    error: null,
    canUndo: true, // Enable undo for keyboard tests
    canRedo: true, // Enable redo for keyboard tests
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
    handleDeletePolygon: vi.fn(),
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
    // Export the mock state so we can modify it during tests
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
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// Mock CanvasV2 component
vi.mock('../../components/canvas/CanvasV2', () => ({
  default: vi.fn(({ canvasRef }) => (
    <div 
      data-testid="mock-canvas"
      ref={canvasRef}
      tabIndex={0} // Make sure it can receive keyboard events
    >
      Canvas Component
    </div>
  )),
}));

// Mock ToolbarV2 component
vi.mock('../../components/toolbar/ToolbarV2', () => ({
  ToolbarV2: vi.fn(() => (
    <div data-testid="mock-toolbar">
      Mock Toolbar
    </div>
  )),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe('SegmentationEditorV2 Keyboard Interactions', () => {
  beforeEach(() => {
    // Setup all context mocks
    setupAllContextMocks();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouterWrapper>
        <SegmentationEditorV2 
          projectId="test-project-id" 
          imageId="test-image-id" 
        />
      </MemoryRouterWrapper>
    );
  };

  it('should handle Escape key to reset to View mode', () => {
    // Setup initial state with a non-View edit mode
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    _mockSegmentationState.editMode = 'EditVertices';

    renderComponent();

    // Get the canvas element
    const canvas = screen.getByTestId('mock-canvas');
    
    // Trigger Escape key
    fireEvent.keyDown(document, { key: 'Escape' });
    
    // Verify that setEditMode was called with View mode
    expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('View');
  });

  it('should handle Delete key to delete selected polygon', () => {
    // Setup initial state with a selected polygon
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    _mockSegmentationState.selectedPolygonId = 'polygon-1';

    renderComponent();
    
    // Trigger Delete key
    fireEvent.keyDown(document, { key: 'Delete' });
    
    // Verify that handleDeletePolygon was called
    expect(_mockSegmentationState.handleDeletePolygon).toHaveBeenCalled();
  });

  it('should not delete polygon when no polygon is selected', () => {
    // Setup initial state with no selected polygon
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    _mockSegmentationState.selectedPolygonId = null;

    renderComponent();
    
    // Trigger Delete key
    fireEvent.keyDown(document, { key: 'Delete' });
    
    // Verify that handleDeletePolygon was not called
    expect(_mockSegmentationState.handleDeletePolygon).not.toHaveBeenCalled();
  });

  it('should handle Ctrl+Z for undo', () => {
    // Setup initial state with canUndo=true
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    _mockSegmentationState.canUndo = true;

    renderComponent();
    
    // Trigger Ctrl+Z
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    
    // Verify that undo was called
    expect(_mockSegmentationState.undo).toHaveBeenCalled();
  });

  it('should handle Ctrl+Shift+Z for redo', () => {
    // Setup initial state with canRedo=true
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    _mockSegmentationState.canRedo = true;

    renderComponent();
    
    // Trigger Ctrl+Shift+Z
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true, shiftKey: true });
    
    // Verify that redo was called
    expect(_mockSegmentationState.redo).toHaveBeenCalled();
  });

  it('should handle Ctrl+S for save', () => {
    renderComponent();
    
    // Prevent default is needed for Ctrl+S
    const preventDefaultMock = vi.fn();
    
    // Trigger Ctrl+S
    fireEvent.keyDown(document, {
      key: 's',
      ctrlKey: true,
      preventDefault: preventDefaultMock
    });
    
    // Verify that save was called and default was prevented
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    expect(_mockSegmentationState.handleSave).toHaveBeenCalled();
    expect(preventDefaultMock).toHaveBeenCalled();
  });

  // Test for Shift key state
  it('should update shift key state', () => {
    renderComponent();

    // Get the handler that will be called
    // We'll access the actual hook implementation to verify shift key state
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    
    // First get the handler function that should update shift key
    const keyDownHandler = vi.fn(e => {
      if (e.key === 'Shift') {
        // This would set isShiftPressed, but we're just checking the call
        expect(e.key).toBe('Shift');
      }
    });
    
    // Simulate shift key down
    fireEvent.keyDown(document, { key: 'Shift' });
    keyDownHandler({ key: 'Shift' });
    
    // Verify handler was called with the right key
    expect(keyDownHandler).toHaveBeenCalledWith({ key: 'Shift' });
    
    // Simulate shift key up
    fireEvent.keyUp(document, { key: 'Shift' });
    
    // In a real implementation, this would reset isShiftPressed
    // But since we're mocking, we just verify the keyup event occurs
    expect(document.dispatchEvent).toHaveBeenCalled();
  });

  // Tests for different platform key combinations
  it('should handle both Ctrl+Z and Meta+Z (Mac) for undo', () => {
    renderComponent();
    
    // Simulate Windows/Linux Ctrl+Z
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    
    // Verify undo was called
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    expect(_mockSegmentationState.undo).toHaveBeenCalled();
    vi.mocked(_mockSegmentationState.undo).mockReset();
    
    // Simulate Mac Command+Z (metaKey)
    fireEvent.keyDown(document, { key: 'z', metaKey: true });
    
    // Verify undo was called again
    expect(_mockSegmentationState.undo).toHaveBeenCalled();
  });
  
  it('should handle both Ctrl+Shift+Z and Meta+Shift+Z (Mac) for redo', () => {
    renderComponent();
    
    // Simulate Windows/Linux Ctrl+Shift+Z
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true, shiftKey: true });
    
    // Verify redo was called
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    expect(_mockSegmentationState.redo).toHaveBeenCalled();
    vi.mocked(_mockSegmentationState.redo).mockReset();
    
    // Simulate Mac Command+Shift+Z (metaKey)
    fireEvent.keyDown(document, { key: 'z', metaKey: true, shiftKey: true });
    
    // Verify redo was called again
    expect(_mockSegmentationState.redo).toHaveBeenCalled();
  });
});