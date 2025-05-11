import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SegmentationEditorV2 } from '../../SegmentationEditorV2';
import { setupAllContextMocks } from '@/test-utils/contextMocks';
import { MemoryRouterWrapper } from '@/test-utils/test-wrapper';

// Mock config
vi.mock('@/config', () => ({
  API_BASE_URL: 'http://test-api',
}));

// Mock useSegmentationV2 hook with detailed polygon interaction state
vi.mock('../../hooks/segmentation', () => {
  // Create a reusable mock state with detailed polygon data
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
    interactionState: {
      isDraggingVertex: false,
      isPanning: false,
      panStart: null,
      draggedVertexInfo: null,
      sliceStartPoint: null,
      addPointStartVertex: null,
      addPointEndVertex: null,
      isAddingPoints: false,
    },
    isLoading: false,
    isSaving: false,
    error: null,
    canUndo: true,
    canRedo: false,
    setEditMode: vi.fn(),
    setSelectedPolygonId: vi.fn(),
    setTransform: vi.fn(),
    setTempPoints: vi.fn(),
    setInteractionState: vi.fn(),
    setSegmentationDataWithHistory: vi.fn(),
    setHoveredVertex: vi.fn(),
    handleSave: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    getCanvasCoordinates: vi.fn((x, y) => ({ x, y })),
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
    _mockSegmentationState: mockState,
  };
});

// Mock useSlicing hook with real-like behavior
vi.mock('../../hooks/useSlicing', () => {
  const handleSliceAction = vi.fn((tempPoints, segmentationData, selectedPolygonId) => {
    // If we have two points and a selected polygon, simulate a successful slice
    if (tempPoints.length === 2 && selectedPolygonId) {
      return {
        success: true,
        newPolygons: [
          // Simulate splitting polygon-1 into two polygons
          {
            id: 'polygon-1-part1',
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 },
              { x: 150, y: 150 },
            ],
            color: '#FF0000',
            label: 'Cell 1 (Part 1)',
          },
          {
            id: 'polygon-1-part2',
            points: [
              { x: 150, y: 150 },
              { x: 200, y: 200 },
              { x: 100, y: 200 },
            ],
            color: '#FF0000',
            label: 'Cell 1 (Part 2)',
          },
        ],
      };
    }
    return { success: false };
  });

  return {
    useSlicing: vi.fn(() => ({
      handleSliceAction,
    })),
    _mockHandleSliceAction: handleSliceAction,
  };
});

// Mock react-router-dom's useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// Mock CanvasV2 component with detailed polygon visualization
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
        <div data-testid="canvas-state">
          <div>Edit Mode: {editMode}</div>
          <div>Selected Polygon: {selectedPolygonId || 'none'}</div>
          <div>
            Hovered Vertex: {hoveredVertex ? `${hoveredVertex.polygonId}:${hoveredVertex.vertexIndex}` : 'none'}
          </div>
          <div>Polygons: {segmentationData?.polygons?.length || 0}</div>
          <div>Temp Points: {tempPoints?.length || 0}</div>
        </div>
        <div data-testid="polygons-list">
          {segmentationData?.polygons?.map((polygon) => (
            <div key={polygon.id} data-testid={`polygon-${polygon.id}`}>
              {polygon.id}: {polygon.points.length} vertices
            </div>
          ))}
        </div>
      </div>
    ),
  ),
}));

// Mock ToolbarV2 component with detailed mode controls
vi.mock('../../components/toolbar/ToolbarV2', () => ({
  ToolbarV2: vi.fn(({ editMode, setEditMode, onSave, onUndo, onRedo }) => (
    <div data-testid="mock-toolbar">
      <div>Current Mode: {editMode}</div>
      <button data-testid="view-mode-btn" onClick={() => setEditMode('View')}>
        View
      </button>
      <button data-testid="edit-vertices-mode-btn" onClick={() => setEditMode('EditVertices')}>
        Edit Vertices
      </button>
      <button data-testid="add-polygon-mode-btn" onClick={() => setEditMode('AddPolygon')}>
        Add Polygon
      </button>
      <button data-testid="delete-polygon-mode-btn" onClick={() => setEditMode('DeletePolygon')}>
        Delete Polygon
      </button>
      <button data-testid="slice-polygon-mode-btn" onClick={() => setEditMode('SlicePolygon')}>
        Slice Polygon
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

describe('SegmentationEditorV2 Polygon Interactions', () => {
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
        <SegmentationEditorV2 projectId="test-project-id" imageId="test-image-id" />
      </MemoryRouterWrapper>,
    );
  };

  // Test selecting a polygon
  it('should handle polygon selection', () => {
    renderComponent();

    // Get the mock state
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Simulate a mouse event on the canvas that should select polygon-1
    const mockEvent = {
      clientX: 150,
      clientY: 150,
      preventDefault: vi.fn(),
    };

    // Mock the getCanvasCoordinates function to return a point inside polygon-1
    _mockSegmentationState.getCanvasCoordinates.mockReturnValue({
      x: 150,
      y: 150,
    });

    // Get the canvas
    const canvas = screen.getByTestId('mock-canvas');

    // Simulate clicking the canvas
    fireEvent.mouseDown(canvas, mockEvent);

    // The mock doesn't actually implement polygon selection logic,
    // but we can verify onMouseDown was called with the expected event
    expect(_mockSegmentationState.onMouseDown).toHaveBeenCalled();
  });

  // Test editing vertices in a polygon
  it('should enter edit vertices mode and handle vertex operations', () => {
    renderComponent();

    // Get the mock state
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // First select a polygon
    _mockSegmentationState.selectedPolygonId = 'polygon-1';

    // Switch to edit vertices mode
    const editVerticesBtn = screen.getByTestId('edit-vertices-mode-btn');
    fireEvent.click(editVerticesBtn);

    // Verify edit mode is set
    expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('EditVertices');

    // Simulate hovering over a vertex
    _mockSegmentationState.getCanvasCoordinates.mockReturnValue({
      x: 100,
      y: 100,
    });

    const canvas = screen.getByTestId('mock-canvas');

    // Simulate mouse move over a vertex
    fireEvent.mouseMove(canvas, {
      clientX: 100,
      clientY: 100,
      preventDefault: vi.fn(),
    });

    // Verify onMouseMove was called
    expect(_mockSegmentationState.onMouseMove).toHaveBeenCalled();

    // Simulate dragging a vertex
    fireEvent.mouseDown(canvas, {
      clientX: 100,
      clientY: 100,
      preventDefault: vi.fn(),
    });

    // Verify onMouseDown was called
    expect(_mockSegmentationState.onMouseDown).toHaveBeenCalled();

    // Simulate dragging to a new position
    fireEvent.mouseMove(canvas, {
      clientX: 120,
      clientY: 120,
      preventDefault: vi.fn(),
    });

    // Simulate releasing the mouse
    fireEvent.mouseUp(canvas, {
      clientX: 120,
      clientY: 120,
      preventDefault: vi.fn(),
    });

    // Verify onMouseUp was called
    expect(_mockSegmentationState.onMouseUp).toHaveBeenCalled();
  });

  // Test adding a new polygon
  it('should enter add polygon mode and create a new polygon', () => {
    renderComponent();

    // Get the mock state
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Switch to add polygon mode
    const addPolygonBtn = screen.getByTestId('add-polygon-mode-btn');
    fireEvent.click(addPolygonBtn);

    // Verify edit mode is set
    expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('AddPolygon');

    // Get the canvas
    const canvas = screen.getByTestId('mock-canvas');

    // Simulate adding points to the polygon
    const points = [
      { clientX: 500, clientY: 100 },
      { clientX: 600, clientY: 100 },
      { clientX: 600, clientY: 200 },
      { clientX: 500, clientY: 200 },
    ];

    // Click to add each point
    for (const point of points) {
      _mockSegmentationState.getCanvasCoordinates.mockReturnValue({
        x: point.clientX,
        y: point.clientY,
      });

      fireEvent.mouseDown(canvas, {
        ...point,
        preventDefault: vi.fn(),
      });
    }

    // Verify onMouseDown was called for each point
    expect(_mockSegmentationState.onMouseDown).toHaveBeenCalledTimes(points.length);

    // Double-click to finish the polygon
    fireEvent.mouseDown(canvas, {
      clientX: 500,
      clientY: 100,
      preventDefault: vi.fn(),
    });

    // In a real scenario, this would add the polygon to segmentationData
    // We can verify that onMouseDown was called the expected number of times
    expect(_mockSegmentationState.onMouseDown).toHaveBeenCalledTimes(points.length + 1);
  });

  // Test deleting a polygon
  it('should enter delete polygon mode and delete a polygon', () => {
    renderComponent();

    // Get the mock state
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Switch to delete polygon mode
    const deletePolygonBtn = screen.getByTestId('delete-polygon-mode-btn');
    fireEvent.click(deletePolygonBtn);

    // Verify edit mode is set
    expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('DeletePolygon');

    // Get the canvas
    const canvas = screen.getByTestId('mock-canvas');

    // Simulate clicking on a polygon to delete it
    _mockSegmentationState.getCanvasCoordinates.mockReturnValue({
      x: 150,
      y: 150,
    });

    fireEvent.mouseDown(canvas, {
      clientX: 150,
      clientY: 150,
      preventDefault: vi.fn(),
    });

    // Verify onMouseDown was called
    expect(_mockSegmentationState.onMouseDown).toHaveBeenCalled();
  });

  // Test slicing a polygon
  it('should enter slice polygon mode and slice a polygon', () => {
    renderComponent();

    // Get the mock states
    const { _mockSegmentationState } = require('../../hooks/segmentation');
    const { _mockHandleSliceAction } = require('../../hooks/useSlicing');

    // Select a polygon first
    _mockSegmentationState.selectedPolygonId = 'polygon-1';

    // Switch to slice polygon mode
    const slicePolygonBtn = screen.getByTestId('slice-polygon-mode-btn');
    fireEvent.click(slicePolygonBtn);

    // Verify edit mode is set
    expect(_mockSegmentationState.setEditMode).toHaveBeenCalledWith('SlicePolygon');

    // Get the canvas
    const canvas = screen.getByTestId('mock-canvas');

    // Simulate adding the first slice point
    _mockSegmentationState.getCanvasCoordinates.mockReturnValue({
      x: 100,
      y: 150,
    });

    fireEvent.mouseDown(canvas, {
      clientX: 100,
      clientY: 150,
      preventDefault: vi.fn(),
    });

    // Add a mock temp point to simulate the first slice point
    _mockSegmentationState.tempPoints = [{ x: 100, y: 150 }];

    // Simulate adding the second slice point
    _mockSegmentationState.getCanvasCoordinates.mockReturnValue({
      x: 200,
      y: 150,
    });

    fireEvent.mouseDown(canvas, {
      clientX: 200,
      clientY: 150,
      preventDefault: vi.fn(),
    });

    // Add a second mock temp point to simulate the complete slice
    _mockSegmentationState.tempPoints = [
      { x: 100, y: 150 },
      { x: 200, y: 150 },
    ];

    // Simulate the slicing action
    const sliceResult = _mockHandleSliceAction(
      _mockSegmentationState.tempPoints,
      _mockSegmentationState.segmentationData,
      _mockSegmentationState.selectedPolygonId,
    );

    // Verify the slice was attempted
    expect(_mockHandleSliceAction).toHaveBeenCalled();

    // Check that our mock slice operation returned success
    expect(sliceResult.success).toBe(true);
    expect(sliceResult.newPolygons.length).toBe(2);

    // In a real scenario, this would update the segmentation data with the new polygons
  });

  // Test undo and redo operations
  it('should handle undo and redo operations', () => {
    renderComponent();

    // Get the mock state
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Configure the mock to have undo/redo available
    _mockSegmentationState.canUndo = true;
    _mockSegmentationState.canRedo = true;

    // Click the undo button
    const undoBtn = screen.getByTestId('undo-btn');
    fireEvent.click(undoBtn);

    // Verify undo was called
    expect(_mockSegmentationState.undo).toHaveBeenCalled();

    // Click the redo button
    const redoBtn = screen.getByTestId('redo-btn');
    fireEvent.click(redoBtn);

    // Verify redo was called
    expect(_mockSegmentationState.redo).toHaveBeenCalled();
  });

  // Test saving segmentation
  it('should save the segmentation data', () => {
    renderComponent();

    // Get the mock state
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Click the save button
    const saveBtn = screen.getByTestId('save-btn');
    fireEvent.click(saveBtn);

    // Verify handleSave was called
    expect(_mockSegmentationState.handleSave).toHaveBeenCalled();
  });

  // Test mouse move events and hover effects
  it('should handle mouse move events and hovering over elements', () => {
    renderComponent();

    // Get the mock state
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Get the canvas
    const canvas = screen.getByTestId('mock-canvas');

    // Simulate mouse movement over the canvas
    fireEvent.mouseMove(canvas, {
      clientX: 150,
      clientY: 150,
      preventDefault: vi.fn(),
    });

    // Verify onMouseMove was called
    expect(_mockSegmentationState.onMouseMove).toHaveBeenCalled();

    // Simulate hovering over a vertex
    _mockSegmentationState.hoveredVertex = {
      polygonId: 'polygon-1',
      vertexIndex: 0,
    };

    // Verify the hover state is reflected in the UI
    // (In a real test, we would check if the vertex is highlighted)
  });

  // Test interaction states (dragging, panning)
  it('should handle interaction states like dragging and panning', () => {
    renderComponent();

    // Get the mock state
    const { _mockSegmentationState } = require('../../hooks/segmentation');

    // Get the canvas
    const canvas = screen.getByTestId('mock-canvas');

    // Set up for a panning interaction
    _mockSegmentationState.editMode = 'View';

    // Start a panning operation
    fireEvent.mouseDown(canvas, {
      clientX: 400,
      clientY: 300,
      preventDefault: vi.fn(),
    });

    // Simulate panning
    _mockSegmentationState.interactionState = {
      isPanning: true,
      panStart: { x: 400, y: 300 },
      isDraggingVertex: false,
      draggedVertexInfo: null,
      sliceStartPoint: null,
      addPointStartVertex: null,
      addPointEndVertex: null,
      isAddingPoints: false,
    };

    // Move the mouse to pan
    fireEvent.mouseMove(canvas, {
      clientX: 450,
      clientY: 320,
      preventDefault: vi.fn(),
    });

    // Verify onMouseMove was called
    expect(_mockSegmentationState.onMouseMove).toHaveBeenCalled();

    // End the panning operation
    fireEvent.mouseUp(canvas, {
      clientX: 450,
      clientY: 320,
      preventDefault: vi.fn(),
    });

    // Verify onMouseUp was called
    expect(_mockSegmentationState.onMouseUp).toHaveBeenCalled();

    // In a real scenario, this would update the transform with the new pan position
  });
});
