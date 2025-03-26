
import { useCallback } from 'react';

interface EditModeClickHandlersProps {
  slicingMode: {
    slicingMode: boolean;
    handleSlicingClick: (x: number, y: number) => boolean;
  };
  pointAddingMode: {
    pointAddingMode: boolean;
    handlePointAddingClick: (x: number, y: number) => boolean;
  };
  editModeCore: {
    editMode: boolean;
    handleEditModeClick: (x: number, y: number) => boolean;
  };
  resetLastAutoAddedPoint: () => void;
}

/**
 * Hook pro správu kliknutí v různých editačních režimech
 */
export const useEditModeClickHandlers = ({
  slicingMode,
  pointAddingMode,
  editModeCore,
  resetLastAutoAddedPoint
}: EditModeClickHandlersProps) => {
  // Kombinované handlery pro kliknutí v různých režimech editace
  const handleEditModeClick = useCallback((x: number, y: number) => {
    if (slicingMode.slicingMode) {
      return slicingMode.handleSlicingClick(x, y);
    } else if (pointAddingMode.pointAddingMode) {
      return pointAddingMode.handlePointAddingClick(x, y);
    } else if (editModeCore.editMode) {
      // Reset lastAutoAddedPoint při kliknutí (protože uživatel začíná nový segment)
      resetLastAutoAddedPoint();
      return editModeCore.handleEditModeClick(x, y);
    }
    return false;
  }, [slicingMode, pointAddingMode, editModeCore, resetLastAutoAddedPoint]);
  
  // Kombinované handlery pro pohyb myši v různých režimech editace
  const handleEditMouseMove = useCallback((x: number, y: number) => {
    if (slicingMode.slicingMode) {
      slicingMode.updateCursorPosition?.(x, y);
    } else if (pointAddingMode.pointAddingMode) {
      pointAddingMode.detectVertexUnderCursor?.(x, y);
    }
    // Standardní editMode nepotřebuje speciální handler pro pohyb myši
  }, [slicingMode, pointAddingMode]);

  return {
    handleEditModeClick,
    handleEditMouseMove
  };
};
