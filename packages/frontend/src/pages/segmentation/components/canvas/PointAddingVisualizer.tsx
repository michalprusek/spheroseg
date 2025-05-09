import React from 'react';
import { Point } from '@/lib/segmentation';
// import { useCoordinateTransform } from '@/pages/segmentation/hooks/polygonInteraction/useCoordinateTransform'; // Removed
import HighlightedSegment from './pointAddingVisualizer/HighlightedSegment';
import TempPointsPath from './pointAddingVisualizer/TempPointsPath';
import CursorLineConnector from './pointAddingVisualizer/CursorLineConnector';

// Constants for fixed styling
const HOVERED_POINT_RADIUS = 8;
const HOVERED_POINT_STROKE_WIDTH = 2;
const START_POINT_RADIUS_MULTIPLIER = 1.2;
const TEMP_POINT_RADIUS = 5;
const POTENTIAL_ENDPOINT_RADIUS_MULTIPLIER = 1.3;
const BASE_STROKE_WIDTH = 1.5;
const DASH_ARRAY = '4, 4'; // Fixed dash array for line to cursor

interface PointAddingVisualizerProps {
  hoveredSegment: {
    polygonId: string | null,
    segmentIndex: number | null,
    projectedPoint: Point | null // Expect image coordinates
  };
  // zoom: number; // Removed
  // offset: { x: number; y: number }; // Removed
  tempPoints: Point[]; // Expect image coordinates
  selectedVertexIndex: number | null;
  sourcePolygonId: string | null;
  polygonPoints: Point[] | null; // Expect image coordinates
  cursorPosition?: Point | null; // Expect image coordinates
}

/**
 * Component for visualizing the point adding mode using image coordinates.
 */
// Use Omit to reflect removed props
const PointAddingVisualizer = ({
  hoveredSegment,
  // zoom, // Removed
  // offset, // Removed
  tempPoints,
  selectedVertexIndex,
  sourcePolygonId,
  polygonPoints,
  cursorPosition
}: Omit<PointAddingVisualizerProps, 'zoom' | 'offset'>) => {
  // Remove coordinate transformation logic
  // const { getScreenCoordinates } = useCoordinateTransform(zoom, offset);
  // const transformPoint = ...;
  // const transformedCursorPos = ...;
  // const transformedProjectedPoint = ...;
  // const transformedTempPoints = ...;
  // const transformedPolygonPoints = ...;

  // Use props directly (image coordinates)
  const projectedPoint = hoveredSegment?.projectedPoint;

  // First phase - user hasn't selected a start point yet
  if (selectedVertexIndex === null) {
    return (
      <g>
        {/* Highlight the point under the cursor */}
        {hoveredSegment.segmentIndex !== null && projectedPoint && (
          <circle
            cx={projectedPoint.x} // Use image coordinate
            cy={projectedPoint.y} // Use image coordinate
            r={HOVERED_POINT_RADIUS} // Use fixed radius
            fill="#FFA500"
            stroke="#FFFFFF"
            strokeWidth={HOVERED_POINT_STROKE_WIDTH} // Use fixed width
            vectorEffect="non-scaling-stroke"
            className="animate-pulse"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </g>
    );
  }

  // Remove zoom-dependent styling calculations
  /*
  const getStrokeWidth = () => { ... };
  const strokeWidth = getStrokeWidth();
  const getPointRadius = () => { ... };
  const pointRadius = getPointRadius();
  */
  const strokeWidth = BASE_STROKE_WIDTH;
  const pointRadius = TEMP_POINT_RADIUS;

  // Second phase - start point selected, adding new points
  const startPoint = polygonPoints ? polygonPoints[selectedVertexIndex] : null;

  return (
    <g>
      {/* Highlighted start point */}
      {startPoint && (
        <circle
          cx={startPoint.x} // Use image coordinate
          cy={startPoint.y} // Use image coordinate
          r={pointRadius * START_POINT_RADIUS_MULTIPLIER} // Use fixed base radius + multiplier
          fill="#FFA500"
          stroke="#FFFFFF"
          strokeWidth={strokeWidth * 1.2} // Relative stroke width
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      )}
      
      {/* Highlight potential end points (other polygon vertices) */}
      {polygonPoints && selectedVertexIndex !== null && (
        <>
          {polygonPoints.map((point, index) => {
            if (index === selectedVertexIndex) return null;
            const isHovered = hoveredSegment.segmentIndex === index;
            return (
              <circle
                key={`potential-endpoint-${index}`}
                cx={point.x} // Use image coordinate
                cy={point.y} // Use image coordinate
                r={pointRadius * (isHovered ? POTENTIAL_ENDPOINT_RADIUS_MULTIPLIER : 1)} // Fixed base + multiplier
                fill={isHovered ? "#FFC107" : "#FFEB3B80"}
                stroke={isHovered ? "#FFA000" : "#FFC107"}
                strokeWidth={strokeWidth * (isHovered ? 1.2 : 1)} // Relative stroke width
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
        </>
      )}
      
      {/* Temporary points and lines */}
      {tempPoints.length > 0 && (
        <>
          {/* Line from start point to first temp point */}
          {startPoint && tempPoints[0] && (
            <line
              x1={startPoint.x} // Use image coordinate
              y1={startPoint.y} // Use image coordinate
              x2={tempPoints[0].x} // Use image coordinate
              y2={tempPoints[0].y} // Use image coordinate
              stroke="#3498db"
              strokeWidth={strokeWidth} // Use fixed width
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          )}
          
          {/* Lines between temp points */}
          {tempPoints.map((point, i) => {
            if (i === 0) return null;
            return (
              <line
                key={`temp-line-${i}`}
                x1={tempPoints[i-1].x} // Use image coordinate
                y1={tempPoints[i-1].y} // Use image coordinate
                x2={point.x} // Use image coordinate
                y2={point.y} // Use image coordinate
                stroke="#3498db"
                strokeWidth={strokeWidth} // Use fixed width
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
          
          {/* Temporary points */}
          {tempPoints.map((point, i) => (
            <circle
              key={`temp-point-${i}`}
              cx={point.x} // Use image coordinate
              cy={point.y} // Use image coordinate
              r={pointRadius} // Use fixed radius
              fill="#3498db"
              stroke="#FFFFFF"
              strokeWidth={strokeWidth} // Use fixed width
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          ))}
          
          {/* Line from last temp point to cursor or potential end point */}
          {tempPoints.length > 0 && (
            <line
              x1={tempPoints[tempPoints.length - 1].x} // Use image coordinate
              y1={tempPoints[tempPoints.length - 1].y} // Use image coordinate
              x2={hoveredSegment.segmentIndex !== null && hoveredSegment.segmentIndex !== selectedVertexIndex && projectedPoint 
                ? projectedPoint.x // Use image coordinate
                : (cursorPosition ? cursorPosition.x : tempPoints[tempPoints.length - 1].x)} // Use image coordinate
              y2={hoveredSegment.segmentIndex !== null && hoveredSegment.segmentIndex !== selectedVertexIndex && projectedPoint 
                ? projectedPoint.y // Use image coordinate
                : (cursorPosition ? cursorPosition.y : tempPoints[tempPoints.length - 1].y)} // Use image coordinate
              stroke={hoveredSegment.segmentIndex !== null && hoveredSegment.segmentIndex !== selectedVertexIndex ? "#4CAF50" : "#3498db"}
              strokeWidth={strokeWidth} // Use fixed width
              strokeDasharray={hoveredSegment.segmentIndex === null ? DASH_ARRAY : ""} // Use fixed dash array
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </>
      )}

      {/* Highlighted segment under cursor - pass transformer */}
      <HighlightedSegment 
        hoveredSegment={hoveredSegment} 
        polygonPoints={polygonPoints}
        // zoom={zoom} 
        // offset={offset}
      />

      {/* Temporary points and lines between them - pass transformed points */}
      <TempPointsPath 
        selectedVertexIndex={selectedVertexIndex} 
        polygonPoints={polygonPoints}
        tempPoints={tempPoints}
        // zoom={zoom} 
      />

      {/* Line from last point to cursor/projection - pass transformed points */}
      <CursorLineConnector 
        tempPoints={tempPoints}
        hoveredSegment={{
          ...hoveredSegment,
          projectedPoint: projectedPoint
        }} 
        selectedVertexIndex={selectedVertexIndex} 
        cursorPosition={cursorPosition}
        polygonPoints={polygonPoints}
        // zoom={zoom} 
      />
    </g>
  );
};

export default PointAddingVisualizer;
