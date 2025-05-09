import React from 'react';
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Pencil,
  Undo2,
  Redo2,
  Scissors,
  PlusCircle
} from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { useLanguage } from '@/contexts/LanguageContext';

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
  canRedo
}: EditorToolbarProps) => {
  const { t } = useLanguage();

  return (
    <motion.div
      className="absolute top-4 left-4 z-10 bg-background/95 border rounded-lg shadow-xl flex flex-col space-y-2 p-2 backdrop-blur-sm"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="px-2 py-1 text-center text-xs font-semibold text-muted-foreground border-b mb-1" data-testid="toolbar-title">
        {t('tools.title')}
      </div>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-foreground/80 hover:bg-muted hover:text-foreground"
              onClick={onZoomIn}
              data-testid="zoom-in-button"
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{t('tools.zoomIn')} (Shortcut: +)</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-foreground/80 hover:bg-muted hover:text-foreground"
              onClick={onZoomOut}
              data-testid="zoom-out-button"
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{t('tools.zoomOut')} (Shortcut: -)</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-foreground/80 hover:bg-muted hover:text-foreground"
              onClick={onResetView}
              data-testid="reset-view-button"
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{t('tools.resetView')} (Shortcut: R)</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Separator className="my-1" />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editMode ? "default" : "ghost"}
              size="icon"
              className={`h-9 w-9 ${editMode ? '' : 'text-foreground/80 hover:bg-muted hover:text-foreground'}`}
              onClick={onToggleEditMode}
              data-testid="edit-mode-button"
            >
              <PlusCircle className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{editMode ? t('tools.exitPolygonCreation') : t('tools.createPolygon')} (Shortcut: E)</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={slicingMode ? "destructive" : "ghost"}
              size="icon"
              className={`h-9 w-9 ${slicingMode ? '' : 'text-foreground/80 hover:bg-muted hover:text-foreground'}`}
              onClick={onToggleSlicingMode}
              data-testid="slice-mode-button"
            >
              <Scissors className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{slicingMode ? t('tools.exitSlicingMode') : t('tools.splitPolygon')} (Shortcut: S)</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={pointAddingMode ? "secondary" : "ghost"}
              size="icon"
              className={`h-9 w-9 ${pointAddingMode ? '' : 'text-foreground/80 hover:bg-muted hover:text-foreground'}`}
              onClick={onTogglePointAddingMode}
              data-testid="add-points-button"
            >
              <Pencil className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{pointAddingMode ? t('tools.exitPointAddingMode') : t('tools.addPoints')} (Shortcut: A)</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Separator className="my-1" />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-foreground/80 hover:bg-muted hover:text-foreground disabled:opacity-50"
              onClick={onUndo}
              disabled={!canUndo}
              data-testid="undo-button"
            >
              <Undo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{t('tools.undo')} (Shortcut: Ctrl+Z)</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-foreground/80 hover:bg-muted hover:text-foreground disabled:opacity-50"
              onClick={onRedo}
              disabled={!canRedo}
              data-testid="redo-button"
            >
              <Redo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>{t('tools.redo')} (Shortcut: Ctrl+Y)</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
};

export default EditorToolbar;
