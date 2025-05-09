import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { SegmentationProvider } from '../../contexts/SegmentationContext';
import EditorLayout from '../layout/EditorLayout';
import EditorHeader from '../EditorHeader';
import EditorContent from '../layout/EditorContent';
import EditorToolbar from '../EditorToolbar';
import CanvasV2 from '../canvas/CanvasV2';
import RegionPanel from '../RegionPanel';
import StatusBar from '../StatusBar';
import DebugOverlay from './DebugOverlay';
import KeyboardShortcutsHelp from '../KeyboardShortcutsHelp';
import type { KeyboardShortcutsHelpRef } from '../KeyboardShortcutsHelp';

import { CanvasSegmentationData, ProjectImage, Polygon as CanvasPolygonType } from '@/types';
import { Point, Polygon } from '@/lib/segmentation';
import type { TempPointsState as TempPointsStateType, VertexDragState as VertexDragStateType } from '../../types';
import { EditMode } from '../../hooks/useSegmentationV2';
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import { toast } from 'sonner';

interface EditorContainerProps {
  hoveredPolygonId: string | null;
  handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  projectId: string;
  projectTitle: string;
  imageName: string;
  imageId: string | undefined;
  imageSrc: string;
  segmentationResultPath?: string | null;
  loading: boolean;
  saving: boolean;
  segmentation: CanvasSegmentationData | null;
  selectedPolygonId: string | null;
  hoveredVertex: { polygonId: string | null, vertexIndex: number | null };
  zoom: number;
  translateX: number;
  translateY: number;
  history: CanvasSegmentationData[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  dragState: React.MutableRefObject<InteractionState>;
  vertexDragState: React.MutableRefObject<VertexDragState>;
  tempPoints: TempPointsState;
  cursorPosition: Point | null;
  editMode: EditMode;
  slicingMode: boolean;
  pointAddingMode: { isActive: boolean; sourcePolygonId: string | null; pointIndex: number | null; };
  sliceStartPoint: Point | null;
  hoveredSegment: { polygonId: string; segmentIndex: number; projectedPoint: Point | null } | null;
  canvasContainerRef: React.RefObject<HTMLDivElement>;
  projectImages: ProjectImage[];
  setSelectedPolygonId: (id: string | null) => void;
  _handleMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  _handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  _handleMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
  _handleMouseLeave: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetView: () => void;
  handleSave: () => Promise<void>;
  navigateToImage: (direction: 'prev' | 'next' | number) => void;
  toggleEditMode: () => void;
  toggleSlicingMode: () => void;
  togglePointAddingMode: () => void;
  exitAllEditModes: () => void;
  isShiftPressed: boolean;
  handleDeletePolygon: (id: string) => void;
  handleResegmentCurrentImage: () => void;
  onSetPolygonType: (id: string, type: CanvasPolygonType['type']) => void;

  // Auto-save props
  autoSaveEnabled?: boolean;
  autoSaveStatus?: 'idle' | 'pending' | 'saving' | 'success' | 'error';
  hasUnsavedChanges?: boolean;
  toggleAutoSave?: () => void;
  saveNow?: () => Promise<void>;
}

interface PanDragState {
  type: 'pan';
  startX: number;
  startY: number;
}

type TempPointsState = TempPointsStateType;
type VertexDragState = VertexDragStateType;
type InteractionState = PanDragState | null;

const EditorContainer = ({
  hoveredPolygonId,
  handleMouseMove,
  projectId,
  projectTitle,
  imageName,
  imageId,
  imageSrc,
  segmentationResultPath,
  loading,
  saving,
  segmentation,
  selectedPolygonId,
  hoveredVertex,
  zoom,
  translateX,
  translateY,
  history,
  historyIndex,
  canUndo,
  canRedo,
  undo,
  redo,
  dragState,
  vertexDragState,
  tempPoints,
  cursorPosition,
  editMode,
  slicingMode,
  pointAddingMode,
  sliceStartPoint,
  hoveredSegment,
  canvasContainerRef,
  projectImages,
  setSelectedPolygonId,
  _handleMouseDown,
  _handleMouseMove,
  _handleMouseUp,
  _handleMouseLeave,
  handleZoomIn,
  handleZoomOut,
  handleResetView,
  handleSave,
  navigateToImage,
  toggleEditMode,
  toggleSlicingMode,
  togglePointAddingMode,
  exitAllEditModes,
  isShiftPressed,
  handleDeletePolygon,
  handleResegmentCurrentImage,
  onSetPolygonType,
  autoSaveEnabled = false,
  autoSaveStatus = 'idle',
  hasUnsavedChanges = false,
  toggleAutoSave = () => {},
  saveNow
}: EditorContainerProps) => {
  const keyboardShortcutsRef = React.useRef<KeyboardShortcutsHelpRef>(null);

  const { t } = useLanguage();

  const currentImageIndex = projectImages?.findIndex(img => img.id === imageId) ?? -1;
  const totalImages = projectImages?.length ?? 0;

  const [cursorScreenPosition, setCursorScreenPosition] = useState<{ left: number; top: number } | null>(null);
  const [lastClickScreenPosition, setLastClickScreenPosition] = useState<{ left: number; top: number } | null>(null);

  const onContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = canvasContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setCursorScreenPosition({ left: e.clientX - rect.left, top: e.clientY - rect.top });
    }
    _handleMouseMove(e);
  };

  const onContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = canvasContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setLastClickScreenPosition({ left: e.clientX - rect.left, top: e.clientY - rect.top });
    }
    _handleMouseDown(e);
  };

  const onContainerMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    _handleMouseUp(e);
  };

  const onContainerMouseLeave = () => {
    _handleMouseLeave();
  };

  const handleExportMask = useCallback(async () => {
    if (!imageId || !imageName) {
      toast.error(t('export.noImageSelectedError') || 'Cannot export mask: Image ID or name is missing.');
      return;
    }
    console.log(`Requesting mask export for image ID: ${imageId}`);
    toast.info(t('export.maskExportStarted') || `Exporting mask for ${imageName}...`);
    try {
      const exportUrl = `/api/images/${imageId}/export/mask`;
      const link = document.createElement('a');
      const baseUrl = apiClient.getUri().replace(/\/$/, '');
      link.href = `${baseUrl}${exportUrl}`;
      const filename = imageName ? `${imageName.split('.').slice(0, -1).join('.') || imageName}_mask.png` : `segmentation_mask_${imageId}.png`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting segmentation mask:', error);
      if (axios.isAxiosError(error)) {
         console.error('Axios error details:', error.response?.data || error.message);
         toast.error(`${t('export.maskExportError') || 'Failed to export segmentation mask.'} Status: ${error.response?.status || 'N/A'}`);
      } else {
        toast.error(t('export.maskExportError') || 'Failed to export segmentation mask.');
      }
    }
  }, [imageId, imageName, t]);

  const localHandleSave = useCallback(async () => {
    await handleSave();
  }, [handleSave]);

  const onContainerWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    // Implement wheel event handling logic here
    // Example: handleZoom(e.deltaY > 0 ? 0.9 : 1.1);
    // Prevent default page scroll
  };

  return (
    <SegmentationProvider segmentation={segmentation} loading={loading}>
      <EditorLayout>
        <EditorHeader
          projectId={projectId}
          projectTitle={projectTitle}
          imageName={imageName}
          imageId={imageId}
          saving={saving}
          loading={loading}
          currentImageIndex={currentImageIndex !== -1 ? currentImageIndex : 0}
          totalImages={totalImages}
          onNavigate={navigateToImage}
          onSave={localHandleSave}
          onResegmentCurrentImage={handleResegmentCurrentImage}
          onExportMask={handleExportMask}
        />

        <EditorContent>
          <EditorToolbar
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetView={handleResetView}
            onSave={localHandleSave}
            editMode={editMode === EditMode.EditVertices}
            slicingMode={slicingMode}
            pointAddingMode={pointAddingMode.isActive}
            onToggleEditMode={toggleEditMode}
            onToggleSlicingMode={toggleSlicingMode}
            onTogglePointAddingMode={togglePointAddingMode}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />

          {/* Canvas + DebugOverlay wrapper */}
          <div
            ref={canvasContainerRef}
            className="flex-1 relative w-full h-full overflow-hidden"
          >
            <CanvasV2
              segmentationData={{ polygons: segmentation?.polygons ?? [] }} // Ensure polygons array exists
              imageData={imageSrc ? { src: imageSrc, width: segmentation?.imageWidth ?? 0, height: segmentation?.imageHeight ?? 0 } : null} // Renamed from imageSrc and constructing ImageData
              tempPoints={tempPoints.points} // Pass the points array
              cursorPosition={cursorPosition}
              editMode={editMode} // Added missing prop
              selectedPolygonId={selectedPolygonId} // Added missing prop
              hoveredVertex={hoveredVertex} // Added missing prop
              onDeletePolygon={handleDeletePolygon}
              onMouseDown={onContainerMouseDown}
              onMouseMove={onContainerMouseMove}
              onMouseUp={onContainerMouseUp}
              onWheel={onContainerWheel} // Added missing prop
              transform={{ zoom, translateX, translateY }} // Combine into transform object
              // Removed individual zoom, translateX, translateY props
            />
            <DebugOverlay
              cursorScreenPosition={cursorScreenPosition}
              lastClickScreenPosition={lastClickScreenPosition}
              zoom={zoom}
              offset={{ x: translateX, y: translateY }}
              canvasWidth={canvasContainerRef.current?.clientWidth}
              canvasHeight={canvasContainerRef.current?.clientHeight}
              imageWidth={segmentation?.imageWidth} // Propagate image dimensions for debug
              imageHeight={segmentation?.imageHeight} // Propagate image dimensions for debug
            />
          </div>

          <RegionPanel
            loading={loading}
            segmentation={segmentation}
            selectedPolygonId={selectedPolygonId}
            onSelectPolygon={setSelectedPolygonId}
          />

          {/* Keyboard Shortcuts Help Button (bottom-right overlay, matches canvas) */}
          <div className="absolute bottom-4 right-4 z-50">
            <button
              className="flex items-center gap-1.5 bg-gray-800/80 hover:bg-gray-700/90 text-white rounded-full shadow-lg backdrop-blur-sm px-3 py-2"
              onClick={() => {
                console.log('[EditorContainer Debug] Shortcut button clicked. Ref:', keyboardShortcutsRef.current);
                if (keyboardShortcutsRef.current?.open) {
                  keyboardShortcutsRef.current.open();
                } else {
                  console.error('[EditorContainer Debug] keyboardShortcutsRef.current.open is not available or ref is null/undefined.');
                }
              }}
              data-testid="keyboard-shortcuts-icon"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16V8m0 0a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2z" /></svg>
              <span>{t('shortcuts.title') || 'Shortcuts'}</span>
            </button>
            <KeyboardShortcutsHelp ref={keyboardShortcutsRef} />
          </div>
        </EditorContent>

        <StatusBar
          segmentation={segmentation}
          editMode={editMode === EditMode.EditVertices ? 'edit' : slicingMode ? 'slice' : pointAddingMode.isActive ? 'add' : undefined}
          autoSaveEnabled={autoSaveEnabled}
          autoSaveStatus={autoSaveStatus}
          hasUnsavedChanges={hasUnsavedChanges}
          onToggleAutoSave={toggleAutoSave}
        />

      </EditorLayout>
    </SegmentationProvider>
  );
};

export default EditorContainer;
