import React from 'react';
import { Point } from '@/types';
import { EditMode, InteractionState } from '@/pages/segmentation/hooks/segmentation';

interface Polygon {
  id: string;
  points: Point[];
  type?: 'external' | 'internal';
}

interface SegmentationData {
  polygons: Polygon[];
}

interface CanvasTemporaryGeometryLayerProps {
  transform: { zoom: number };
  editMode: EditMode;
  tempPoints: Point[];
  cursorPosition: Point | null;
  interactionState: InteractionState;
  selectedPolygonId: string | null;
  segmentationData: SegmentationData | null;
}

const CanvasTemporaryGeometryLayer: React.FC<CanvasTemporaryGeometryLayerProps> = ({
  transform,
  editMode,
  tempPoints,
  cursorPosition,
  interactionState,
  selectedPolygonId,
  segmentationData,
}) => {
  const formatPoints = (points: Point[]): string => {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  };

  const vertexRadius = 5 / transform.zoom;

  return (
    <>
      {editMode === EditMode.CreatePolygon && tempPoints.length > 0 && (
        <>
          <polyline
            points={formatPoints(tempPoints)}
            fill="none"
            stroke="cyan"
            strokeWidth={2 / transform.zoom}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: 'none' }}
          />

          {tempPoints.map((point, index) => (
            <circle
              key={`temp-point-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === 0 ? vertexRadius * 1.5 : vertexRadius}
              fill={index === 0 ? 'yellow' : 'cyan'}
              stroke="black"
              strokeWidth={1 / transform.zoom}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          ))}

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
          {tempPoints.length === 2 && (
            <line
              x1={tempPoints[0].x}
              y1={tempPoints[0].y}
              x2={tempPoints[1].x}
              y2={tempPoints[1].y}
              stroke="magenta"
              strokeWidth={2 / transform.zoom}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          )}

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

      {editMode === EditMode.AddPoints && selectedPolygonId && (
        <>
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

          {interactionState?.isAddingPoints &&
            tempPoints.map((point, index) => (
              <circle
                key={`add-point-temp-${index}`}
                cx={point.x}
                cy={point.y}
                r={index === 0 ? vertexRadius * 1.5 : vertexRadius}
                fill={index === 0 ? 'yellow' : 'cyan'}
                stroke="black"
                strokeWidth={1 / transform.zoom}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            ))}

          {interactionState?.isAddingPoints &&
            interactionState?.addPointStartVertex &&
            segmentationData?.polygons &&
            cursorPosition &&
            (() => {
              const selectedPolygon = segmentationData.polygons.find((p) => p.id === selectedPolygonId);
              if (selectedPolygon && interactionState.addPointStartVertex.vertexIndex < selectedPolygon.points.length) {
                const startPoint = selectedPolygon.points[interactionState.addPointStartVertex.vertexIndex];

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
    </>
  );
};

CanvasTemporaryGeometryLayer.displayName = 'CanvasTemporaryGeometryLayer';

export default CanvasTemporaryGeometryLayer;
