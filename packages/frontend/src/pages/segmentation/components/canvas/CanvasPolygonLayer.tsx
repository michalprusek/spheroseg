import React from 'react';
import { SegmentationResult, Point } from '@/lib/segmentation';
import CanvasSvgFilters from './CanvasSvgFilters';
import CanvasPolygon from './CanvasPolygon';
import TemporaryEditPath from './TemporaryEditPath';
import SlicingModeVisualizer from './SlicingModeVisualizer';
import PointAddingVisualizer from './PointAddingVisualizer';
import EditModeBorder from './EditModeBorder';
import { PolygonLayerProps, TempPointsState } from '@/pages/segmentation/types';
import PolygonCollection from './PolygonCollection';
import EditorModeVisualizations from './EditorModeVisualizations';
import { EditMode } from '@/pages/segmentation/hooks/useSegmentationEditor';

/**
 * Layer component responsible for rendering polygons and edit mode visualizations within the main SVG.
 * It receives segmentation data and interaction state, but does NOT handle zoom/offset transformations directly.
 */
const CanvasPolygonLayer = ({
  segmentation,
  imageSize,
  selectedPolygonId,
  hoveredVertex,
  vertexDragState,
  editMode,
  slicingMode,
  pointAddingMode,
  tempPoints,
  cursorPosition,
  sliceStartPoint,
  hoveredSegment,
  isShiftPressed,
  onSelectPolygon,
  onDeletePolygon,
  onSlicePolygon,
  onEditPolygon,
  onDeleteVertex,
  onDuplicateVertex,
  pointAddingTempPoints,
  selectedVertexIndex,
  selectedPolygonPoints,
  sourcePolygonId,
}: Omit<PolygonLayerProps, 'hoveredPolygonId' | 'zoom' | 'offset' | 'canvasWidth' | 'canvasHeight'>) => {
  // Always render with reasonable dimensions, even if imageSize is not provided
  const effectiveImageSize = {
    width: imageSize.width > 0 ? imageSize.width : 800,
    height: imageSize.height > 0 ? imageSize.height : 600,
  };

  // Ensure we have polygons to render, even if empty
  const polygonsToRender = segmentation?.polygons || [];

  return (
    <g className="polygon-layer">
      {/* Filters might need to be defined once in the main SVG */}
      {/* <CanvasSvgFilters /> */}
      {/* We assume filters are defined in the parent SVG now */}

      {/* Vykreslení všech polygonů */}
      <PolygonCollection
        polygons={polygonsToRender}
        selectedPolygonId={selectedPolygonId}
        hoveredVertex={hoveredVertex}
        vertexDragState={vertexDragState}
        editMode={editMode}
        onSelectPolygon={onSelectPolygon}
        onDeletePolygon={onDeletePolygon}
        onSlicePolygon={onSlicePolygon}
        onEditPolygon={onEditPolygon}
        onDeleteVertex={onDeleteVertex}
        onDuplicateVertex={onDuplicateVertex}
      />

      {/* Vizualizace režimů editace */}
      <EditorModeVisualizations
        editMode={editMode === EditMode.CreatePolygon}
        slicingMode={slicingMode}
        pointAddingMode={pointAddingMode.isActive}
        tempPoints={tempPoints}
        cursorPosition={cursorPosition}
        sliceStartPoint={sliceStartPoint}
        hoveredSegment={hoveredSegment}
        isShiftPressed={isShiftPressed}
        pointAddingTempPoints={pointAddingTempPoints}
        selectedVertexIndex={selectedVertexIndex}
        sourcePolygonId={sourcePolygonId}
        selectedPolygonPoints={selectedPolygonPoints}
      />

      {/* Indikátor okraje editačního režimu - Needs imageSize, might need rework if layer doesn't own SVG */}
      {/* This component might need to be moved up or receive coordinates differently */}
      {/* <EditModeBorder
        editMode={editMode}
        slicingMode={slicingMode}
        pointAddingMode={pointAddingMode.isActive}
        imageSize={effectiveImageSize} // Pass image size
        zoom={zoom}
      /> */}
      {/* Temporarily commented out EditModeBorder as its positioning relies on the layer's SVG bounds */}
    </g>
  );
};

export default CanvasPolygonLayer;
