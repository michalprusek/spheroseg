import { Point } from '@/lib/segmentation';
import { getPointRadius, getStrokeWidth } from './visualizationUtils';

interface TempPointsPathProps {
  selectedVertexIndex: number | null;
  polygonPoints: Point[] | null;
  tempPoints: Point[];
}

/**
 * Renders the temporary points and lines connecting them during point adding.
 */
const TempPointsPath = ({ selectedVertexIndex, polygonPoints, tempPoints }: TempPointsPathProps) => {
  const strokeWidth = getStrokeWidth();
  const pointRadius = getPointRadius();

  const startPoint = selectedVertexIndex !== null && polygonPoints ? polygonPoints[selectedVertexIndex] : null;

  if (tempPoints.length === 0 || !startPoint) {
    return null;
  }

  return (
    <g>
      {/* Line from start point to first temp point */}
      {tempPoints[0] && (
        <line
          x1={startPoint.x}
          y1={startPoint.y}
          x2={tempPoints[0].x}
          y2={tempPoints[0].y}
          stroke="#3498db"
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Lines between temp points */}
      {tempPoints.map((point, i) => {
        if (i === 0) return null;
        const prevPoint = tempPoints[i - 1];
        return (
          <line
            key={`temp-line-${i}`}
            x1={prevPoint.x}
            y1={prevPoint.y}
            x2={point.x}
            y2={point.y}
            stroke="#3498db"
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: 'none' }}
          />
        );
      })}

      {/* Temporary points */}
      {tempPoints.map((point, i) => (
        <circle
          key={`temp-point-${i}`}
          cx={point.x}
          cy={point.y}
          r={pointRadius}
          fill="#3498db"
          stroke="#FFFFFF"
          strokeWidth={strokeWidth * 0.6}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </g>
  );
};

export default TempPointsPath;
