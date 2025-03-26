
import React from 'react';
import { Point } from '@/lib/segmentation';

interface PointAddingVisualizerProps {
  hoveredSegment: {
    polygonId: string | null,
    segmentIndex: number | null,
    projectedPoint: Point | null
  };
  zoom: number;
  tempPoints: Point[];
  selectedVertexIndex: number | null;
  sourcePolygonId: string | null;
  polygonPoints: Point[] | null;
  cursorPosition?: Point | null;
}

/**
 * Komponenta pro vizualizaci režimu přidávání bodů
 */
const PointAddingVisualizer = ({
  hoveredSegment,
  zoom,
  tempPoints,
  selectedVertexIndex,
  sourcePolygonId,
  polygonPoints,
  cursorPosition
}: PointAddingVisualizerProps) => {
  if (!selectedVertexIndex && selectedVertexIndex !== 0) {
    // První fáze - uživatel ještě nevybral počáteční bod
    return (
      <g>
        {/* Zvýrazníme bod, který je pod kurzorem */}
        {hoveredSegment.segmentIndex !== null && hoveredSegment.projectedPoint && (
          <circle
            cx={hoveredSegment.projectedPoint.x}
            cy={hoveredSegment.projectedPoint.y}
            r={8/zoom}
            fill="#FFA500"
            stroke="#FFFFFF"
            strokeWidth={2/zoom}
            className="animate-pulse"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </g>
    );
  }

  // Nastavení tloušťky čáry podle zoomu - OBRÁCENĚ
  const getStrokeWidth = () => {
    if (zoom > 4) return 4/zoom;
    if (zoom > 3) return 3/zoom;
    if (zoom < 0.5) return 1.5/zoom;
    if (zoom < 0.7) return 2/zoom;
    return 2.5/zoom;
  };
  
  const strokeWidth = getStrokeWidth();
  
  // Velikost bodů podle zoomu
  const getPointRadius = () => {
    if (zoom > 4) return 8/zoom;
    if (zoom > 3) return 7/zoom;
    if (zoom < 0.5) return 5/zoom;
    if (zoom < 0.7) return 5.5/zoom;
    return 6/zoom;
  };
  
  const pointRadius = getPointRadius();

  // Druhá fáze - uživatel vybral počáteční bod a přidává nové body
  return (
    <g>
      {/* Zvýrazněný počáteční bod */}
      {selectedVertexIndex !== null && polygonPoints && polygonPoints[selectedVertexIndex] && (
        <circle
          cx={polygonPoints[selectedVertexIndex].x}
          cy={polygonPoints[selectedVertexIndex].y}
          r={pointRadius * 1.2}
          fill="#FFA500"
          stroke="#FFFFFF"
          strokeWidth={strokeWidth * 1.5}
          className="animate-pulse"
          style={{ pointerEvents: 'none' }}
        />
      )}
      
      {/* Zvýrazněné všechny ostatní body polygonu jako možné koncové body */}
      {polygonPoints && selectedVertexIndex !== null && (
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
                fill={isHovered ? "#FEF7CD" : "#FEF7CD80"}
                stroke={isHovered ? "#FFFF00" : "#FFFFFF"}
                strokeWidth={strokeWidth * (isHovered ? 1.5 : 1)}
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
        </>
      )}
      
      {/* Dočasné body a spojnice */}
      {tempPoints.length > 0 && (
        <>
          {/* Spojnice od výchozího bodu k prvnímu dočasnému bodu */}
          {selectedVertexIndex !== null && polygonPoints && polygonPoints[selectedVertexIndex] && tempPoints[0] && (
            <line
              x1={polygonPoints[selectedVertexIndex].x}
              y1={polygonPoints[selectedVertexIndex].y}
              x2={tempPoints[0].x}
              y2={tempPoints[0].y}
              stroke="#3498db"
              strokeWidth={strokeWidth}
              style={{ pointerEvents: 'none' }}
            />
          )}
          
          {/* Spojnice mezi dočasnými body */}
          {tempPoints.map((point, i) => {
            if (i === 0) return null;
            
            return (
              <line
                key={`temp-line-${i}`}
                x1={tempPoints[i-1].x}
                y1={tempPoints[i-1].y}
                x2={point.x}
                y2={point.y}
                stroke="#3498db"
                strokeWidth={strokeWidth}
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
          
          {/* Dočasné body */}
          {tempPoints.map((point, i) => (
            <circle
              key={`temp-point-${i}`}
              cx={point.x}
              cy={point.y}
              r={pointRadius}
              fill="#3498db"
              stroke="#FFFFFF"
              strokeWidth={strokeWidth}
              style={{ pointerEvents: 'none' }}
            />
          ))}
          
          {/* Spojnice od posledního dočasného bodu ke kurzoru */}
          {cursorPosition && tempPoints.length > 0 && (
            <line
              x1={tempPoints[tempPoints.length - 1].x}
              y1={tempPoints[tempPoints.length - 1].y}
              x2={cursorPosition.x}
              y2={cursorPosition.y}
              stroke="#3498db"
              strokeWidth={strokeWidth}
              strokeDasharray={`${4/zoom},${4/zoom}`}
              style={{ pointerEvents: 'none' }}
            />
          )}
          
          {/* Vizuální indikátor při přiblížení k potenciálnímu koncovému bodu */}
          {hoveredSegment.segmentIndex !== null && 
           hoveredSegment.segmentIndex !== selectedVertexIndex &&
           hoveredSegment.projectedPoint &&
           tempPoints.length > 0 && (
            <line
              x1={tempPoints[tempPoints.length - 1].x}
              y1={tempPoints[tempPoints.length - 1].y}
              x2={hoveredSegment.projectedPoint.x}
              y2={hoveredSegment.projectedPoint.y}
              stroke="#4CAF50"
              strokeWidth={strokeWidth * 1.2}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </>
      )}
    </g>
  );
};

export default PointAddingVisualizer;
