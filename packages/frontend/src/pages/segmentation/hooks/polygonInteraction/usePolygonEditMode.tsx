
import { SegmentationResult } from '@/lib/segmentation';
import { useSlicingMode } from './editMode/useSlicingMode';
import { usePointAddingMode } from './editMode/usePointAddingMode';
import { useEditModeSwitcher } from './editMode/useEditModeSwitcher';
import { useAutoPointAdding } from './editMode/useAutoPointAdding';
import { useEditModeClickHandlers } from './editMode/useEditModeClickHandlers';
import { useEditModeManager, createEditModeParams } from '../../../../../shared/utils/editModeManager';

/**
 * Hook for managing polygon edit modes (adding/modifying vertices, slicing)
 */
export const usePolygonEditMode = (
  segmentation: SegmentationResult | null,
  setSegmentation: (seg: SegmentationResult | null) => void,
  selectedPolygonId: string | null,
  zoom: number = 1,
  offset: { x: number; y: number } = { x: 0, y: 0 }
) => {
  // Use the shared edit mode manager
  const params = createEditModeParams({
    segmentation,
    setSegmentation,
    selectedPolygonId,
    zoom,
    offset
  });
  
  // Simplified dependencies for demonstration
  const tempPointsState = { points: [], setPoints: () => {} };
  const slicingModeState = { sourcePolygonId: null };
  const pathModificationUtils = { modifyPolygonPath: () => false };
  
  const editModeCore = useEditModeManager(
    params,
    tempPointsState,
    slicingModeState,
    pathModificationUtils,
    console.error,
    () => 'unique-id'
  );
  
  // Polygon slicing mode
  const slicingMode = useSlicingMode(
    segmentation,
    setSegmentation,
    selectedPolygonId
  );
  
  // Adding points to existing polygon mode
  const pointAddingMode = usePointAddingMode(
    segmentation,
    setSegmentation, 
    selectedPolygonId
  );

  // Use the edit mode switcher to handle mode toggling
  const {
    toggleEditMode,
    toggleSlicingMode,
    togglePointAddingMode,
    exitAllEditModes
  } = useEditModeSwitcher({
    editModeCore,
    slicingMode,
    pointAddingMode
  });

  // Use auto point adding when shift is pressed
  const { resetLastAutoAddedPoint } = useAutoPointAdding({
    editMode: editModeCore.editMode,
    cursorPosition: editModeCore.cursorPosition,
    isShiftPressed: editModeCore.isShiftPressed,
    tempPoints: editModeCore.tempPoints,
    addPointToTemp: editModeCore.addPointToTemp
  });

  // Use combined click and move handlers
  const { handleEditModeClick, handleEditMouseMove } = useEditModeClickHandlers({
    slicingMode,
    pointAddingMode,
    editModeCore,
    resetLastAutoAddedPoint
  });

  return {
    // Základní editační režim
    editMode: editModeCore.editMode,
    tempPoints: editModeCore.tempPoints,
    cursorPosition: editModeCore.cursorPosition || slicingMode.cursorPosition,
    isShiftPressed: editModeCore.isShiftPressed,
    toggleEditMode,
    
    // Slicing režim
    slicingMode: slicingMode.slicingMode,
    sliceStartPoint: slicingMode.sliceStartPoint,
    toggleSlicingMode,
    
    // Režim přidávání bodů
    pointAddingMode: pointAddingMode.pointAddingMode,
    hoveredSegment: pointAddingMode.hoveredSegment,
    pointAddingTempPoints: pointAddingMode.tempPoints,
    selectedVertexIndex: pointAddingMode.selectedVertexIndex,
    sourcePolygonId: pointAddingMode.sourcePolygonId,
    togglePointAddingMode,
    
    // Selected polygon data for visualization
    selectedPolygonPoints: pointAddingMode.selectedPolygonPoints,
    
    // Funkce pro ukončení všech editačních režimů
    exitAllEditModes,
    
    // Kombinované handlery
    handleEditModeClick,
    handleEditMouseMove
  };
};
