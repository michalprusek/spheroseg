import React, { useCallback, useEffect, useState } from 'react';
// Use the refactored version of useSegmentationV2
import { useSegmentationV2, EditMode } from './hooks/segmentation';
import { useSlicing } from './hooks/useSlicing';
import CanvasV2 from './components/canvas/CanvasV2';
import { ToolbarV2 } from './components/toolbar/ToolbarV2';
import { SegmentationErrorBoundary } from './components/SegmentationErrorBoundary';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '@/lib/apiClient';

interface SegmentationEditorV2Props {
  projectId?: string;
  imageId?: string;
}

const SegmentationEditorV2Inner: React.FC<SegmentationEditorV2Props> = ({ projectId, imageId }) => {
  // Create a ref for the canvas
  const canvasRef = React.useRef<HTMLDivElement>(null); // Keep as null, ensure null checks

  // Use navigate for URL updates
  const navigate = useNavigate();

  // Use translation
  const { t } = useTranslation();

  const {
    imageData,
    segmentationData,
    transform,
    editMode,
    selectedPolygonId,
    hoveredVertex,
    tempPoints,
    interactionState,
    isLoading,
    isSaving,
    isResegmenting,
    canUndo,
    canRedo,
    setEditMode,
    setSelectedPolygonId,
    setTransform,
    setTempPoints,
    setInteractionState,
    setHoveredVertex,
    fetchData: fetchSegmentationData,
    setSegmentationDataWithHistory,
    handleSave,
    handleResegment,
    undo,
    redo,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    getCanvasCoordinates,
    handleWheelEvent,
  } = useSegmentationV2(projectId ?? '', imageId ?? null, canvasRef, t); // Pass projectId as string, imageId as string or null

  // Use the slicing hook with direct access to setSegmentationDataWithHistory
  const { handleSliceAction } = useSlicing({
    segmentationData,
    setSegmentationData: setSegmentationDataWithHistory,
    selectedPolygonId, // Remove explicit cast
    setSelectedPolygonId,
    tempPoints,
    setTempPoints,
    setInteractionState,
    setEditMode,
  });

  // Handle imageId changes
  useEffect(() => {
    if (imageId && projectId) {
      console.log(`[SegmentationEditorV2] imageId changed to: ${imageId}`);

      // If we have imageData with a different ID than requested, we need to update the URL
      if (imageData && imageData.actualId && imageData.actualId !== imageId) {
        console.log(`[SegmentationEditorV2] Need to update URL from ${imageId} to ${imageData.actualId}`);

        // Update the URL using react-router
        navigate(`/projects/${projectId}/segmentation/${imageData.actualId}`, {
          replace: true,
        });

        // Note: Using replace: true to avoid adding to browser history
        // This prevents back button from going to the wrong image ID
      }
    }
  }, [imageId, imageData, projectId, navigate]);

  // Configurable delay for slice action (can be overridden via env variable)
  const SLICE_ACTION_DELAY = parseInt(import.meta.env.VITE_SLICE_ACTION_DELAY || '50', 10);

  // Watch for slice completion - when we have 2 points in Slice mode
  useEffect(() => {
    console.log('[SegmentationEditorV2] Slice mode check:', {
      editMode,
      tempPointsLength: tempPoints.length,
      selectedPolygonId,
      tempPoints
    });
    
    if (editMode === EditMode.Slice && tempPoints.length === 2 && selectedPolygonId) {
      console.log('[SegmentationEditorV2] Slice points ready, triggering slice action');
      
      // Add a configurable delay to ensure state is properly updated
      const timeoutId = setTimeout(() => {
        try {
          // Trigger the slice action with error handling
          const success = handleSliceAction();
          
          if (success) {
            console.log('[SegmentationEditorV2] Slice action completed successfully');
          } else {
            console.log('[SegmentationEditorV2] Slice action failed');
          }
        } catch (error) {
          console.error('[SegmentationEditorV2] Error during slice action:', error);
          toast.error(t('segmentation.sliceError') || 'An error occurred while slicing the polygon');
        }
      }, SLICE_ACTION_DELAY);
      
      return () => clearTimeout(timeoutId);
    }
  }, [editMode, tempPoints, selectedPolygonId, handleSliceAction, SLICE_ACTION_DELAY]);

  // Zoom handlers
  const handleZoomIn = () => {
    setTransform((prev) => ({
      ...prev,
      zoom: prev.zoom * 1.2,
    }));
  };

  const handleZoomOut = () => {
    setTransform((prev) => ({
      ...prev,
      zoom: prev.zoom / 1.2,
    }));
  };

  const handleResetView = () => {
    if (!imageData || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const initialZoom = Math.min(canvasRect.width / imageData.width, canvasRect.height / imageData.height);

    const tx = canvasRect.width / 2 - (imageData.width / 2) * initialZoom;
    const ty = canvasRect.height / 2 - (imageData.height / 2) * initialZoom;

    setTransform({
      zoom: initialZoom,
      translateX: tx,
      translateY: ty,
    });
  };

  // Note: handleResegment is now provided by the useSegmentationV2 hook
  // We don't need to define it here anymore

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading segmentation editor...</p>
        </div>
      </div>
    );
  }

  // Logging removed for better performance

  return (
    <div className="flex flex-col w-full h-full">
      <ToolbarV2
        editMode={editMode}
        setEditMode={setEditMode}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onSave={handleSave}
        onUndo={undo}
        onRedo={redo}
        onResegment={handleResegment}
        canUndo={canUndo}
        canRedo={canRedo}
        isSaving={isSaving}
        isResegmenting={isResegmenting}
      />

      <div className="flex-1 relative" id="canvas-container">
        <CanvasV2
          imageData={imageData}
          segmentationData={segmentationData}
          transform={transform}
          editMode={editMode}
          selectedPolygonId={selectedPolygonId}
          hoveredVertex={hoveredVertex}
          tempPoints={tempPoints}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          canvasRef={canvasRef}
          setHoveredVertex={setHoveredVertex}
          interactionState={interactionState}
          setSelectedPolygonId={setSelectedPolygonId}
          setEditMode={setEditMode}
          setTempPoints={setTempPoints}
          setInteractionState={setInteractionState}
          onWheel={handleWheelEvent}
        />
      </div>
    </div>
  );
};

// Export the component wrapped with error boundary
export const SegmentationEditorV2: React.FC<SegmentationEditorV2Props> = (props) => {
  return (
    <SegmentationErrorBoundary>
      <SegmentationEditorV2Inner {...props} />
    </SegmentationErrorBoundary>
  );
};
