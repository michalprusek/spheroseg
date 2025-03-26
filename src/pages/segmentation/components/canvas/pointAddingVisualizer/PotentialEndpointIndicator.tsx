
import React from 'react';
import { Point } from '@/lib/segmentation';
import { getPointRadius, getStrokeWidth, getColors } from './visualizationUtils';

interface PotentialEndpointIndicatorProps {
  selectedVertexIndex: number | null;
  polygonPoints: Point[] | null;
  hoveredSegment: {
    polygonId: string | null,
    segmentIndex: number | null,
    projectedPoint: Point | null
  };
  zoom: number;
}

/**
 * Komponenta pro zobrazení potenciálních koncových bodů
 */
const PotentialEndpointIndicator = ({ 
  selectedVertexIndex, 
  polygonPoints, 
  hoveredSegment, 
  zoom 
}: PotentialEndpointIndicatorProps) => {
  if (selectedVertexIndex === null || !polygonPoints) {
    return null;
  }

  const pointRadius = getPointRadius(zoom);
  const strokeWidth = getStrokeWidth(zoom);
  const colors = getColors();

  return (
    <>
      {polygonPoints.map((point, index) => {
        // Nezobrazujeme počáteční bod znovu
        if (index === selectedVertexIndex) return null;
        
        // Zvýraznění bodu pod kurzorem
        const isHovered = hoveredSegment.segmentIndex === index;
        
        return (
          <circle
            key={`potential-endpoint-${index}`}
            cx={point.x}
            cy={point.y}
            r={pointRadius * (isHovered ? 1.3 : 1)}
            fill={isHovered ? colors.hoverPoint.fill : colors.potentialEndpoint.fill}
            stroke={isHovered ? colors.hoverPoint.stroke : colors.potentialEndpoint.stroke}
            strokeWidth={strokeWidth * (isHovered ? 1.2 : 0.8)}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}
    </>
  );
};

export default PotentialEndpointIndicator;
