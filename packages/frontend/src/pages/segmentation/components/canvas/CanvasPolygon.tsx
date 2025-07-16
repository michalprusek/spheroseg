import React, { useMemo } from 'react';
import { Polygon } from '@/lib/segmentation';
import CanvasVertex from './CanvasVertex';
import PolygonContextMenu from '../context-menu/PolygonContextMenu';
import { VertexDragState } from '@/pages/segmentation/types';
import { EditMode } from '@/pages/segmentation/hooks/segmentation/types';
import {
  createSvgPath,
  getPolygonFillColor,
  getPolygonStrokeWidth,
  findRelatedHoles,
} from '../../../../../shared/utils/CanvasPolygonUtils';

// Constants remain the same for now, but remove zoom-dependent ones if unused
// const VERTEX_RENDER_ZOOM_THRESHOLD = 1.5; // This logic needs revisiting
const RDP_BASE_TOLERANCE = 1.5;
const RDP_MIN_TOLERANCE = 0.05;
const MIN_SIMPLIFIED_POINTS = 3;
const VERTEX_RADIUS = 4; // Consider making this constant or state-dependent (selected/hovered)
const LINE_STROKE_WIDTH = 2; // Base stroke width

interface CanvasPolygonProps {
  polygon: Polygon;
  isSelected: boolean;
  isHovered: boolean;
  hoveredVertex: { polygonId: string | null; vertexIndex: number | null };
  vertexDragState: VertexDragState;
  // zoom: number; // Removed
  // offset: { x: number; y: number }; // Removed
  editMode: EditMode;
  onSelectPolygon?: (id: string) => void;
  onDeletePolygon?: (id: string) => void;
  onSlicePolygon?: (id: string) => void;
  onEditPolygon?: (id: string) => void;
  onDeleteVertex?: (polygonId: string, vertexIndex: number) => void;
  onDuplicateVertex?: (polygonId: string, vertexIndex: number) => void;
  relatedPolygons?: Polygon[];
}

/**
 * Renders a polygon and its vertices using image coordinates.
 * Assumes the parent SVG handles zoom/offset transformations.
 */
// Use Omit to reflect removed props in the type signature
const CanvasPolygon = ({
  polygon,
  isSelected,
  isHovered,
  hoveredVertex,
  vertexDragState,
  // zoom, // Removed
  // offset, // Removed
  editMode,
  onSelectPolygon,
  onDeletePolygon,
  onSlicePolygon,
  onEditPolygon,
  onDeleteVertex,
  onDuplicateVertex,
  relatedPolygons = [],
}: Omit<CanvasPolygonProps, 'zoom' | 'offset'>) => {
  const { id, points, type = 'external', parentId, color: polygonColor } = polygon;

  // No coordinate transformation needed here
  // const { getScreenCoordinates } = useCoordinateTransform(zoom, offset);

  // Use raw points (image coordinates)
  const pointsToRender = points || [];

  // Find holes using shared utility
  const holes = useMemo(() => {
    return findRelatedHoles({ id, type }, relatedPolygons);
  }, [id, type, relatedPolygons]);

  // Remove memoized screen points
  /*
  const screenPoints = useMemo(() => {
    // ... old logic ...
  }, [pointsToRender, zoom, offset, getScreenCoordinates]);
  const holesScreenPoints = useMemo(() => {
    // ... old logic ...
  }, [holes, zoom, offset, getScreenCoordinates]);
  */

  // Convert IMAGE points array to SVG points string format "x1,y1 x2,y2 ..."
  const pointsString = useMemo(() => {
    if (!pointsToRender || pointsToRender.length === 0) return '';
    return pointsToRender.map((p) => `${p.x},${p.y}`).join(' ');
  }, [pointsToRender]);

  // Create SVG path for polygon with holes using IMAGE coordinates
  const svgPath = useMemo(() => {
    if (type === 'internal') return '';
    const mainPathPoints = pointsToRender; // Use raw image points
    const holePathsPoints = holes.map((h) => h.points); // Use raw image points

    return createSvgPath(mainPathPoints, holePathsPoints);
  }, [pointsToRender, holes, type]);

  // Use utility for stroke width
  const strokeWidth = getPolygonStrokeWidth(isSelected, LINE_STROKE_WIDTH);

  const color = useMemo(() => {
    return polygonColor || (type === 'internal' ? 'blue' : 'red');
  }, [polygonColor, type]);

  // Use utility for fill color
  const fillColor = useMemo(() => {
    return getPolygonFillColor(type, color, isSelected, isHovered);
  }, [color, isSelected, isHovered, type]);

  // --- Event Handlers ---
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectPolygon) {
      onSelectPolygon(id);
    }
  };

  // Revisit vertex rendering condition - remove zoom dependency for now
  // Consider rendering vertices always when selected in EditVertices mode, regardless of zoom.
  const shouldRenderVertices = isSelected && editMode === EditMode.EditVertices;

  if (pointsToRender.length < 2) {
    return null;
  }

  // Rendering logic remains similar, but uses image coordinates for vertices
  return (
    <PolygonContextMenu
      polygonId={id}
      onDelete={() => onDeletePolygon?.(id)}
      onSlice={() => onSlicePolygon?.(id)}
      onEdit={() => onEditPolygon?.(id)}
    >
      <g style={{ cursor: 'pointer' }}>
        {/* Render path or polygon */}
        {type === 'external' && holes.length > 0 ? (
          <path
            d={svgPath} // Uses image coordinates
            fill={fillColor}
            stroke={color}
            strokeWidth={strokeWidth} // Now fixed or state-based
            vectorEffect="non-scaling-stroke" // This should handle stroke scaling
            shapeRendering="geometricPrecision"
            onClick={handleClick}
          />
        ) : (
          <polygon
            points={pointsString} // Uses image coordinates
            fill={fillColor}
            stroke={color}
            strokeWidth={strokeWidth} // Now fixed or state-based
            vectorEffect="non-scaling-stroke" // This should handle stroke scaling
            shapeRendering="geometricPrecision"
            onClick={handleClick}
            style={{ pointerEvents: 'visiblePainted' }}
          />
        )}

        {/* Render Vertices using IMAGE coordinates */}
        {shouldRenderVertices &&
          pointsToRender.map((point, index) => (
            <CanvasVertex
              key={`${id}-vertex-${index}`}
              polygonId={id}
              vertexIndex={index}
              point={point} // Pass original point for data access if needed later
              // Pass image coordinates directly
              x={point.x}
              y={point.y}
              // Remove zoom prop
              isSelected={isSelected}
              isHovered={hoveredVertex.polygonId === id && hoveredVertex.vertexIndex === index}
              isDragging={vertexDragState.polygonId === id && vertexDragState.vertexIndex === index}
              fillColor={color}
              type={type}
              isStartPoint={index === 0}
              onDeleteVertex={onDeleteVertex}
              onDuplicateVertex={onDuplicateVertex}
            />
          ))}
      </g>
    </PolygonContextMenu>
  );
};

export default React.memo(CanvasPolygon);
