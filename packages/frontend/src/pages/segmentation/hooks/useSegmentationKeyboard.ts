import { useEffect, useState } from 'react';
import { EditMode } from './segmentation';

interface UseSegmentationKeyboardProps {
  editMode: EditMode;
  setEditMode: (mode: EditMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onDelete: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export const useSegmentationKeyboard = ({
  editMode,
  setEditMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onDelete,
  onZoomIn,
  onZoomOut,
  onResetView,
}: UseSegmentationKeyboardProps) => {
  // Track shift key state for potential use in other components
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Track shift key state
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }

      // Command/Control + key shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            if (e.shiftKey && canRedo) {
              e.preventDefault();
              onRedo();
            } else if (canUndo) {
              e.preventDefault();
              onUndo();
            }
            break;
          case 'y':
            if (canRedo) {
              e.preventDefault();
              onRedo();
            }
            break;
          case 's':
            e.preventDefault();
            onSave();
            break;
        }
        return;
      }

      // Single key shortcuts
      switch (e.key.toLowerCase()) {
        case 'v':
          setEditMode(EditMode.View);
          break;
        case 'e':
          setEditMode(EditMode.EditVertices);
          break;
        case 'a':
          setEditMode(EditMode.AddPoints);
          break;
        case 'c':
          setEditMode(EditMode.CreatePolygon);
          break;
        case 's':
          setEditMode(EditMode.Slice);
          break;
        case 'd':
          setEditMode(EditMode.DeletePolygon);
          break;
        case 'delete':
        case 'backspace':
          if (editMode === EditMode.EditVertices) {
            onDelete();
          }
          break;
        case 'escape':
          // Reset to view mode
          setEditMode(EditMode.View);
          break;
        case '+':
        case '=': // + is often Shift+=, but we'll handle both
          onZoomIn();
          break;
        case '-':
          onZoomOut();
          break;
        case 'r':
          onResetView();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editMode, setEditMode, canUndo, canRedo, onUndo, onRedo, onSave, onDelete, onZoomIn, onZoomOut, onResetView]);

  return { isShiftPressed };
};
