import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Point } from '@/types';
import { EditMode, InteractionState } from '@/pages/segmentation/hooks/segmentation'; // Import EditMode from refactored location
import { debounce } from 'lodash';
import useImageLoader from '@/hooks/useImageLoader';
import { createLogger } from '@/lib/logger';
import filterVisiblePolygons from '../../utils/polygonVisibility';
import { toast } from 'react-hot-toast';

// Create a logger for this module
const logger = createLogger('segmentation:canvas');

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
  canvasRef: React.RefObject<HTMLDivElement>; // Required canvasRef prop
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
  onWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
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

  // Use the image loader hook for optimized image loading
  const {
    image,
    isLoading: isImageLoading,
    error: imageError,
  } = useImageLoader(imageData?.src || null, {
    crossOrigin: 'anonymous',
    cacheBuster: true,
    maxRetries: 5, // Zvýšený počet pokusů
    timeout: 60000, // Delší timeout
    alternativeUrls: imageData?.alternativeUrls || [], // Předání alternativních URL
  });

  // Log image loading status
  useEffect(() => {
    if (!imageData) {
      logger.debug('No image data provided');
      return;
    }

    if (isImageLoading) {
      logger.debug(`Loading image: ${imageData.src}`);
    } else if (imageError) {
      logger.error(`Failed to load image: ${imageData.src}`, imageError);
    } else if (image) {
      logger.info(`Image loaded successfully: ${imageData.src} (${image.width}x${image.height})`);
    }
  }, [imageData, image, isImageLoading, imageError]);

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
  const debouncedSetCursorPosition = useRef(
    debounce((position: Point | null) => {
      if (position) setCursorPosition(position);
    }, 50), // 50ms debounce delay - adjust as needed for performance vs responsiveness
  ).current;

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
          // when in CreatePolygon or Slice mode
          if (editMode === EditMode.CreatePolygon || editMode === EditMode.Slice) {
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
          {imageData && image && (
            <image
              href={image.src}
              x="0"
              y="0"
              width={imageData.width}
              height={imageData.height}
              style={{ imageRendering: 'pixelated' }} // Preserve pixels on zoom
            />
          )}

          {/* Show loading indicator if image is not loaded yet */}
          {imageData && (isImageLoading || !image) && (
            <g>
              <rect x="0" y="0" width={imageData.width} height={imageData.height} fill="#333" />
              <text
                x={imageData.width / 2}
                y={imageData.height / 2}
                fill="white"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={20 / transform.zoom}
              >
                Načítání obrázku...
              </text>
            </g>
          )}

          {/* Show error indicator if image failed to load */}
          {imageData && imageError && (
            <g>
              <rect x="0" y="0" width={imageData.width} height={imageData.height} fill="#500" opacity={0.7} />
              <text
                x={imageData.width / 2}
                y={imageData.height / 2}
                fill="white"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={20 / transform.zoom}
              >
                Chyba při načítání obrázku
              </text>
            </g>
          )}

          {/* Show error indicator when no image data is available */}
          {!imageData && (
            <g>
              <rect x="0" y="0" width={800} height={600} fill="#333" />
              <text
                x="400"
                y="300"
                fill="white"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={20 / transform.zoom}
              >
                Nepodařilo se načíst data obrázku
              </text>
              <text
                x="400"
                y="330"
                fill="white"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={16 / transform.zoom}
              >
                Zkuste to znovu nebo kontaktujte správce systému
              </text>
            </g>
          )}

          {/* Render Polygons with virtualization */}
          {useMemo(() => {
            // Skip virtualization if there are few polygons
            if (!segmentationData?.polygons || segmentationData.polygons.length < 50) {
              return segmentationData?.polygons.map((polygon) => (
                <polygon
                  key={polygon.id}
                  points={formatPoints(polygon.points)}
                  style={getPolygonStyle(polygon)}
                  vectorEffect="non-scaling-stroke"
                  // Add onClick handler here if selection should happen directly on polygon click
                  // onClick={(e) => { e.stopPropagation(); /* handle polygon click */ }}
                />
              ));
            }

            // Get canvas dimensions for viewport calculation
            const canvasWidth = canvasRef.current?.clientWidth || 1000;
            const canvasHeight = canvasRef.current?.clientHeight || 800;

            // Filter visible polygons
            const visiblePolygons = filterVisiblePolygons(
              segmentationData.polygons,
              canvasWidth,
              canvasHeight,
              transform,
            );

            logger.debug(`Rendering ${visiblePolygons.length} of ${segmentationData.polygons.length} polygons`);

            // Render only visible polygons
            return visiblePolygons.map((polygon) => (
              <polygon
                key={polygon.id}
                points={formatPoints(polygon.points)}
                style={getPolygonStyle(polygon)}
                vectorEffect="non-scaling-stroke"
                // Add onClick handler here if selection should happen directly on polygon click
                // onClick={(e) => { e.stopPropagation(); /* handle polygon click */ }}
              />
            ));
          }, [
            segmentationData?.polygons,
            transform,
            selectedPolygonId,
            canvasRef.current?.clientWidth,
            canvasRef.current?.clientHeight,
          ])}

          {/* Render Vertices for Selected Polygon in edit vertices mode */}
          {selectedPolygonId &&
            editMode !== EditMode.Slice &&
            editMode !== EditMode.AddPoints &&
            (() => {
              const selectedPolygon = segmentationData?.polygons.find((p) => p.id === selectedPolygonId);
              if (!selectedPolygon) return null;

              // Determine vertex fill color based on polygon type
              const vertexFillColor = selectedPolygon.type === 'internal' ? 'blue' : 'red';

              return selectedPolygon.points.map((point, index) => {
                const isHovered =
                  hoveredVertex?.polygonId === selectedPolygonId && hoveredVertex?.vertexIndex === index;
                return (
                  <circle
                    key={`${selectedPolygonId}-vertex-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? hoveredVertexRadius : vertexRadius}
                    fill={isHovered ? 'yellow' : vertexFillColor} // Use polygon color for vertices
                    stroke="black"
                    strokeWidth={1 / transform.zoom}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: isShiftPressed ? 'pointer' : 'default' }} // Change cursor based on Shift key
                    onClick={(e) => {
                      // Only handle click when Shift is pressed
                      if (isShiftPressed) {
                        e.stopPropagation();
                        console.log(
                          `[CanvasV2] Vertex clicked in Edit mode with Shift: polygon=${selectedPolygonId}, vertex=${index}`,
                        );

                        try {
                          // Switch to Add Points mode and start adding points from this vertex
                          setEditMode(EditMode.AddPoints);

                          // Set the interaction state to start adding points
                          setInteractionState({
                            ...interactionState,
                            isAddingPoints: true,
                            addPointStartVertex: {
                              polygonId: selectedPolygonId,
                              vertexIndex: index,
                            },
                          });

                          // Clear any existing temporary points
                          setTempPoints([]);

                          console.log(`[CanvasV2] Successfully started add points mode from vertex ${index}`);
                        } catch (error) {
                          console.error(`[CanvasV2] Error starting add points mode:`, error);
                        }
                      }
                    }}
                  />
                );
              });
            })()}

          {/* Removed: Render Vertices for ALL Polygons in View mode when Shift is pressed */}

          {/* Render Vertices for ALL Polygons in Add Points mode */}
          {editMode === EditMode.AddPoints && segmentationData?.polygons && (
            <>
              {segmentationData.polygons.map((polygon) =>
                polygon.points.map((point, index) => {
                  const isSelected = polygon.id === selectedPolygonId;
                  const isStartVertex =
                    isSelected &&
                    interactionState?.addPointStartVertex?.polygonId === selectedPolygonId &&
                    interactionState?.addPointStartVertex?.vertexIndex === index;
                  const isHovered = hoveredVertex?.polygonId === polygon.id && hoveredVertex?.vertexIndex === index;

                  // Determine vertex fill color based on polygon type
                  const vertexFillColor = polygon.type === 'internal' ? 'blue' : 'red';

                  // Choose fill color based on state
                  let fillColor: string;
                  if (isStartVertex) {
                    fillColor = 'lime'; // Special color for start vertex
                  } else if (isHovered) {
                    fillColor = 'yellow'; // Hover color takes precedence
                  } else if (isSelected) {
                    fillColor = vertexFillColor; // Use polygon color for selected polygon
                  } else {
                    fillColor = '#aaa'; // Gray for unselected polygons
                  }

                  return (
                    <circle
                      key={`${polygon.id}-vertex-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={isHovered ? hoveredVertexRadius : isStartVertex ? vertexRadius * 1.8 : vertexRadius}
                      fill={fillColor}
                      stroke="black"
                      strokeWidth={1 / transform.zoom}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() =>
                        setHoveredVertex({
                          polygonId: polygon.id,
                          vertexIndex: index,
                        })
                      }
                      onMouseLeave={() => setHoveredVertex(null)}
                      onClick={(e) => {
                        // Stop propagation to prevent the canvas from handling this event
                        e.stopPropagation();

                        console.log(
                          `[CanvasV2] Vertex clicked in AddPoints mode: polygon=${polygon.id}, vertex=${index}`,
                        );

                        try {
                          // If we're not already adding points, start adding points from this vertex
                          if (!interactionState.isAddingPoints) {
                            // Set the selected polygon
                            setSelectedPolygonId(polygon.id);

                            // Set the interaction state to start adding points
                            setInteractionState({
                              ...interactionState,
                              isAddingPoints: true,
                              addPointStartVertex: {
                                polygonId: polygon.id,
                                vertexIndex: index,
                              },
                            });

                            // Clear any existing temporary points
                            setTempPoints([]);

                            console.log(`[CanvasV2] Starting to add points from vertex ${index}`);
                          } else if (interactionState.addPointStartVertex) {
                            // We're already adding points, check if this is a different vertex to complete the sequence
                            if (
                              interactionState.addPointStartVertex.vertexIndex !== index ||
                              interactionState.addPointStartVertex.polygonId !== polygon.id
                            ) {
                              console.log(`[CanvasV2] Completing add points sequence at vertex ${index}`);

                              // Set the end vertex
                              const endVertex = {
                                polygonId: polygon.id,
                                vertexIndex: index,
                              };

                              // Process the completed sequence - we'll use the original onMouseDown handler
                              // Create a synthetic event that matches what the canvas expects
                              const syntheticEvent = {
                                ...e,
                                clientX: e.clientX,
                                clientY: e.clientY,
                                currentTarget: canvasRef.current,
                                target: canvasRef.current,
                                button: 0, // Left click
                              } as unknown as React.MouseEvent<HTMLDivElement>;

                              // Let the original onMouseDown handler handle this event
                              onMouseDown(syntheticEvent);
                            }
                          }
                        } catch (error) {
                          console.error(`[CanvasV2] Error handling vertex click in AddPoints mode:`, error);
                        }
                      }}
                    />
                  );
                }),
              )}
            </>
          )}

          {/* Render Temporary Geometry (e.g., for CreatePolygon or Slice) */}
          {editMode === EditMode.CreatePolygon && tempPoints.length > 0 && (
            <>
              {/* Render the polyline connecting all points */}
              <polyline
                points={formatPoints(tempPoints)}
                fill="none"
                stroke="cyan"
                strokeWidth={2 / transform.zoom}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }} // Prevent interaction with temp line
              />

              {/* Render vertices for each temporary point */}
              {tempPoints.map((point, index) => (
                <circle
                  key={`temp-point-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === 0 ? vertexRadius * 1.5 : vertexRadius} // Make first point larger
                  fill={index === 0 ? 'yellow' : 'cyan'} // Make first point a different color
                  stroke="black"
                  strokeWidth={1 / transform.zoom}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              ))}

              {/* Draw line from last point to cursor */}
              {tempPoints.length > 0 && cursorPosition && (
                <line
                  x1={tempPoints[tempPoints.length - 1].x}
                  y1={tempPoints[tempPoints.length - 1].y}
                  x2={cursorPosition.x}
                  y2={cursorPosition.y}
                  stroke="cyan"
                  strokeWidth={1.5 / transform.zoom}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </>
          )}

          {editMode === EditMode.Slice && (
            <>
              {/* Render the slice line */}
              {tempPoints.length === 2 && (
                <line
                  x1={tempPoints[0].x}
                  y1={tempPoints[0].y}
                  x2={tempPoints[1].x}
                  y2={tempPoints[1].y}
                  stroke="magenta"
                  strokeWidth={2 / transform.zoom}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }} // Prevent interaction with temp line
                />
              )}

              {/* Render vertices for each slice point */}
              {tempPoints.map((point, index) => (
                <circle
                  key={`slice-point-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={vertexRadius}
                  fill="magenta"
                  stroke="black"
                  strokeWidth={1 / transform.zoom}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              ))}

              {/* Draw line from last point to cursor for slice mode */}
              {tempPoints.length === 1 && cursorPosition && (
                <line
                  x1={tempPoints[0].x}
                  y1={tempPoints[0].y}
                  x2={cursorPosition.x}
                  y2={cursorPosition.y}
                  stroke="magenta"
                  strokeWidth={1.5 / transform.zoom}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </>
          )}

          {/* Render Add Points Mode UI */}
          {editMode === EditMode.AddPoints && selectedPolygonId && (
            <>
              {/* Render the polyline connecting all temporary points */}
              {interactionState?.isAddingPoints && tempPoints.length > 0 && (
                <polyline
                  points={formatPoints(tempPoints)}
                  fill="none"
                  stroke="cyan"
                  strokeWidth={3 / transform.zoom}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Render vertices for each temporary point */}
              {interactionState?.isAddingPoints &&
                tempPoints.map((point, index) => (
                  <circle
                    key={`add-point-temp-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={index === 0 ? vertexRadius * 1.5 : vertexRadius} // Make first point larger
                    fill={index === 0 ? 'yellow' : 'cyan'} // Make first point a different color
                    stroke="black"
                    strokeWidth={1 / transform.zoom}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                ))}

              {/* Draw line from start vertex to first temp point or cursor */}
              {interactionState?.isAddingPoints &&
                interactionState?.addPointStartVertex &&
                segmentationData?.polygons &&
                cursorPosition &&
                (() => {
                  const selectedPolygon = segmentationData.polygons.find((p) => p.id === selectedPolygonId);
                  if (
                    selectedPolygon &&
                    interactionState.addPointStartVertex.vertexIndex < selectedPolygon.points.length
                  ) {
                    const startPoint = selectedPolygon.points[interactionState.addPointStartVertex.vertexIndex];

                    // If we have temp points, draw from start vertex to first temp point
                    if (tempPoints.length > 0) {
                      return (
                        <line
                          x1={startPoint.x}
                          y1={startPoint.y}
                          x2={tempPoints[0].x}
                          y2={tempPoints[0].y}
                          stroke="cyan"
                          strokeWidth={2.5 / transform.zoom}
                          strokeDasharray={`${4 / transform.zoom},${4 / transform.zoom}`}
                          vectorEffect="non-scaling-stroke"
                          style={{ pointerEvents: 'none' }}
                        />
                      );
                    } else {
                      // Otherwise draw from start vertex to cursor
                      return (
                        <line
                          x1={startPoint.x}
                          y1={startPoint.y}
                          x2={cursorPosition.x}
                          y2={cursorPosition.y}
                          stroke="cyan"
                          strokeWidth={2.5 / transform.zoom}
                          strokeDasharray={`${4 / transform.zoom},${4 / transform.zoom}`}
                          vectorEffect="non-scaling-stroke"
                          style={{ pointerEvents: 'none' }}
                        />
                      );
                    }
                  }
                  return null;
                })()}

              {/* Draw line from last temp point to cursor */}
              {interactionState?.isAddingPoints && tempPoints.length > 0 && cursorPosition && (
                <line
                  x1={tempPoints[tempPoints.length - 1].x}
                  y1={tempPoints[tempPoints.length - 1].y}
                  x2={cursorPosition.x}
                  y2={cursorPosition.y}
                  stroke="cyan"
                  strokeWidth={2.5 / transform.zoom}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </>
          )}

          {/* Add other rendering logic as needed (hover effects on segments, etc.) */}
        </g>
      </svg>
    </div>
  );
};

// Set display name for better debugging
CanvasV2.displayName = 'CanvasV2';

export default CanvasV2;
