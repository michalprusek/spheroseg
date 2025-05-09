import React from 'react';
import type { Point } from '@/lib/segmentation';
// Remove useCoordinateTransform import
// import useCoordinateTransform from '@/pages/segmentation/hooks/useCoordinateTransform';
import { cn } from '@/lib/utils'; // Assuming cn utility for class names

// Define fixed visual constants
const VERTEX_RADIUS = 4; // Fixed radius in image coordinates
const VERTEX_STROKE_WIDTH = 1.5; // Fixed stroke width in image coordinates
const HOVERED_VERTEX_RADIUS_MULTIPLIER = 1.5;
const SELECTED_VERTEX_RADIUS_MULTIPLIER = 1.8;

/**
 * Props for the CanvasVertex component.
 * Removed zoom and offset.
 */
interface CanvasVertexProps {
  vertex: Point;
  isSelected: boolean;
  isHovered: boolean;
  isBeingDragged: boolean;
  polygonId: string;
  vertexIndex: number;
  onVertexMouseDown: (
    event: React.MouseEvent<SVGCircleElement>,
    polygonId: string,
    vertexIndex: number
  ) => void;
  onVertexMouseEnter: (
    event: React.MouseEvent<SVGCircleElement>,
    polygonId: string,
    vertexIndex: number
  ) => void;
  onVertexMouseLeave: (
    event: React.MouseEvent<SVGCircleElement>
  ) => void;
  isExternal?: boolean; // Optional prop to distinguish external polygons
}

/**
 * Renders a single vertex (point) of a polygon on the canvas.
 * Uses image coordinates directly and fixed styling.
 * Assumes parent SVG applies zoom/offset transformations.
 */
const CanvasVertex = React.memo(({
  vertex,
  isSelected,
  isHovered,
  isBeingDragged,
  polygonId,
  vertexIndex,
  onVertexMouseDown,
  onVertexMouseEnter,
  onVertexMouseLeave,
  isExternal = true, // Default to true if not provided
}: CanvasVertexProps) => {
  // Remove useCoordinateTransform hook usage
  // const { getScreenCoordinates } = useCoordinateTransform(zoom, offset, 0, 0); // Removed canvas dimensions

  // Calculate radius based on state, using fixed base radius
  let radius = VERTEX_RADIUS;
  if (isHovered) {
    radius *= HOVERED_VERTEX_RADIUS_MULTIPLIER;
  }
  if (isSelected || isBeingDragged) {
    radius *= SELECTED_VERTEX_RADIUS_MULTIPLIER;
  }

  // Removed screen coordinate calculation
  // const screenCoords = getScreenCoordinates(vertex.x, vertex.y);

  // Determine fill and stroke based on state and polygon type
  const fill = isSelected || isBeingDragged ? 'blue' : isExternal ? 'green' : 'red'; // Example: green for external, red for internal
  const stroke = isSelected || isBeingDragged ? 'darkblue' : 'black';

  return (
    <circle
      // Use vertex image coordinates directly
      cx={vertex.x}
      cy={vertex.y}
      // Apply calculated radius
      r={radius}
      fill={fill}
      stroke={stroke}
      // Use fixed stroke width and non-scaling effect
      strokeWidth={VERTEX_STROKE_WIDTH}
      vectorEffect="non-scaling-stroke" // Ensures stroke width doesn't scale with zoom
      onMouseDown={(e) => onVertexMouseDown(e, polygonId, vertexIndex)}
      onMouseEnter={(e) => onVertexMouseEnter(e, polygonId, vertexIndex)}
      onMouseLeave={onVertexMouseLeave}
      className={cn(
        'cursor-pointer transition-all duration-75',
        { 'fill-blue-500 stroke-blue-700': isSelected || isBeingDragged },
        { 'fill-yellow-400 stroke-yellow-600': isHovered && !(isSelected || isBeingDragged) },
        { 'fill-green-500 stroke-green-700': !isSelected && !isBeingDragged && !isHovered && isExternal },
        { 'fill-red-500 stroke-red-700': !isSelected && !isBeingDragged && !isHovered && !isExternal }
      )}
      style={{ transition: 'r 0.1s ease-in-out' }} // Smooth radius transition
      // Add data attributes for easier debugging or selection if needed
      data-polygon-id={polygonId}
      data-vertex-index={vertexIndex}
    />
  );
});

CanvasVertex.displayName = 'CanvasVertex';

export default CanvasVertex;
