/**
 * This is a compatibility layer for the old SegmentationEditor component.
 * It redirects to the new SegmentationEditorV2 component.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Define the EditMode enum to match the old interface
export enum EditMode {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
  CREATE_POLYGON = 'CREATE_POLYGON',
  SLICE = 'SLICE',
  ADD_POINTS = 'ADD_POINTS',
}

/**
 * This hook is a compatibility layer that redirects to the new SegmentationEditorV2 component.
 * It's used by the old SegmentationEditor component.
 */
export const useSegmentationEditor = (
  projectId?: string | null,
  imageId?: string | null,
  userId?: string | null,
  svgRef?: React.RefObject<SVGSVGElement>
) => {
  const navigate = useNavigate();

  // Redirect to the new editor
  useEffect(() => {
    if (projectId && imageId) {
      console.log(`[useSegmentationEditor] Redirecting to new editor: /projects/${projectId}/segmentation/${imageId}`);
      navigate(`/projects/${projectId}/segmentation/${imageId}`, { replace: true });
    } else {
      console.error('[useSegmentationEditor] Missing projectId or imageId for redirect');
    }
  }, [projectId, imageId, navigate]);

  // Return a mock object that matches the expected interface
  // This is just to prevent errors while the redirect happens
  return {
    segmentation: null,
    loading: true,
    saving: false,
    zoom: 1,
    offset: { x: 0, y: 0 },
    selectedPolygonId: null,
    setSelectedPolygonId: () => {},
    hoveredPolygonId: null,
    setHoveredPolygonId: () => {},
    hoveredVertex: { polygonId: null, vertexIndex: null },
    setHoveredVertex: () => {},
    hoveredSegment: null,
    vertexDragState: { current: null },
    editMode: EditMode.VIEW,
    slicingMode: false,
    pointAddingMode: { isActive: false, sourcePolygonId: null, pointIndex: null },
    tempPoints: { points: [] },
    cursorPosition: null,
    sliceStartPoint: null,
    isShiftPressed: false,
    canUndo: false,
    canRedo: false,
    historyIndex: 0,
    historyLength: 0,
    currentImage: null,
    imageSrc: '',
    segmentationResultPath: null,
    canvasContainerRef: { current: null },
    projectImages: [],
    projectTitle: '',
    imageName: '',
    newPolygonPoints: [],
    pointAddingTempPoints: [],
    selectedVertexIndex: null,
    selectedPolygonPoints: null,
    sourcePolygonId: null,
    autoSaveEnabled: false,
    autoSaveStatus: 'idle',
    hasUnsavedChanges: false,
    handleSave: async () => {},
    saveNow: async () => {},
    toggleAutoSave: () => {},
    handleZoomIn: () => {},
    handleZoomOut: () => {},
    handleResetView: () => {},
    handleMouseDown: () => {},
    handleMouseMove: () => {},
    handleMouseUp: () => {},
    handleMouseLeave: () => {},
    handleEditPolygon: () => {},
    handleSlicePolygon: () => {},
    handleDeletePolygon: () => {},
    handleAddPointsToPolygon: () => {},
    handleDeleteVertex: () => {},
    handleDuplicateVertex: () => {},
    undo: () => {},
    redo: () => {},
    navigateToImage: () => {},
    handleResegmentCurrentImage: async () => {},
    toggleEditMode: () => {},
    toggleCreatePolygonMode: () => {},
    toggleSlicingMode: () => {},
    togglePointAddingMode: () => {},
    exitAllEditModes: () => {},
    finalizeNewPolygon: () => {},
    cancelCreation: () => {},
    handleSetPolygonType: () => {},
    dragState: { current: null },
  };
};
