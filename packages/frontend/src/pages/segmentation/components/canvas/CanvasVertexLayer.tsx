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

interface CanvasVertexLayerProps {
  segmentationData: SegmentationData | null;
  transform: { zoom: number };
  selectedPolygonId: string | null;
  hoveredVertex: { polygonId: string; vertexIndex: number } | null;
  setHoveredVertex: (vertex: { polygonId: string; vertexIndex: number } | null) => void;
  editMode: EditMode;
  interactionState: InteractionState;
  isShiftPressed: boolean;
  setSelectedPolygonId: (id: string | null) => void;
  setEditMode: (mode: EditMode) => void;
  setTempPoints: (points: Point[]) => void;
  setInteractionState: (state: InteractionState) => void;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const CanvasVertexLayer: React.FC<CanvasVertexLayerProps> = ({
  segmentationData,
  transform,
  selectedPolygonId,
  hoveredVertex,
  setHoveredVertex,
  editMode,
  interactionState,
  isShiftPressed,
  setSelectedPolygonId,
  setEditMode,
  setTempPoints,
  setInteractionState,
  onMouseDown,
}) => {
  const vertexRadius = 5 / transform.zoom;
  const hoveredVertexRadius = 7 / transform.zoom;

  return (
    <>
      {selectedPolygonId &&
        editMode !== EditMode.Slice &&
        editMode !== EditMode.AddPoints &&
        (() => {
          const selectedPolygon = segmentationData?.polygons.find((p) => p.id === selectedPolygonId);
          if (!selectedPolygon) return null;

          const vertexFillColor = selectedPolygon.type === 'internal' ? 'blue' : 'red';

          return selectedPolygon.points.map((point, index) => {
            const isHovered = hoveredVertex?.polygonId === selectedPolygonId && hoveredVertex?.vertexIndex === index;
            return (
              <circle
                key={`${selectedPolygonId}-vertex-${index}`}
                cx={point.x}
                cy={point.y}
                r={isHovered ? hoveredVertexRadius : vertexRadius}
                fill={isHovered ? 'yellow' : vertexFillColor}
                stroke="black"
                strokeWidth={1 / transform.zoom}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: isShiftPressed ? 'pointer' : 'default' }}
                onClick={(e) => {
                  if (isShiftPressed) {
                    e.stopPropagation();
                    console.log(
                      `[CanvasVertexLayer] Vertex clicked in Edit mode with Shift: polygon=${selectedPolygonId}, vertex=${index}`,
                    );

                    try {
                      setEditMode(EditMode.AddPoints);
                      setInteractionState({
                        ...interactionState,
                        isAddingPoints: true,
                        addPointStartVertex: {
                          polygonId: selectedPolygonId,
                          vertexIndex: index,
                        },
                      });
                      setTempPoints([]);
                      console.log(`[CanvasVertexLayer] Successfully started add points mode from vertex ${index}`);
                    } catch (error) {
                      console.error(`[CanvasVertexLayer] Error starting add points mode:`, error);
                    }
                  }
                }}
              />
            );
          });
        })()}

      {editMode === EditMode.AddPoints && segmentationData?.polygons && (
        <>
          {segmentationData.polygons.map((polygon) =>
            polygon.points.map((point, index) => {
              const isSelected = polygon.id === selectedPolygonId;
              const isStartVertex =
                isSelected &&
                interactionState?.addPointStartVertex?.polygonId === selectedPolygonId &&
                interactionState?.addPointStartVertex?.vertexIndex === index;
              const isHovered = hoveredVertex?.polygonId === polygon.id && hoveredVertex?.vertexIndex === index;

              const vertexFillColor = polygon.type === 'internal' ? 'blue' : 'red';

              let fillColor: string;
              if (isStartVertex) {
                fillColor = 'lime';
              } else if (isHovered) {
                fillColor = 'yellow';
              } else if (isSelected) {
                fillColor = vertexFillColor;
              } else {
                fillColor = '#aaa';
              }

              return (
                <circle
                  key={`${polygon.id}-vertex-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? hoveredVertexRadius : isStartVertex ? vertexRadius * 1.8 : vertexRadius}
                  fill={fillColor}
                  stroke="black"
                  strokeWidth={1 / transform.zoom}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() =>
                    setHoveredVertex({
                      polygonId: polygon.id,
                      vertexIndex: index,
                    })
                  }
                  onMouseLeave={() => setHoveredVertex(null)}
                  onClick={(e) => {
                    e.stopPropagation();

                    console.log(
                      `[CanvasVertexLayer] Vertex clicked in AddPoints mode: polygon=${polygon.id}, vertex=${index}`,
                    );

                    try {
                      if (!interactionState.isAddingPoints) {
                        setSelectedPolygonId(polygon.id);
                        setInteractionState({
                          ...interactionState,
                          isAddingPoints: true,
                          addPointStartVertex: {
                            polygonId: polygon.id,
                            vertexIndex: index,
                          },
                        });
                        setTempPoints([]);
                        console.log(`[CanvasVertexLayer] Starting to add points from vertex ${index}`);
                      } else if (interactionState.addPointStartVertex) {
                        if (
                          interactionState.addPointStartVertex.vertexIndex !== index ||
                          interactionState.addPointStartVertex.polygonId !== polygon.id
                        ) {
                          console.log(`[CanvasVertexLayer] Completing add points sequence at vertex ${index}`);

                          const syntheticEvent = {
                            ...e,
                            clientX: e.clientX,
                            clientY: e.clientY,
                            currentTarget: e.currentTarget,
                            target: e.target,
                            button: 0,
                          } as unknown as React.MouseEvent<HTMLDivElement>;

                          onMouseDown(syntheticEvent);
                        }
                      }
                    } catch (error) {
                      console.error(`[CanvasVertexLayer] Error handling vertex click in AddPoints mode:`, error);
                    }
                  }}
                />
              );
            }),
          )}
        </>
      )}
    </>
  );
};

CanvasVertexLayer.displayName = 'CanvasVertexLayer';

export default CanvasVertexLayer;
