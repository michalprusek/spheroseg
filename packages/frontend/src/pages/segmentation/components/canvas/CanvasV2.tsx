import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Point } from '@/types';
import { EditMode, InteractionState } from '@/pages/segmentation/hooks/segmentation'; // Import EditMode from refactored location
import { useDebouncedCallback } from 'use-debounce';
import { createNamespacedLogger } from '@/utils/logger';
import CanvasImageLayer from './CanvasImageLayer'; // Import the new component
import CanvasPolygonLayer from './CanvasPolygonLayer'; // Import the polygon layer component
import CanvasVertexLayer from './CanvasVertexLayer'; // Import the vertex layer component
import CanvasTemporaryGeometryLayer from './CanvasTemporaryGeometryLayer'; // Import the temporary geometry layer component

// Create a logger for this module
const logger = createNamespacedLogger('segmentation:canvas');

// --- Types ---
interface TransformState {
  zoom: number;
  translateX: number;
  translateY: number;
}

interface ImageData {
  width: number;
  height: number;
  src: string;
  alternativeUrls?: string[]; // Added this property
}

interface Polygon {
  id: string;
  points: Point[];
  type?: 'external' | 'internal'; // Make sure this matches the type in types/index.ts
  class?: string;
  color?: string; // Keep if needed for other overrides
  parentId?: string; // If relevant for hierarchy
}

interface SegmentationData {
  polygons: Polygon[];
}

interface CanvasV2Props {
  imageData: ImageData | null;
  segmentationData: SegmentationData | null;
  transform: TransformState;
  selectedPolygonId: string | null;
  hoveredVertex: { polygonId: string; vertexIndex: number } | null;
  setHoveredVertex: (vertex: { polygonId: string; vertexIndex: number } | null) => void;
  tempPoints: Point[]; // For drawing new polygons or slice lines
  editMode: EditMode;
  canvasRef: React.RefObject<HTMLDivElement | null>; // Required canvasRef prop, allowing null
  interactionState: InteractionState; // Add interaction state for Add Points mode
  // Additional functions needed for vertex interactions
  setSelectedPolygonId: (id: string | null) => void;
  setEditMode: (mode: EditMode) => void;
  setTempPoints: (points: Point[]) => void;
  setInteractionState: (state: InteractionState) => void;
  // Interaction handlers
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (event: React.MouseEvent<HTMLDivElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void; // Changed to HTMLDivElement
  // Potentially add onMouseLeave, onMouseEnter if needed
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void; // Optional context menu
}

// --- Component Definition ---
const CanvasV2: React.FC<CanvasV2Props> = ({
  imageData,
  segmentationData,
  transform,
  selectedPolygonId,
  hoveredVertex,
  setHoveredVertex,
  tempPoints,
  editMode,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  onContextMenu,
  canvasRef,
  interactionState,
  setSelectedPolygonId,
  setEditMode,
  setTempPoints,
  setInteractionState,
}) => {
  // State to track current mouse position for drawing the line to cursor
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);

  // State to track if Shift key is pressed
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  // Add event listeners for keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Calculate cursor position from mouse event
  const calculateCursorPosition = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): Point | null => {
      if (!canvasRef || !canvasRef.current) return null;

      const rect = canvasRef.current.getBoundingClientRect();

      // Apply cursor offset for arrow cursor (adjust these values based on testing)
      // For a standard arrow cursor, we need to adjust the offset to match the tip of the arrow
      // Negative values move the effective click point up and left
      const cursorOffsetX = -2; // Move the effective click point 2px to the left
      const cursorOffsetY = -2; // Move the effective click point 2px up

      const x = (e.clientX + cursorOffsetX - rect.left - transform.translateX) / transform.zoom;
      const y = (e.clientY + cursorOffsetY - rect.top - transform.translateY) / transform.zoom;

      return { x, y };
    },
    [canvasRef, transform.translateX, transform.translateY, transform.zoom],
  );

  // Create debounced function for cursor position updates
  const debouncedSetCursorPosition = useDebouncedCallback(
    (position: Point | null) => {
      if (position) setCursorPosition(position);
    },
    50, // 50ms debounce delay - adjust as needed for performance vs responsiveness
  );

  // Last cursor position for threshold comparison
  const lastPositionRef = useRef<Point | null>(null);

  // Handle mouse move to update cursor position
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const newPosition = calculateCursorPosition(e);

      if (newPosition) {
        // Only update if position has changed significantly to prevent unnecessary updates
        if (
          !lastPositionRef.current ||
          Math.abs(newPosition.x - lastPositionRef.current.x) > 0.5 ||
          Math.abs(newPosition.y - lastPositionRef.current.y) > 0.5
        ) {
          // Update the last position reference immediately
          lastPositionRef.current = newPosition;

          // Use the debounced setter for the React state
          debouncedSetCursorPosition(newPosition);

          // For immediate feedback on drawing operations, also set directly
          // when in CreatePolygon, Slice, or AddPoints mode (when actively adding points)
          if (
            editMode === EditMode.CreatePolygon ||
            editMode === EditMode.Slice ||
            (editMode === EditMode.AddPoints && interactionState?.isAddingPoints)
          ) {
            setCursorPosition(newPosition);
          }
        }
      }

      // Call the original onMouseMove handler
      onMouseMove(e);
    },
    [calculateCursorPosition, debouncedSetCursorPosition, onMouseMove, editMode],
  );

  const formatPoints = (points: Point[]): string => {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  };

  const transformString = `translate(${transform.translateX} ${transform.translateY}) scale(${transform.zoom})`;

  const getPolygonStyle = (polygon: Polygon) => {
    const isSelected = polygon.id === selectedPolygonId;
    const baseColor = polygon.type === 'internal' ? 'blue' : 'red'; // Blue for internal (holes), red for external

    // Define base fill colors with different opacity levels
    const baseFillOpacity = isSelected ? 0.5 : 0.3; // Higher opacity (less transparent) when selected
    const baseFill =
      polygon.type === 'internal' ? `rgba(0, 0, 255, ${baseFillOpacity})` : `rgba(255, 0, 0, ${baseFillOpacity})`;

    // Special case for slice mode only
    let strokeColor = baseColor;
    if (isSelected && editMode === EditMode.Slice) {
      strokeColor = '#00FF00'; // Bright green stroke only for slice mode
    }

    return {
      // Fill with transparency - same color but different opacity when selected
      fill: baseFill,
      // Stroke color - only change for slice mode
      stroke: strokeColor,
      strokeWidth: isSelected ? 2 / transform.zoom : 1 / transform.zoom, // Thicker stroke when selected
      cursor: 'default', // Indicate clickable
    };
  };

  const vertexRadius = 5 / transform.zoom; // Make vertices smaller when zoomed out
  const hoveredVertexRadius = 7 / transform.zoom; // Make hovered vertices larger than normal vertices

  return (
    <div
      ref={canvasRef} // Attach the canvas ref here
      role="presentation" // Add role for testing
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#222',
        cursor: 'default',
        position: 'relative' /* Default cursor */,
      }}
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent default to avoid refresh
        e.stopPropagation(); // Stop propagation to parent elements
        onMouseDown(e);
      }}
      onMouseMove={(e) => {
        e.preventDefault(); // Prevent default
        e.stopPropagation(); // Stop propagation
        handleMouseMove(e);
      }}
      onMouseUp={(e) => {
        e.preventDefault(); // Prevent default
        e.stopPropagation(); // Stop propagation
        onMouseUp(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault(); // Prevent context menu
        e.stopPropagation(); // Stop propagation
        if (onContextMenu) onContextMenu(e);
      }}
    >
      {/* Show instruction text for all modes - fixed position in canvas */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: 'bold',
          maxWidth: '300px',
          pointerEvents: 'none',
          zIndex: 1000,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        }}
      >
        {editMode === EditMode.Slice ? (
          !selectedPolygonId ? (
            <div>
              <div style={{ color: '#ffcc00', marginBottom: '4px' }}>Slice Mode</div>
              <div>1. Click on a polygon to select it for slicing</div>
            </div>
          ) : tempPoints.length === 0 ? (
            <div>
              <div style={{ color: '#ffcc00', marginBottom: '4px' }}>Slice Mode</div>
              <div>2. Click to set the start point of the slice</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>Press ESC to cancel</div>
            </div>
          ) : (
            <div>
              <div style={{ color: '#ffcc00', marginBottom: '4px' }}>Slice Mode</div>
              <div>3. Click to set the end point and complete the slice</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>Press ESC to cancel</div>
            </div>
          )
        ) : editMode === EditMode.CreatePolygon ? (
          tempPoints.length === 0 ? (
            <div>
              <div style={{ color: '#4ade80', marginBottom: '4px' }}>Create Polygon Mode</div>
              <div>1. Click to start creating a polygon</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                Hold SHIFT to automatically add points
              </div>
            </div>
          ) : tempPoints.length < 3 ? (
            <div>
              <div style={{ color: '#4ade80', marginBottom: '4px' }}>Create Polygon Mode</div>
              <div>2. Continue clicking to add more points (at least 3 needed)</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                Hold SHIFT to automatically add points • Press ESC to cancel
              </div>
            </div>
          ) : (
            <div>
              <div style={{ color: '#4ade80', marginBottom: '4px' }}>Create Polygon Mode</div>
              <div>3. Continue adding points or click near the first point to close the polygon</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                Hold SHIFT to automatically add points • Press ESC to cancel
              </div>
            </div>
          )
        ) : editMode === EditMode.AddPoints ? (
          !interactionState?.isAddingPoints ? (
            <div>
              <div style={{ color: '#60a5fa', marginBottom: '4px' }}>Add Points Mode</div>
              <div>Click on any vertex to start adding points</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>Press ESC to cancel</div>
            </div>
          ) : (
            <div>
              <div style={{ color: '#60a5fa', marginBottom: '4px' }}>Add Points Mode</div>
              <div>Click to add points, then click on another vertex to complete</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                Hold SHIFT to automatically add points • Press ESC to cancel
              </div>
            </div>
          )
        ) : editMode === EditMode.EditVertices ? (
          selectedPolygonId ? (
            <div>
              <div style={{ color: '#f97316', marginBottom: '4px' }}>Edit Vertices Mode</div>
              <div>Click and drag vertices to move them</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                Hold SHIFT and click a vertex to add points • Double-click a vertex to delete it
              </div>
            </div>
          ) : (
            <div>
              <div style={{ color: '#f97316', marginBottom: '4px' }}>Edit Vertices Mode</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                Click on a polygon to select it for editing
              </div>
            </div>
          )
        ) : editMode === EditMode.DeletePolygon ? (
          <div>
            <div style={{ color: '#ef4444', marginBottom: '4px' }}>Delete Polygon Mode</div>
            <div>Click on a polygon to delete it</div>
          </div>
        ) : (
          <div>
            <div style={{ color: '#a3a3a3', marginBottom: '4px' }}>View Mode</div>
            <div>Click on a polygon to select it</div>
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>Drag to pan • Scroll to zoom</div>
          </div>
        )}
      </div>

      {/* Mode change notification removed */}

      {/* Keyboard shortcuts button removed */}

      {/* Add CSS animation for the notification */}
      <style>
        {`
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                `}
      </style>
      <svg
        width="100%"
        height="100%"
        onWheel={(e) => {
          // Call the onWheel handler
          onWheel(e);
          // Stop event propagation to prevent page scrolling
          e.stopPropagation();
        }}
      >
        <g transform={transformString}>
          {/* Render Image */}
          <CanvasImageLayer imageData={imageData} transform={transform} />

          {/* Render Polygons with virtualization */}
          <CanvasPolygonLayer
            segmentationData={segmentationData}
            transform={transform}
            selectedPolygonId={selectedPolygonId}
            editMode={editMode}
            canvasRef={canvasRef}
          />

          {/* Render Vertices */}
          <CanvasVertexLayer
            segmentationData={segmentationData}
            transform={transform}
            selectedPolygonId={selectedPolygonId}
            hoveredVertex={hoveredVertex}
            setHoveredVertex={setHoveredVertex}
            editMode={editMode}
            interactionState={interactionState}
            isShiftPressed={isShiftPressed}
            setSelectedPolygonId={setSelectedPolygonId}
            setEditMode={setEditMode}
            setTempPoints={setTempPoints}
            setInteractionState={setInteractionState}
            onMouseDown={onMouseDown}
          />

          {/* Render Temporary Geometry (e.g., for CreatePolygon or Slice) */}
          <CanvasTemporaryGeometryLayer
            transform={transform}
            editMode={editMode}
            tempPoints={tempPoints}
            cursorPosition={cursorPosition}
            interactionState={interactionState}
            selectedPolygonId={selectedPolygonId}
            segmentationData={segmentationData}
          />

          {/* Add other rendering logic as needed (hover effects on segments, etc.) */}
        </g>
      </svg>
    </div>
  );
};

// Set display name for better debugging
CanvasV2.displayName = 'CanvasV2';

export default CanvasV2;
