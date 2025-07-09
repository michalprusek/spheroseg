import { RefObject } from 'react';
import { EditMode, InteractionState, Point, Polygon, SegmentationData, TransformState } from './types';
import { distanceToSegment, createPolygon, updateSegmentationWithPolygons } from './geometry';
import { isPointInPolygonSync } from './geometry.worker';
import { getCanvasCoordinates } from './coordinates';
import { CLOSE_POLYGON_DISTANCE, VERTEX_HIT_RADIUS } from './constants';
import { createLogger } from '@/lib/logger';

const logger = createLogger('segmentation:interactions');

/**
 * Calculate the area of a polygon using the Shoelace formula
 * @param points Array of points defining the polygon
 * @returns The area of the polygon
 */
export const calculatePolygonArea = (points: Point[]): number => {
  let area = 0;
  const n = points.length;

  // Need at least 3 points to form a polygon
  if (n < 3) return 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  // Take absolute value and divide by 2
  return Math.abs(area) / 2;
};

/**
 * Determine if a polygon is defined in clockwise or counter-clockwise order
 * @param points Array of points defining the polygon
 * @returns true if clockwise, false if counter-clockwise
 */
export const isPolygonClockwise = (points: Point[]): boolean => {
  let sum = 0;
  const n = points.length;

  // Need at least 3 points to form a polygon
  if (n < 3) return true;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += (points[j].x - points[i].x) * (points[j].y + points[i].y);
  }

  // Positive sum means clockwise, negative means counter-clockwise
  return sum > 0;
};

/**
 * Handle mouse down event
 */
export const handleMouseDown = (
  e: React.MouseEvent<HTMLDivElement>,
  editMode: EditMode,
  interactionState: InteractionState,
  segmentationData: SegmentationData | null,
  selectedPolygonId: string | null,
  tempPoints: Point[],
  transform: TransformState,
  canvasRef: RefObject<HTMLDivElement>,
  setSelectedPolygonId: (id: string | null) => void,
  setEditMode: (mode: EditMode) => void,
  setTempPoints: (points: Point[]) => void,
  setInteractionState: (state: InteractionState) => void,
  setSegmentationDataWithHistory: (data: SegmentationData | null, clearHistory: boolean) => void,
  startDragging?: (initialState: SegmentationData | null) => void,
) => {
  // Right-click - always cancel current operation
  if (e.button === 2) {
    if (editMode !== EditMode.View) {
      setEditMode(EditMode.View);
      setTempPoints([]);
    }
    // Stop event propagation to prevent context menu from showing
    e.stopPropagation();
    return;
  }

  // Left-click handling based on edit mode
  if (e.button === 0) {
    const coords = getCanvasCoordinates(e.clientX, e.clientY, transform, canvasRef);
    const { imageX, imageY } = coords;

    // In View mode, check if we clicked on a polygon first
    if (editMode === EditMode.View) {
      // Check if we clicked on a polygon
      if (segmentationData?.polygons) {
        // First, check for holes (internal polygons) - they have higher priority
        // We'll identify holes by checking if they're contained within another polygon

        // Create a map of polygons by ID for quick lookup
        const polygonsById = new Map();
        segmentationData.polygons.forEach((polygon) => {
          polygonsById.set(polygon.id, polygon);
        });

        // Find all polygons that contain the click point
        const containingPolygons = [];
        for (const polygon of segmentationData.polygons) {
          if (isPointInPolygonSync(imageX, imageY, polygon.points)) {
            containingPolygons.push(polygon);
          }
        }

        // Check if we're holding Alt key (for panning inside polygons)
        const isAltPressed = e.altKey;

        // If Alt key is pressed, always start panning regardless of polygon selection
        if (isAltPressed) {
          // Start panning
          setInteractionState({
            ...interactionState,
            isPanning: true,
            panStart: { x: e.clientX, y: e.clientY },
          });
          return;
        }

        // If we found multiple polygons, prioritize the smallest one (likely a hole)
        if (containingPolygons.length > 1) {
          // Sort by area (ascending) - smaller polygons first
          containingPolygons.sort((a, b) => {
            const areaA = calculatePolygonArea(a.points);
            const areaB = calculatePolygonArea(b.points);
            return areaA - areaB;
          });

          // Select the smallest polygon (likely a hole)
          setSelectedPolygonId(containingPolygons[0].id);
          setEditMode(EditMode.EditVertices);

          // Start panning even when a polygon is selected
          setInteractionState({
            ...interactionState,
            isPanning: true,
            panStart: { x: e.clientX, y: e.clientY },
          });
          return;
        }

        // If we only found one polygon, select it
        if (containingPolygons.length === 1) {
          setSelectedPolygonId(containingPolygons[0].id);
          setEditMode(EditMode.EditVertices);

          // Start panning even when a polygon is selected
          setInteractionState({
            ...interactionState,
            isPanning: true,
            panStart: { x: e.clientX, y: e.clientY },
          });
          return;
        }
      }

      // If we didn't click on a polygon, start panning
      setInteractionState({
        ...interactionState,
        isPanning: true,
        panStart: { x: e.clientX, y: e.clientY },
      });
      return;
    }

    // Handle polygon creation
    if (editMode === EditMode.CreatePolygon) {
      // Check if we're clicking near the first point to close the polygon
      if (tempPoints.length >= 3) {
        const firstPoint = tempPoints[0];
        const dx = firstPoint.x - imageX;
        const dy = firstPoint.y - imageY;
        const closeDistance = CLOSE_POLYGON_DISTANCE / transform.zoom;

        if (Math.sqrt(dx * dx + dy * dy) <= closeDistance) {
          // Close the polygon
          if (segmentationData) {
            const newPolygon = createPolygon(tempPoints);

            setSegmentationDataWithHistory(
              {
                ...segmentationData,
                polygons: [...segmentationData.polygons, newPolygon],
              },
              false,
            );

            // Reset temporary points and switch back to view mode
            setTempPoints([]);
            setEditMode(EditMode.View);
            return;
          }
        }
      }

      // Add point to temporary points
      setTempPoints([...tempPoints, { x: imageX, y: imageY }]);
      return;
    }

    // Handle vertex editing
    if (editMode === EditMode.EditVertices && selectedPolygonId) {
      // Check if we're clicking on a vertex
      const selectedPolygon = segmentationData?.polygons.find((p) => p.id === selectedPolygonId);
      if (selectedPolygon) {
        // Find the vertex we're clicking on (if any)
        const vertexIndex = selectedPolygon.points.findIndex((point) => {
          const dx = point.x - imageX;
          const dy = point.y - imageY;
          // Adjust hit area based on zoom
          const hitRadius = VERTEX_HIT_RADIUS / transform.zoom;
          return Math.sqrt(dx * dx + dy * dy) <= hitRadius;
        });

        if (vertexIndex !== -1) {
          // Get the original position before dragging starts (for undo/redo)
          const originalPosition = { ...selectedPolygon.points[vertexIndex] };

          // Start the dragging system with the current state
          if (startDragging && segmentationData) {
            startDragging(segmentationData);
          }

          // Start dragging this vertex
          setInteractionState({
            ...interactionState,
            isDraggingVertex: true,
            draggedVertexInfo: { polygonId: selectedPolygonId, vertexIndex },
            originalVertexPosition: originalPosition, // Store the original position
          });
          return;
        }
      }
    }

    // Handle adding points to existing polygon - enhanced version
    if (editMode === EditMode.AddPoints && selectedPolygonId) {
      const selectedPolygon = segmentationData?.polygons.find((p) => p.id === selectedPolygonId);
      if (selectedPolygon) {
        // Check if we're in the middle of adding a sequence of points
        if (interactionState.isAddingPoints) {
          // If we already have a start vertex, check if we're clicking on another vertex to complete the sequence
          if (interactionState.addPointStartVertex) {
            // Find the closest vertex to the click point
            let closestVertexIndex = -1;
            let minDistance = Infinity;
            const hitRadius = VERTEX_HIT_RADIUS / transform.zoom;

            for (let i = 0; i < selectedPolygon.points.length; i++) {
              const point = selectedPolygon.points[i];
              const dx = point.x - imageX;
              const dy = point.y - imageY;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < minDistance) {
                minDistance = distance;
                closestVertexIndex = i;
              }
            }

            // If we found a close enough vertex and it's not the start vertex
            if (
              minDistance <= hitRadius &&
              closestVertexIndex !== -1 &&
              closestVertexIndex !== interactionState.addPointStartVertex.vertexIndex
            ) {
              // Set the end vertex
              const endVertex = {
                polygonId: selectedPolygonId,
                vertexIndex: closestVertexIndex,
              };

              logger.info(`Completing add points sequence at vertex ${closestVertexIndex}`);

              // Process the completed sequence
              if (tempPoints.length > 0) {
                // Get the start and end vertex indices
                const startIdx = interactionState.addPointStartVertex.vertexIndex;
                const endIdx = closestVertexIndex;

                // Create a new array of points for the polygon
                let newPoints: Point[] = [];

                // Determine which path to replace (the one with smaller perimeter)
                // Path 1: startIdx to endIdx
                // Path 2: endIdx to startIdx

                // Calculate the length of the new path
                let newPathLength = 0;
                for (let i = 0; i < tempPoints.length - 1; i++) {
                  const p1 = tempPoints[i];
                  const p2 = tempPoints[i + 1];
                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  newPathLength += Math.sqrt(dx * dx + dy * dy);
                }

                // Add the distance from start vertex to first temp point
                const startPoint = selectedPolygon.points[startIdx];
                const firstTempPoint = tempPoints[0];
                const dxStart = firstTempPoint.x - startPoint.x;
                const dyStart = firstTempPoint.y - startPoint.y;
                newPathLength += Math.sqrt(dxStart * dxStart + dyStart * dyStart);

                // Add the distance from last temp point to end vertex
                const endPoint = selectedPolygon.points[endIdx];
                const lastTempPoint = tempPoints[tempPoints.length - 1];
                const dxEnd = endPoint.x - lastTempPoint.x;
                const dyEnd = endPoint.y - lastTempPoint.y;
                newPathLength += Math.sqrt(dxEnd * dxEnd + dyEnd * dyEnd);

                // Calculate the perimeter of the two possible resulting polygons
                // Option 1: Keep path1 (startIdx to endIdx) and replace path2 with new path
                const option1Points = [...selectedPolygon.points];

                // Option 2: Keep path2 (endIdx to startIdx) and replace path1 with new path
                const option2Points = [...selectedPolygon.points];

                // Determine the orientation of the polygon (clockwise or counter-clockwise)
                const isClockwise = isPolygonClockwise(selectedPolygon.points);
                logger.info(`Polygon orientation: ${isClockwise ? 'clockwise' : 'counter-clockwise'}`);

                // Determine if we need to go forward or backward in the array based on indices and orientation
                // We want to follow the natural direction of the polygon

                // Calculate the distance between indices in both directions
                const numPoints = selectedPolygon.points.length;
                const forwardDistance = endIdx >= startIdx ? endIdx - startIdx : numPoints - startIdx + endIdx;
                const backwardDistance = startIdx >= endIdx ? startIdx - endIdx : numPoints - endIdx + startIdx;

                // Determine if we should go forward or backward based on the shortest path
                // and the orientation of the polygon
                const goForward = forwardDistance <= backwardDistance === isClockwise;

                logger.info(
                  `Replacing segment between vertices ${startIdx} and ${endIdx} with ${tempPoints.length} new points`,
                );
                logger.info(
                  `Forward distance: ${forwardDistance}, Backward distance: ${backwardDistance}, Going: ${goForward ? 'forward' : 'backward'}`,
                );

                // Create a new array for the updated points
                if (goForward) {
                  if (startIdx <= endIdx) {
                    // Simple case: no wrapping around the array
                    // Keep points before startIdx (inclusive) and after endIdx (inclusive)
                    const pointsBefore = selectedPolygon.points.slice(0, startIdx + 1);
                    const pointsAfter = selectedPolygon.points.slice(endIdx);

                    // Combine: points before startIdx + new points + points after endIdx
                    newPoints = [...pointsBefore, ...tempPoints, ...pointsAfter];

                    logger.info(
                      `Forward, no wrap: ${pointsBefore.length} points before, ${tempPoints.length} new points, ${pointsAfter.length} points after`,
                    );
                  } else {
                    // Complex case: wrapping around the array
                    // We need to keep points from startIdx to end and from 0 to endIdx
                    const pointsStart = selectedPolygon.points.slice(startIdx);
                    const pointsEnd = selectedPolygon.points.slice(0, endIdx + 1);

                    newPoints = [...pointsStart, ...tempPoints, ...pointsEnd];

                    logger.info(
                      `Forward, wrap: ${pointsStart.length} points before, ${tempPoints.length} new points, ${pointsEnd.length} points after`,
                    );
                  }
                } else {
                  // Going backward - we need to reverse the temp points
                  const reversedTempPoints = [...tempPoints].reverse();

                  if (endIdx <= startIdx) {
                    // Simple case: no wrapping around the array
                    // Keep points before endIdx (inclusive) and after startIdx (inclusive)
                    const pointsBefore = selectedPolygon.points.slice(0, endIdx + 1);
                    const pointsAfter = selectedPolygon.points.slice(startIdx);

                    // Combine: points before endIdx + reversed new points + points after startIdx
                    newPoints = [...pointsBefore, ...reversedTempPoints, ...pointsAfter];

                    logger.info(
                      `Backward, no wrap: ${pointsBefore.length} points before, ${reversedTempPoints.length} new points, ${pointsAfter.length} points after`,
                    );
                  } else {
                    // Complex case: wrapping around the array
                    // We need to keep points from endIdx to end and from 0 to startIdx
                    const pointsEnd = selectedPolygon.points.slice(endIdx);
                    const pointsStart = selectedPolygon.points.slice(0, startIdx + 1);

                    newPoints = [...pointsEnd, ...reversedTempPoints, ...pointsStart];

                    logger.info(
                      `Backward, wrap: ${pointsEnd.length} points before, ${reversedTempPoints.length} new points, ${pointsStart.length} points after`,
                    );
                  }
                }

                logger.info(
                  `Original polygon had ${selectedPolygon.points.length} points, new polygon has ${newPoints.length} points`,
                );

                // Update the polygon
                if (segmentationData) {
                  const updatedPolygons = segmentationData.polygons.map((polygon) => {
                    if (polygon.id === selectedPolygonId) {
                      return { ...polygon, points: newPoints };
                    }
                    return polygon;
                  });

                  setSegmentationDataWithHistory(
                    {
                      ...segmentationData,
                      polygons: updatedPolygons,
                    },
                    false,
                  );
                }
              }

              // Reset the state
              setTempPoints([]);
              setInteractionState({
                ...interactionState,
                isAddingPoints: false,
                addPointStartVertex: null,
                addPointEndVertex: null,
              });

              // Switch back to view mode
              setEditMode(EditMode.View);
              return;
            }

            // If we didn't click on a vertex, add the point to the temporary sequence
            const newPoint = { x: imageX, y: imageY };
            setTempPoints([...tempPoints, newPoint]);
            return;
          }
        } else {
          // We're not adding points yet, check if we're clicking on a vertex to start
          let closestVertexIndex = -1;
          let minDistance = Infinity;
          const hitRadius = VERTEX_HIT_RADIUS / transform.zoom;

          logger.info(`Checking for vertex click in Add Points mode, hitRadius: ${hitRadius}`);

          for (let i = 0; i < selectedPolygon.points.length; i++) {
            const point = selectedPolygon.points[i];
            const dx = point.x - imageX;
            const dy = point.y - imageY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
              minDistance = distance;
              closestVertexIndex = i;
            }
          }

          logger.info(`Closest vertex: ${closestVertexIndex}, distance: ${minDistance}, hitRadius: ${hitRadius}`);

          // If we found a close enough vertex, start adding points
          if (minDistance <= hitRadius && closestVertexIndex !== -1) {
            // Start adding points
            setInteractionState({
              ...interactionState,
              isAddingPoints: true,
              addPointStartVertex: {
                polygonId: selectedPolygonId,
                vertexIndex: closestVertexIndex,
              },
            });

            // Clear any existing temporary points
            setTempPoints([]);

            logger.info(`Starting to add points from vertex ${closestVertexIndex}`);
            return;
          } else {
            logger.info(`No vertex found close enough to start adding points`);
          }
        }

        // If we get here, we're in the old behavior - find the closest segment and add a point
        // This is the fallback for backward compatibility
        let closestSegmentStart = -1;
        let minDistance = Infinity;

        for (let i = 0; i < selectedPolygon.points.length; i++) {
          const p1 = selectedPolygon.points[i];
          const p2 = selectedPolygon.points[(i + 1) % selectedPolygon.points.length];

          // Calculate distance from point to line segment
          const distance = distanceToSegment({ x: imageX, y: imageY }, p1, p2);

          if (distance < minDistance) {
            minDistance = distance;
            closestSegmentStart = i;
          }
        }

        // If we found a close enough segment, add a point
        const maxDistance = 20 / transform.zoom;
        if (minDistance <= maxDistance && closestSegmentStart !== -1) {
          // Create a new point and insert it after the segment start
          const newPoint = { x: imageX, y: imageY };
          const newPoints = [...selectedPolygon.points];
          newPoints.splice(closestSegmentStart + 1, 0, newPoint);

          // Update the polygon
          if (segmentationData) {
            const updatedPolygons = segmentationData.polygons.map((polygon) => {
              if (polygon.id === selectedPolygonId) {
                return { ...polygon, points: newPoints };
              }
              return polygon;
            });

            setSegmentationDataWithHistory(
              {
                ...segmentationData,
                polygons: updatedPolygons,
              },
              false,
            );
          }
          return;
        }
      }
    }

    // Handle slicing - improved approach
    if (editMode === EditMode.Slice) {
      // Step 1: If no polygon is selected, first select a polygon
      if (!selectedPolygonId && segmentationData?.polygons) {
        // Find all polygons that contain the click point
        const containingPolygons = [];
        for (const polygon of segmentationData.polygons) {
          if (isPointInPolygonSync(imageX, imageY, polygon.points)) {
            containingPolygons.push(polygon);
          }
        }

        // If we found multiple polygons, prioritize the smallest one (likely a hole)
        if (containingPolygons.length > 1) {
          // Sort by area (ascending) - smaller polygons first
          containingPolygons.sort((a, b) => {
            const areaA = calculatePolygonArea(a.points);
            const areaB = calculatePolygonArea(b.points);
            return areaA - areaB;
          });

          // Select the smallest polygon (likely a hole)
          setSelectedPolygonId(containingPolygons[0].id);
          return; // Exit after selecting polygon - wait for next click to start slicing
        }

        // If we only found one polygon, select it
        if (containingPolygons.length === 1) {
          setSelectedPolygonId(containingPolygons[0].id);
          return; // Exit after selecting polygon - wait for next click to start slicing
        }

        return;
      }

      // Step 2: If polygon is selected, handle slice point placement
      if (selectedPolygonId) {
        const selectedPolygon = segmentationData?.polygons.find((p) => p.id === selectedPolygonId);

        if (selectedPolygon) {
          console.log('[Slice Mode] Selected polygon bounds:', {
            id: selectedPolygonId,
            points: selectedPolygon.points.length,
            minX: Math.min(...selectedPolygon.points.map((p) => p.x)),
            maxX: Math.max(...selectedPolygon.points.map((p) => p.x)),
            minY: Math.min(...selectedPolygon.points.map((p) => p.y)),
            maxY: Math.max(...selectedPolygon.points.map((p) => p.y)),
          });

          if (!interactionState.sliceStartPoint) {
            // First click - set slice start point
            console.log('[Slice Mode] Setting first slice point:', { x: imageX, y: imageY });
            setInteractionState({
              ...interactionState,
              sliceStartPoint: { x: imageX, y: imageY },
            });
            setTempPoints([{ x: imageX, y: imageY }]);
          } else {
            // Second click - complete the slice by setting the end point
            console.log('[Slice Mode] Setting second slice point:', { x: imageX, y: imageY });
            console.log('[Slice Mode] Complete slice line:', {
              start: interactionState.sliceStartPoint,
              end: { x: imageX, y: imageY },
            });
            // The actual slicing will be handled by the component that has access to handleSliceAction
            setTempPoints([interactionState.sliceStartPoint, { x: imageX, y: imageY }]);

            // Reset the slice start point after setting both points
            setInteractionState({
              ...interactionState,
              sliceStartPoint: null,
            });

            // The component will detect that we have 2 points and trigger the slice
          }
        }
      }
      return;
    }

    // Handle delete polygon mode
    if (editMode === EditMode.DeletePolygon) {
      if (segmentationData?.polygons) {
        // Find all polygons that contain the click point
        const containingPolygons = [];
        for (const polygon of segmentationData.polygons) {
          if (isPointInPolygonSync(imageX, imageY, polygon.points)) {
            containingPolygons.push(polygon);
          }
        }

        // If we found multiple polygons, prioritize the smallest one (likely a hole)
        if (containingPolygons.length > 1) {
          // Sort by area (ascending) - smaller polygons first
          containingPolygons.sort((a, b) => {
            const areaA = calculatePolygonArea(a.points);
            const areaB = calculatePolygonArea(b.points);
            return areaA - areaB;
          });

          // Delete the smallest polygon (likely a hole)
          const polygonToDelete = containingPolygons[0];
          const updatedPolygons = segmentationData.polygons.filter((p) => p.id !== polygonToDelete.id);
          setSegmentationDataWithHistory(
            {
              ...segmentationData,
              polygons: updatedPolygons,
            },
            false,
          );
          return;
        }

        // If we only found one polygon, delete it
        if (containingPolygons.length === 1) {
          const polygonToDelete = containingPolygons[0];
          const updatedPolygons = segmentationData.polygons.filter((p) => p.id !== polygonToDelete.id);
          setSegmentationDataWithHistory(
            {
              ...segmentationData,
              polygons: updatedPolygons,
            },
            false,
          );
          return;
        }
      }
      return;
    }

    // Handle polygon selection (in any mode except DeletePolygon, Slice, and AddPoints with isAddingPoints)
    if (
      segmentationData?.polygons &&
      editMode !== EditMode.Slice &&
      !(editMode === EditMode.AddPoints && interactionState.isAddingPoints)
    ) {
      // Find all polygons that contain the click point
      const containingPolygons = [];
      for (const polygon of segmentationData.polygons) {
        if (isPointInPolygonSync(imageX, imageY, polygon.points)) {
          containingPolygons.push(polygon);
        }
      }

      // Check if we're holding Alt key (for panning inside polygons)
      const isAltPressed = e.altKey;

      // If Alt key is pressed, always start panning regardless of polygon selection
      if (isAltPressed) {
        // Start panning
        setInteractionState({
          ...interactionState,
          isPanning: true,
          panStart: { x: e.clientX, y: e.clientY },
        });
        return;
      }

      // If we found multiple polygons, prioritize the smallest one (likely a hole)
      if (containingPolygons.length > 1) {
        // Sort by area (ascending) - smaller polygons first
        containingPolygons.sort((a, b) => {
          const areaA = calculatePolygonArea(a.points);
          const areaB = calculatePolygonArea(b.points);
          return areaA - areaB;
        });

        // Select the smallest polygon (likely a hole)
        setSelectedPolygonId(containingPolygons[0].id);

        // Only automatically enter edit vertices mode when a polygon is selected
        // if we're not already in AddPoints mode
        if (editMode !== EditMode.AddPoints) {
          setEditMode(EditMode.EditVertices);
        }

        // Start panning even when a polygon is selected
        setInteractionState({
          ...interactionState,
          isPanning: true,
          panStart: { x: e.clientX, y: e.clientY },
        });
        return;
      }

      // If we only found one polygon, select it
      if (containingPolygons.length === 1) {
        setSelectedPolygonId(containingPolygons[0].id);

        // Only automatically enter edit vertices mode when a polygon is selected
        // if we're not already in AddPoints mode
        if (editMode !== EditMode.AddPoints) {
          setEditMode(EditMode.EditVertices);
        }

        // Start panning even when a polygon is selected
        setInteractionState({
          ...interactionState,
          isPanning: true,
          panStart: { x: e.clientX, y: e.clientY },
        });
        return;
      }

      // If we get here, we didn't click on any polygon
      setSelectedPolygonId(null);

      // If we're in EditVertices mode, switch back to View mode
      if (editMode === EditMode.EditVertices) {
        setEditMode(EditMode.View);
      }

      // Start panning when deselecting a polygon
      // This ensures that panning works after deselecting a polygon
      setInteractionState({
        ...interactionState,
        isPanning: true,
        panStart: { x: e.clientX, y: e.clientY },
      });
    }
  }
};

/**
 * Handle mouse move event
 */
export const handleMouseMove = (
  e: React.MouseEvent<HTMLDivElement>,
  editMode: EditMode,
  interactionState: InteractionState,
  segmentationData: SegmentationData | null,
  selectedPolygonId: string | null,
  tempPoints: Point[],
  transform: TransformState,
  canvasRef: RefObject<HTMLDivElement>,
  isShiftPressed: boolean,
  lastAutoAddedPoint: Point | null,
  setHoveredVertex: (vertex: { polygonId: string; vertexIndex: number } | null) => void,
  setTempPoints: (points: Point[]) => void,
  setLastAutoAddedPoint: (point: Point | null) => void,
  setTransform: (transform: TransformState) => void,
  setInteractionState: (state: InteractionState) => void,
  setSegmentationDataWithHistory: (data: SegmentationData | null, clearHistory: boolean) => void,
  updateDuringDrag?: (state: SegmentationData | null) => void,
) => {
  const coords = getCanvasCoordinates(e.clientX, e.clientY, transform, canvasRef);
  const { imageX, imageY } = coords;
  const currentPoint = { x: imageX, y: imageY };

  // Handle equidistant point placement with Shift key in CreatePolygon or AddPoints mode
  if (
    isShiftPressed &&
    (editMode === EditMode.CreatePolygon || (editMode === EditMode.AddPoints && interactionState.isAddingPoints))
  ) {
    // For Add Points mode, if we don't have any temp points yet but we have a start vertex,
    // we need to use the start vertex as the reference point
    let referencePoint: Point;

    if (
      editMode === EditMode.AddPoints &&
      interactionState.isAddingPoints &&
      interactionState.addPointStartVertex &&
      tempPoints.length === 0
    ) {
      // Find the selected polygon and get the start vertex
      const selectedPolygon = segmentationData?.polygons.find((p) => p.id === selectedPolygonId);
      if (selectedPolygon && interactionState.addPointStartVertex.vertexIndex < selectedPolygon.points.length) {
        referencePoint = selectedPolygon.points[interactionState.addPointStartVertex.vertexIndex];

        // If we don't have a last auto-added point, set it to the start vertex
        if (!lastAutoAddedPoint) {
          setLastAutoAddedPoint(referencePoint);
        }
      } else {
        // If we can't find the start vertex, skip this iteration
        return;
      }
    } else if (tempPoints.length > 0) {
      // For both modes when we already have temp points
      referencePoint = tempPoints[tempPoints.length - 1];

      // If we don't have a last auto-added point, set it to the last point in tempPoints
      if (!lastAutoAddedPoint) {
        setLastAutoAddedPoint(referencePoint);
      }
    } else {
      // If we don't have temp points and we're not in Add Points mode with a start vertex,
      // skip this iteration
      return;
    }

    // Calculate distance from last auto-added point to current cursor
    // Make sure lastAutoAddedPoint is not null before accessing its properties
    if (!lastAutoAddedPoint) {
      // If lastAutoAddedPoint is null, set it to the reference point and skip this iteration
      setLastAutoAddedPoint(referencePoint);
      return;
    }

    const dx = currentPoint.x - lastAutoAddedPoint.x;
    const dy = currentPoint.y - lastAutoAddedPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Minimum distance for adding a new point (adjust as needed)
    const MIN_DISTANCE = 20 / transform.zoom;

    if (distance >= MIN_DISTANCE) {
      // Add a new point at the current cursor position
      setTempPoints([...tempPoints, currentPoint]);
      setLastAutoAddedPoint(currentPoint);

      logger.debug(`Added equidistant point at (${currentPoint.x}, ${currentPoint.y}), distance: ${distance}`);
    }
  }

  // Handle panning
  if (interactionState.isPanning) {
    if (interactionState.panStart) {
      const dx = e.clientX - interactionState.panStart.x;
      const dy = e.clientY - interactionState.panStart.y;

      setTransform({
        ...transform,
        translateX: transform.translateX + dx,
        translateY: transform.translateY + dy,
      });

      setInteractionState({
        ...interactionState,
        panStart: { x: e.clientX, y: e.clientY },
      });
    }
    return;
  }

  // Handle vertex dragging
  if (interactionState.isDraggingVertex && interactionState.draggedVertexInfo) {
    const { polygonId, vertexIndex } = interactionState.draggedVertexInfo;

    // Update the polygon's vertex position
    if (segmentationData && polygonId && vertexIndex !== null) {
      // Store the original vertex position if not already stored
      // This is a safety check in case handleMouseDown didn't capture it
      if (!interactionState.originalVertexPosition) {
        // Find the original position
        const polygon = segmentationData.polygons.find((p) => p.id === polygonId);
        if (polygon && vertexIndex < polygon.points.length) {
          // Log that we're capturing this late (should be a rare case)
          logger.warn('Capturing original vertex position during drag (not in mouseDown)');

          // Store the original position in the interaction state
          setInteractionState({
            ...interactionState,
            originalVertexPosition: { ...polygon.points[vertexIndex] },
          });

          // Continue with the next event to ensure we have the original position
          return;
        }
      }

      const updatedPolygons = segmentationData.polygons.map((polygon) => {
        if (polygon.id === polygonId) {
          const updatedPoints = [...polygon.points];
          updatedPoints[vertexIndex] = { x: imageX, y: imageY };
          return { ...polygon, points: updatedPoints };
        }
        return polygon;
      });

      const updatedState = {
        ...segmentationData,
        polygons: updatedPolygons,
      };

      // Use the new dragging system to update the display during drag
      if (updateDuringDrag) {
        updateDuringDrag(updatedState);
      } else {
        // Fallback to the old system if not available
        setSegmentationDataWithHistory(updatedState, false);
      }
    }
    return;
  }

  // Update temporary points for slicing
  if (editMode === EditMode.Slice && interactionState.sliceStartPoint) {
    // Only show preview line if we have a selected polygon
    if (selectedPolygonId) {
      setTempPoints([interactionState.sliceStartPoint, { x: imageX, y: imageY }]);
    }
    return;
  }

  // Update cursor position for Add Points mode
  if (editMode === EditMode.AddPoints && interactionState.isAddingPoints && interactionState.addPointStartVertex) {
    // If we have temp points, show a line from the last temp point to the cursor
    if (tempPoints.length > 0) {
      // Don't modify the temp points array, just show a preview line in the UI
      // This will be handled in the Canvas component
    } else if (selectedPolygonId) {
      // If we don't have any temp points yet, show a line from the start vertex to the cursor
      const selectedPolygon = segmentationData?.polygons.find((p) => p.id === selectedPolygonId);
      if (selectedPolygon && interactionState.addPointStartVertex) {
        const startVertex = selectedPolygon.points[interactionState.addPointStartVertex.vertexIndex];
        // We don't need to set temp points here, just update the cursor position
        // The Canvas component will handle drawing the line from start vertex to cursor
      }
    }
  }

  // Update hover state for vertices in EditVertices or AddPoints mode
  if ((editMode === EditMode.EditVertices || editMode === EditMode.AddPoints) && selectedPolygonId) {
    const selectedPolygon = segmentationData?.polygons.find((p) => p.id === selectedPolygonId);
    if (selectedPolygon) {
      // Find the closest vertex within hit radius
      let closestVertexIndex = -1;
      let minDistance = Infinity;
      const hitRadius = VERTEX_HIT_RADIUS / transform.zoom;

      for (let i = 0; i < selectedPolygon.points.length; i++) {
        const point = selectedPolygon.points[i];
        const dx = point.x - imageX;
        const dy = point.y - imageY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= hitRadius && distance < minDistance) {
          minDistance = distance;
          closestVertexIndex = i;
        }
      }

      // If we found a vertex within hit radius, hover it
      if (closestVertexIndex !== -1) {
        setHoveredVertex({
          polygonId: selectedPolygonId,
          vertexIndex: closestVertexIndex,
        });
        return;
      }

      // Not hovering over any vertex
      setHoveredVertex(null);
    }
  }

  // If we're in AddPoints mode but no polygon is selected, check all polygons for hover
  if (editMode === EditMode.AddPoints && !selectedPolygonId && segmentationData?.polygons) {
    // Find the closest vertex within hit radius across all polygons
    let closestPolygonId = null;
    let closestVertexIndex = -1;
    let minDistance = Infinity;
    const hitRadius = VERTEX_HIT_RADIUS / transform.zoom;

    for (const polygon of segmentationData.polygons) {
      for (let i = 0; i < polygon.points.length; i++) {
        const point = polygon.points[i];
        const dx = point.x - imageX;
        const dy = point.y - imageY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= hitRadius && distance < minDistance) {
          minDistance = distance;
          closestVertexIndex = i;
          closestPolygonId = polygon.id;
        }
      }
    }

    // If we found a vertex within hit radius, hover it
    if (closestPolygonId !== null && closestVertexIndex !== -1) {
      setHoveredVertex({
        polygonId: closestPolygonId,
        vertexIndex: closestVertexIndex,
      });
      return;
    }

    // Not hovering over any vertex
    setHoveredVertex(null);
  }
};

/**
 * Handle mouse up event
 */
export const handleMouseUp = (
  e: React.MouseEvent<HTMLDivElement>,
  interactionState: InteractionState,
  setInteractionState: (state: InteractionState) => void,
  segmentationData: SegmentationData | null,
  setSegmentationDataWithHistory: (data: SegmentationData | null, clearHistory: boolean) => void,
  finishDragging?: (finalState: SegmentationData | null) => void,
) => {
  // End panning
  if (interactionState.isPanning) {
    setInteractionState({
      ...interactionState,
      isPanning: false,
      panStart: null,
    });
  }

  // End vertex dragging
  if (interactionState.isDraggingVertex) {
    // If we have the original vertex position and the segmentation data,
    // complete the dragging operation using the new system
    if (interactionState.originalVertexPosition && interactionState.draggedVertexInfo && segmentationData) {
      // Log the drag operation
      const { polygonId, vertexIndex } = interactionState.draggedVertexInfo;
      const polygon = segmentationData.polygons.find((p) => p.id === polygonId);

      if (polygon && vertexIndex !== undefined && vertexIndex < polygon.points.length) {
        const finalPosition = polygon.points[vertexIndex];
        logger.debug(
          `Vertex drag completed: from (${interactionState.originalVertexPosition.x}, ${interactionState.originalVertexPosition.y}) to (${finalPosition.x}, ${finalPosition.y})`,
        );

        // Check if position actually changed (to avoid unnecessary history entries)
        const originalPos = interactionState.originalVertexPosition;
        const hasChanged =
          Math.abs(originalPos.x - finalPosition.x) > 0.001 || Math.abs(originalPos.y - finalPosition.y) > 0.001;

        // Use the new dragging system to complete the operation
        if (hasChanged && finishDragging) {
          finishDragging(segmentationData);
        } else if (finishDragging) {
          // Still need to finish dragging even if no change occurred
          finishDragging(null);
        }

        if (!hasChanged) {
          logger.debug(`Vertex position didn't change significantly, skipping history update`);
        }
      }
    }

    // Don't reset originalVertexPosition here - it needs to be available for
    // onMouseUp in useSegmentationV2 to properly handle the history update
    // We'll just mark dragging as finished
    setInteractionState({
      ...interactionState,
      isDraggingVertex: false,
      // Keep draggedVertexInfo and originalVertexPosition for history handling
    });
  }
};

/**
 * Handle wheel event for zooming
 */
export const handleWheel = (
  e: WheelEvent,
  transform: TransformState,
  canvasRef: RefObject<HTMLDivElement>,
  setTransform: (transform: TransformState) => void,
) => {
  // Get mouse position relative to canvas
  const canvasEl = canvasRef.current;
  if (!canvasEl) return;

  const rect = canvasEl.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Calculate zoom factor based on wheel delta with better sensitivity control
  // Smaller base values make zooming smoother
  const scaleFactor = 0.05; // Reduced from implicit 0.1 to make zooming smoother
  const zoomFactor = e.deltaY < 0 ? 1 + scaleFactor : 1 - scaleFactor;

  // Apply zoom limits
  const newZoom = Math.max(0.5, Math.min(10.0, transform.zoom * zoomFactor));

  // Skip if the zoom level didn't change
  if (newZoom === transform.zoom) return;

  // Calculate new translation to zoom toward/away from mouse position
  const mouseXBeforeZoom = (mouseX - transform.translateX) / transform.zoom;
  const mouseYBeforeZoom = (mouseY - transform.translateY) / transform.zoom;

  const newTranslateX = mouseX - mouseXBeforeZoom * newZoom;
  const newTranslateY = mouseY - mouseYBeforeZoom * newZoom;

  // Use requestAnimationFrame for smoother updates
  requestAnimationFrame(() => {
    setTransform({
      zoom: newZoom,
      translateX: newTranslateX,
      translateY: newTranslateY,
    });
  });

  // Prevent default scroll behavior and stop propagation
  e.preventDefault();
  e.stopPropagation();
};

/**
 * Delete the selected polygon
 */
export const handleDeletePolygon = (
  selectedPolygonId: string | null,
  segmentationData: SegmentationData | null,
  setSelectedPolygonId: (id: string | null) => void,
  setSegmentationDataWithHistory: (data: SegmentationData | null, clearHistory: boolean) => void,
) => {
  if (!selectedPolygonId || !segmentationData) return;

  // Filter out the selected polygon
  const updatedPolygons = segmentationData.polygons.filter((polygon) => polygon.id !== selectedPolygonId);

  // Update segmentation data
  setSegmentationDataWithHistory(
    {
      ...segmentationData,
      polygons: updatedPolygons,
    },
    false,
  );

  // Clear selection
  setSelectedPolygonId(null);
};
