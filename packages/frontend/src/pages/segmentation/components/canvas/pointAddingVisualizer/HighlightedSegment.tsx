import React from 'react';
import { Point } from '@/lib/segmentation';
import { getStrokeWidth, getColors, getPointRadius } from './visualizationUtils';
import { useCoordinateTransform } from '@/pages/segmentation/hooks/polygonInteraction/useCoordinateTransform';

interface HighlightedSegmentProps {
  hoveredSegment: {
    polygonId: string | null,
    segmentIndex: number | null,
    projectedPoint: Point | null
  };
  polygonPoints: Point[] | null;
  zoom: number;
  offset: { x: number; y: number };
}

const HighlightedSegment = ({
  hoveredSegment,
  polygonPoints,
  zoom,
  offset
}: HighlightedSegmentProps) => {
  const { getScreenCoordinates } = useCoordinateTransform(zoom, offset);

  if (hoveredSegment.segmentIndex === null || !polygonPoints) return null;

  const segmentIndex = hoveredSegment.segmentIndex;
  if (segmentIndex < 0 || segmentIndex >= polygonPoints.length) return null;
  const p1 = polygonPoints[segmentIndex];
  const nextIndex = (segmentIndex + 1) % polygonPoints.length;
  if (nextIndex >= polygonPoints.length) return null;
  const p2 = polygonPoints[nextIndex];

  const projectedPoint = hoveredSegment.projectedPoint;

  if (!p1 || !p2) return null;

  const canvasP1 = getScreenCoordinates(p1.x, p1.y);
  const canvasP2 = getScreenCoordinates(p2.x, p2.y);
  const canvasProjectedPoint = projectedPoint ? getScreenCoordinates(projectedPoint.x, projectedPoint.y) : null;

  const strokeWidth = getStrokeWidth(zoom);
  const colors = getColors();
  const projectedPointRadius = getPointRadius(zoom);

  return (
    <g>
      <line
        x1={canvasP1.screenX}
        y1={canvasP1.screenY}
        x2={canvasP2.screenX}
        y2={canvasP2.screenY}
        stroke={colors.line.hoveredColor}
        strokeWidth={strokeWidth * 1.5}
        style={{ pointerEvents: 'none' }}
      />

      {canvasProjectedPoint && (
        <circle
          cx={canvasProjectedPoint.screenX}
          cy={canvasProjectedPoint.screenY}
          r={projectedPointRadius * 1.1}
          fill={colors.hoverPoint.fill}
          stroke={colors.hoverPoint.stroke}
          strokeWidth={strokeWidth * 0.8}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </g>
  );
};

export default HighlightedSegment; 