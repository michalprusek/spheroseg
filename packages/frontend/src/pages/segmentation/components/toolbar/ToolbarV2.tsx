import React from 'react';
import { EditMode } from '../../hooks/segmentation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ZoomIn,
  ZoomOut,
  Expand,
  Eye,
  Edit,
  PlusSquare,
  Share2,
  Trash2,
  Undo2,
  Redo2,
  Save,
  MousePointer,
  Scissors,
  RefreshCw,
} from 'lucide-react';

interface ToolbarV2Props {
  editMode: EditMode;
  setEditMode: (mode: EditMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onResegment?: () => void; // Optional callback for resegmentation
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  isResegmenting?: boolean; // Optional flag for resegmentation in progress
}

const iconSize = 18; // Consistent icon size

export const ToolbarV2: React.FC<ToolbarV2Props> = ({
  editMode,
  setEditMode,
  onZoomIn,
  onZoomOut,
  onResetView,
  onSave,
  onUndo,
  onRedo,
  onResegment,
  canUndo,
  canRedo,
  isSaving,
  isResegmenting = false,
}) => {
  const { t } = useLanguage();
  const baseClasses = 'p-2 rounded flex items-center justify-center w-full transition-all duration-200';
  const activeClasses = 'bg-primary/20 text-primary border-l-4 border-primary shadow-md';
  const hoverClasses = 'hover:bg-accent hover:text-accent-foreground';
  const disabledClasses = 'opacity-50 cursor-not-allowed';

  // Get color for each mode to match the instruction text colors
  const getModeColor = (mode: EditMode): string => {
    switch (mode) {
      case EditMode.Slice:
        return 'text-yellow-400 hover:text-yellow-500';
      case EditMode.CreatePolygon:
        return 'text-green-400 hover:text-green-500';
      case EditMode.AddPoints:
        return 'text-blue-400 hover:text-blue-500';
      case EditMode.EditVertices:
        return 'text-orange-400 hover:text-orange-500';
      case EditMode.DeletePolygon:
        return 'text-red-400 hover:text-red-500';
      default:
        return '';
    }
  };

  const getButtonClasses = (mode: EditMode | null, currentMode: EditMode) => {
    const isActive = mode === currentMode;
    const modeColor = isActive ? getModeColor(currentMode) : '';
    return `${baseClasses} ${isActive ? activeClasses : hoverClasses} ${modeColor}`;
  };

  return (
    <div
      className="flex flex-col items-center space-y-1 p-2 bg-background border-r border-border h-full overflow-y-auto"
      style={{ minWidth: '50px' }}
    >
      {/* View Controls */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomIn}
        className={`${baseClasses} ${hoverClasses}`}
        title={t('tools.zoomIn') || 'Zoom In (Ctrl +)'}
      >
        <ZoomIn size={iconSize} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomOut}
        className={`${baseClasses} ${hoverClasses}`}
        title={t('tools.zoomOut') || 'Zoom Out (Ctrl -)'}
      >
        <ZoomOut size={iconSize} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onResetView}
        className={`${baseClasses} ${hoverClasses}`}
        title={t('tools.resetView') || 'Reset View (Ctrl 0)'}
      >
        <Expand size={iconSize} />
      </Button>

      <div className="w-full h-px bg-border my-2" />

      {/* Edit Modes */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setEditMode(EditMode.View)}
        className={getButtonClasses(EditMode.View, editMode)}
        title={t('segmentation.modes.view') || 'View Mode (V)'}
      >
        <MousePointer size={iconSize} />
      </Button>
      {/* Edit Vertices button removed as requested - now activated automatically when clicking on a polygon */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setEditMode(EditMode.AddPoints)}
        className={getButtonClasses(EditMode.AddPoints, editMode)}
        title={t('segmentation.modes.addPoints') || 'Add Points (A)'}
      >
        <Share2 size={iconSize} /> {/* Representing adding points to existing polygon? Maybe a different icon? */}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setEditMode(EditMode.CreatePolygon)}
        className={getButtonClasses(EditMode.CreatePolygon, editMode)}
        title={t('segmentation.modes.createPolygon') || 'Create Polygon (N)'}
      >
        <PlusSquare size={iconSize} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setEditMode(EditMode.Slice)}
        className={getButtonClasses(EditMode.Slice, editMode)}
        title={t('segmentation.modes.slice') || 'Slice Polygon (S)'}
      >
        <Scissors size={iconSize} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setEditMode(EditMode.DeletePolygon)}
        className={getButtonClasses(EditMode.DeletePolygon, editMode)}
        title={t('segmentation.modes.deletePolygon') || 'Delete Polygon (D)'}
      >
        <Trash2 size={iconSize} />
      </Button>

      <div className="w-full h-px bg-border my-2" />

      {/* Actions */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onUndo}
        disabled={!canUndo}
        className={`${baseClasses} ${canUndo ? hoverClasses : disabledClasses}`}
        title={t('shortcuts.undo') || 'Undo (Ctrl Z)'}
      >
        <Undo2 size={iconSize} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRedo}
        disabled={!canRedo}
        className={`${baseClasses} ${canRedo ? hoverClasses : disabledClasses}`}
        title={t('shortcuts.redo') || 'Redo (Ctrl Shift Z)'}
      >
        <Redo2 size={iconSize} />
      </Button>

      {/* Save button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSave}
        disabled={isSaving}
        className={`${baseClasses} ${isSaving ? disabledClasses : hoverClasses}`}
        title={t('shortcuts.save') || 'Save (Ctrl S)'}
      >
        <Save size={iconSize} />
      </Button>

      {/* Resegment button - always show it */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onResegment || (() => console.warn('Resegment callback not provided'))}
        disabled={isResegmenting || !onResegment}
        className={`${baseClasses} ${isResegmenting ? disabledClasses : onResegment ? hoverClasses : disabledClasses}`}
        title={t('segmentation.resegmentButtonTooltip') || 'Resegment with Neural Network'}
      >
        <RefreshCw size={iconSize} className={isResegmenting ? 'animate-spin' : ''} />
      </Button>
    </div>
  );
};
