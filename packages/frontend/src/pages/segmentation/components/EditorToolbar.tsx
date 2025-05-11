import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Pencil, Undo2, Redo2, Scissors, PlusCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import EditorToolbarButton from './EditorToolbarButton';

interface EditorToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onSave: () => Promise<void>;
  editMode: boolean;
  slicingMode: boolean;
  pointAddingMode: boolean;
  onToggleEditMode: () => void;
  onToggleSlicingMode: () => void;
  onTogglePointAddingMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const EditorToolbar = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onSave,
  editMode,
  slicingMode,
  pointAddingMode,
  onToggleEditMode,
  onToggleSlicingMode,
  onTogglePointAddingMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: EditorToolbarProps) => {
  const { t } = useLanguage();

  return (
    <motion.div
      className="absolute top-4 left-4 z-10 bg-background/95 border rounded-lg shadow-xl flex flex-col space-y-2 p-2 backdrop-blur-sm"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div
        className="px-2 py-1 text-center text-xs font-semibold text-muted-foreground border-b mb-1"
        data-testid="toolbar-title"
      >
        {t('tools.title')}
      </div>

      {/* Zoom Controls */}
      <EditorToolbarButton
        onClick={onZoomIn}
        tooltipText={`${t('tools.zoomIn')} (Shortcut: +)`}
        icon={<ZoomIn className="h-5 w-5" />}
        testId="zoom-in-button"
      />

      <EditorToolbarButton
        onClick={onZoomOut}
        tooltipText={`${t('tools.zoomOut')} (Shortcut: -)`}
        icon={<ZoomOut className="h-5 w-5" />}
        testId="zoom-out-button"
      />

      <EditorToolbarButton
        onClick={onResetView}
        tooltipText={`${t('tools.resetView')} (Shortcut: R)`}
        icon={<Maximize2 className="h-5 w-5" />}
        testId="reset-view-button"
      />

      <Separator className="my-1" />

      {/* Edit Mode Controls */}
      <EditorToolbarButton
        onClick={onToggleEditMode}
        tooltipText={`${editMode ? t('tools.exitPolygonCreation') : t('tools.createPolygon')} (Shortcut: E)`}
        icon={<PlusCircle className="h-5 w-5" />}
        testId="edit-mode-button"
        isActive={editMode}
        activeVariant="default"
      />

      <EditorToolbarButton
        onClick={onToggleSlicingMode}
        tooltipText={`${slicingMode ? t('tools.exitSlicingMode') : t('tools.splitPolygon')} (Shortcut: S)`}
        icon={<Scissors className="h-5 w-5" />}
        testId="slice-mode-button"
        isActive={slicingMode}
        activeVariant="destructive"
      />

      <EditorToolbarButton
        onClick={onTogglePointAddingMode}
        tooltipText={`${pointAddingMode ? t('tools.exitPointAddingMode') : t('tools.addPoints')} (Shortcut: A)`}
        icon={<Pencil className="h-5 w-5" />}
        testId="add-points-button"
        isActive={pointAddingMode}
        activeVariant="secondary"
      />

      <Separator className="my-1" />

      {/* History Controls */}
      <EditorToolbarButton
        onClick={onUndo}
        tooltipText={`${t('tools.undo')} (Shortcut: Ctrl+Z)`}
        icon={<Undo2 className="h-5 w-5" />}
        testId="undo-button"
        disabled={!canUndo}
      />

      <EditorToolbarButton
        onClick={onRedo}
        tooltipText={`${t('tools.redo')} (Shortcut: Ctrl+Y)`}
        icon={<Redo2 className="h-5 w-5" />}
        testId="redo-button"
        disabled={!canRedo}
      />
    </motion.div>
  );
};

export default EditorToolbar;
