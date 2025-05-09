import React from 'react';
import { TempPointsState } from '@/pages/segmentation/types';
import { Point } from '@/lib/segmentation';
import { useCoordinateTransform } from '@/pages/segmentation/hooks/polygonInteraction/useCoordinateTransform';

interface TemporaryEditPathProps {
  tempPoints: TempPointsState;
  cursorPosition: Point | null;
  zoom: number;
  offset: { x: number; y: number };
  isShiftPressed?: boolean;
}

const TemporaryEditPath = ({ 
  tempPoints, 
  cursorPosition, 
  zoom,
  offset,
  isShiftPressed
}: TemporaryEditPathProps) => {
  const { getScreenCoordinates } = useCoordinateTransform(zoom, offset);

  if (tempPoints.points.length === 0) return null;
  
  // Helper to transform points
  const transformPoint = (p: Point) => {
    const screenCoords = getScreenCoordinates(p.x, p.y);
    return { x: screenCoords.screenX, y: screenCoords.screenY };
  };

  // Transform points for rendering
  const transformedTempPoints = tempPoints.points.map(transformPoint);
  const transformedCursorPos = cursorPosition ? transformPoint(cursorPosition) : null;
  
  // Dynamicky nastavíme tloušťku čáry podle zoomu - OBRÁCENĚ
  const getStrokeWidth = () => {
    if (zoom > 4) {
      return 4/zoom;
    } else if (zoom > 3) {
      return 3/zoom;
    } else if (zoom < 0.5) {
      return 1.5/zoom;
    } else if (zoom < 0.7) {
      return 2/zoom;
    } else {
      return 2.5/zoom;
    }
  };
  
  const strokeWidth = getStrokeWidth();
  
  const getPointRadius = () => {
    if (zoom > 4) {
      return 8/zoom;
    } else if (zoom > 3) {
      return 7/zoom;
    } else if (zoom < 0.5) {
      return 5/zoom;
    } else if (zoom < 0.7) {
      return 5.5/zoom;
    } else {
      return 6/zoom;
    }
  };
  
  const pointRadius = getPointRadius();
  
  // Create path data from transformed points
  const createPathData = (points: Point[], closePath: boolean = false): string => {
    if (!points || points.length === 0) return '';
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return closePath && points.length > 2 ? `${path} Z` : path;
  };
  
  const pathData = createPathData(transformedTempPoints, false);

  return (
    <g shapeRendering="geometricPrecision">
      {/* Temporary points path */}
      <path
        d={pathData}
        fill="none"
        stroke="#3498db"
        strokeWidth={strokeWidth}
        strokeDasharray={isShiftPressed ? `${5/zoom},${3/zoom}` : "none"}
        vectorEffect="non-scaling-stroke"
        shapeRendering="geometricPrecision"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Display dots for each transformed point */}
      {transformedTempPoints.map((point, index) => (
        <circle
          key={`temp-point-${index}`}
          cx={point.x}
          cy={point.y}
          r={index === 0 ? pointRadius * 1.5 : pointRadius}
          fill={index === 0 ? "#FFA500" : "#3498db"}
          stroke={index === 0 ? "#FFFF00" : "#FFFFFF"}
          strokeWidth={strokeWidth * (index === 0 ? 1.5 : 1)}
          vectorEffect="non-scaling-stroke"
          shapeRendering="geometricPrecision"
          style={{ pointerEvents: 'none' }}
          className={index === 0 ? "animate-pulse" : ""}
        />
      ))}
      
      {/* Show the connection line from last transformed point to transformed cursor */}
      {transformedCursorPos && transformedTempPoints.length > 0 && (
        <>
          <line
            x1={transformedTempPoints[transformedTempPoints.length - 1].x}
            y1={transformedTempPoints[transformedTempPoints.length - 1].y}
            x2={transformedCursorPos.x}
            y2={transformedCursorPos.y}
            stroke="#3498db"
            strokeWidth={strokeWidth}
            strokeDasharray={`${4/zoom},${4/zoom}`}
            vectorEffect="non-scaling-stroke"
            shapeRendering="geometricPrecision"
            style={{ pointerEvents: 'none' }}
          />
          {/* Visual indicator when close to the starting transformed point */}
          {transformedTempPoints.length > 2 && (
            <line
              x1={transformedTempPoints[0].x}
              y1={transformedTempPoints[0].y}
              x2={transformedCursorPos.x}
              y2={transformedCursorPos.y}
              stroke={
                Math.hypot(
                  transformedTempPoints[0].x - transformedCursorPos.x,
                  transformedTempPoints[0].y - transformedCursorPos.y
                ) < 20/zoom ? "#4CAF50" : "transparent"
              }
              strokeWidth={strokeWidth * 1.5}
              strokeDasharray={`${4/zoom},${4/zoom}`}
              vectorEffect="non-scaling-stroke"
              shapeRendering="geometricPrecision"
            />
          )}
        </>
      )}
    </g>
  );
};

export default TemporaryEditPath;
