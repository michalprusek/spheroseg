import { usePolygonDetection } from './polygonInteraction/usePolygonDetection';
import { usePolygonState } from './polygonInteraction/usePolygonState';
import { useEditModeManager } from '@shared/utils/editModeManager';
import { usePolygonActions } from './polygonInteraction/usePolygonActions';
import { usePolygonEventHandlers } from '@shared/utils/polygonEventHandlers';
import { useVertexDrag } from './polygonInteraction/useVertexDrag';
import { useVertexDetection } from './polygonInteraction/useVertexDetection';
import { SegmentationResult } from '@/lib/segmentation';
import { useCallback } from 'react';

interface ImageSizeType {
  width: number;
  height: number;
}

/**
 * Hook pro práci s polygony v segmentačním editoru
 */
export const usePolygonInteraction = (
  segmentation: SegmentationResult | null,
  setSegmentation: (seg: SegmentationResult | null) => void,
  zoom: number,
  offset: { x: number; y: number },
  setOffset: (offset: { x: number; y: number }) => void,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  canvasWidth: number,
  canvasHeight: number,
  imageSize: ImageSizeType,
) => {
  // Stav polygonu
  const { selectedPolygonId, setSelectedPolygonId, hoveredVertex, setHoveredVertex, dragState, vertexDragState } =
    usePolygonState();

  // Metody pro detekci bodů v polygonu
  const { isPointInPolygon } = usePolygonDetection();

  // Režimy editace polygonu
  const tempPointsState = { points: [], setPoints: () => {} }; // Simplified for demonstration
  const slicingModeState = { sourcePolygonId: null }; // Simplified for demonstration
  const pathModificationUtils = { modifyPolygonPath: () => false }; // Simplified for demonstration

  const params = {
    segmentation,
    setSegmentation,
    selectedPolygonId,
    zoom,
    offset,
  };

  const editModes = useEditModeManager(
    params,
    tempPointsState,
    slicingModeState,
    pathModificationUtils,
    console.error,
    () => 'unique-id',
  );

  // Akce nad polygony
  const polygonActions = usePolygonActions(
    segmentation,
    setSegmentation,
    selectedPolygonId,
    setSelectedPolygonId,
    editModes.togglePointAddingMode,
    editModes.toggleSlicingMode,
  );

  // Hooks for vertex interactions
  const { detectVertex } = useVertexDetection(zoom, offset);
  const { handleVertexDrag, handleVertexClick } = useVertexDrag(
    zoom,
    offset,
    segmentation,
    setSegmentation,
    setSelectedPolygonId,
    vertexDragState,
  );

  // Polygon selection
  const handlePolygonSelect = useCallback(
    (id: string | null) => {
      setSelectedPolygonId(id);
      return true;
    },
    [setSelectedPolygonId],
  );

  // Event handlers for polygon interactions
  const { handleMouseDown, handleMouseMove, handleMouseUp } = usePolygonEventHandlers(
    zoom,
    offset,
    setOffset,
    segmentation,
    setSegmentation,
    selectedPolygonId,
    setSelectedPolygonId,
    hoveredVertex,
    setHoveredVertex,
    dragState,
    vertexDragState,
    editModes.isAnyEditModeActive,
    editModes.handleEditModeClick,
    editModes.handleEditMouseMove,
    canvasRef,
    canvasWidth,
    canvasHeight,
    imageSize,
    handleVertexDrag,
    handleVertexClick,
    handlePolygonSelect,
    detectVertex,
  );

  return {
    // State
    selectedPolygonId,
    hoveredVertex,
    dragState,
    vertexDragState,

    // Edit modes
    ...editModes,

    // Event handlers
    setSelectedPolygonId,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,

    // Polygon actions
    ...polygonActions,

    // Detection utilities
    isPointInPolygon,

    // Explicitly expose source polygon ID for point adding mode
    sourcePolygonId: editModes.sourcePolygonId,
  };
};
