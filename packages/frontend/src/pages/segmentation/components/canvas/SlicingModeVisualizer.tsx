import React from 'react';
import { Point } from '@/lib/segmentation';
// import { useCoordinateTransform } from '@/pages/segmentation/hooks/polygonInteraction/useCoordinateTransform'; // Removed

// Constants for styling, adjust as needed
const SLICE_STROKE_WIDTH = 2;
const SLICE_POINT_RADIUS = 6;
const SLICE_DASH_ARRAY = '8, 4'; // Fixed dash array

interface SlicingModeVisualizerProps {
  sliceStartPoint: Point | null; // Expected in image coordinates
  cursorPosition: Point | null; // Expected in image coordinates
  // zoom: number; // Removed
  // offset: { x: number; y: number }; // Removed
}

// Use Omit to reflect removed props in type signature
const SlicingModeVisualizer = ({
  sliceStartPoint,
  cursorPosition,
  // zoom, // Removed
  // offset // Removed
}: Omit<SlicingModeVisualizerProps, 'zoom' | 'offset'>) => {
  // Remove coordinate transformation hook
  // const { getScreenCoordinates } = useCoordinateTransform(zoom, offset);

  if (!sliceStartPoint) return null;

  // Remove zoom-dependent calculations
  /*
  const getStrokeWidth = () => { ... };
  const strokeWidth = getStrokeWidth();
  const getPointRadius = () => { ... };
  const pointRadius = getPointRadius();
  */
  const strokeWidth = SLICE_STROKE_WIDTH;
  const pointRadius = SLICE_POINT_RADIUS;

  // --- Use image coordinates directly for rendering ---
  // const startCanvasCoords = getScreenCoordinates(sliceStartPoint.x, sliceStartPoint.y);
  // const cursorCanvasCoords = cursorPosition ? getScreenCoordinates(cursorPosition.x, cursorPosition.y) : null;

  // Directly use image coordinates from props
  const startX = sliceStartPoint.x;
  const startY = sliceStartPoint.y;
  const cursorX = cursorPosition?.x;
  const cursorY = cursorPosition?.y;

  return (
    <g shapeRendering="geometricPrecision" style={{ pointerEvents: 'none' }}>
      {' '}
      {/* Disable pointer events on visualizer */}
      {/* Slicing indicator line */}
      {cursorPosition && (
        <line
          x1={startX} // Use image coordinate
          y1={startY} // Use image coordinate
          x2={cursorX} // Use image coordinate
          y2={cursorY} // Use image coordinate
          stroke="#FF3B30"
          strokeWidth={strokeWidth} // Use fixed width
          strokeDasharray={SLICE_DASH_ARRAY} // Use fixed dash array
          vectorEffect="non-scaling-stroke" // Let SVG handle scaling
          filter="url(#line-glow)"
        />
      )}
      {/* Slicing start point */}
      <circle
        cx={startX} // Use image coordinate
        cy={startY} // Use image coordinate
        r={pointRadius} // Use fixed radius
        fill="#FF3B30"
        stroke="#FFFFFF"
        strokeWidth={strokeWidth * 0.8} // Keep relative stroke width
        vectorEffect="non-scaling-stroke" // Let SVG handle scaling
        filter="url(#point-glow)"
      />
    </g>
  );
};

export default SlicingModeVisualizer;
