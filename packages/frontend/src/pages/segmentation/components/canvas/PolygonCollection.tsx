import React, { useMemo } from 'react';
import { SegmentationResult, Polygon, Point } from '@/lib/segmentation';
import CanvasPolygon from './CanvasPolygon';
import { VertexDragState } from '@/pages/segmentation/types';
import { EditMode } from '@/pages/segmentation/hooks/useSegmentationEditor';
import {
  sortPolygons,
  simplifyPolygons,
  AABB,
  separatePolygonsByType,
  createPolygonProps
} from '../../../../../shared/utils/CanvasPolygonUtils';

interface PolygonCollectionProps {
  polygons: Polygon[];
  selectedPolygonId: string | null;
  hoveredVertex: { polygonId: string | null, vertexIndex: number | null };
  vertexDragState: VertexDragState;
  editMode: EditMode;
  onSelectPolygon?: (id: string) => void;
  onDeletePolygon?: (id: string) => void;
  onSlicePolygon?: (id: string) => void;
  onEditPolygon?: (id: string) => void;
  onDeleteVertex?: (polygonId: string, vertexIndex: number) => void;
  onDuplicateVertex?: (polygonId: string, vertexIndex: number) => void;
}

// Use Omit to reflect removed props in the type signature
const PolygonCollection = ({
  polygons,
  selectedPolygonId,
  hoveredVertex,
  vertexDragState,
  editMode,
  onSelectPolygon,
  onDeletePolygon,
  onSlicePolygon,
  onEditPolygon,
  onDeleteVertex,
  onDuplicateVertex
}: Omit<PolygonCollectionProps, 'zoom' | 'offset' | 'canvasWidth' | 'canvasHeight'>) => {
  // --- Move Hook calls before early return ---
  const isHoveredPolygonId = hoveredVertex.polygonId;

  const visiblePolygons = useMemo(() => {
    if (!polygons) return [];

    // Use shared utilities for sorting and simplifying polygons
    const sortedPolygons = sortPolygons(polygons, selectedPolygonId);
    return simplifyPolygons(sortedPolygons, selectedPolygonId, 0.5);

  }, [polygons, selectedPolygonId]);

  // Use shared utility for separating polygons by type
  const { externalPolygons, internalPolygons } = useMemo(() =>
    separatePolygonsByType(visiblePolygons)
  , [visiblePolygons]);
  // --- End moving Hook calls ---

  // Now perform the early return check
  if (!polygons) {
    return <g></g>;
  }

  // Create common handlers object to reduce duplication
  const handlers = {
    onSelectPolygon,
    onDeletePolygon,
    onSlicePolygon,
    onEditPolygon,
    onDeleteVertex,
    onDuplicateVertex
  };

  return (
    <g>
      {/* Render external polygons first */}
      {externalPolygons.map(polygon => (
        <CanvasPolygon
          key={polygon.id}
          {...createPolygonProps(
            polygon,
            selectedPolygonId,
            hoveredVertex,
            vertexDragState,
            editMode,
            handlers,
            visiblePolygons
          )}
        />
      ))}

      {/* Render internal polygons (holes) */}
      {internalPolygons.map(polygon => (
        <CanvasPolygon
          key={polygon.id}
          {...createPolygonProps(
            polygon,
            selectedPolygonId,
            hoveredVertex,
            vertexDragState,
            editMode,
            handlers,
            visiblePolygons
          )}
        />
      ))}
    </g>
  );
};

export default PolygonCollection;
