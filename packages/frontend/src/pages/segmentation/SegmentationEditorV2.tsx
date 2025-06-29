import React, { useCallback, useEffect, useState } from 'react';
// Use the refactored version of useSegmentationV2
import { useSegmentationV2, EditMode } from './hooks/segmentation';
import { useSlicing } from './hooks/useSlicing';
import CanvasV2 from './components/canvas/CanvasV2';
import { ToolbarV2 } from './components/toolbar/ToolbarV2';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '@/lib/apiClient';

interface SegmentationEditorV2Props {
  projectId?: string;
  imageId?: string;
}

export const SegmentationEditorV2: React.FC<SegmentationEditorV2Props> = ({ projectId, imageId }) => {
  // Create a ref for the canvas
  const canvasRef = React.useRef<HTMLDivElement>(null); // Keep as null, ensure null checks

  // Use navigate for URL updates
  const navigate = useNavigate();

  // Use translation
  const { t } = useTranslation();

  // State for resegmentation
  const [isResegmenting, setIsResegmenting] = useState(false);

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

  // Handle resegmentation with neural network
  const handleResegment = async () => {
    if (!projectId || !imageId || !imageData) {
      toast.error(t('segmentation.resegment.error.missingData'));
      return;
    }

    try {
      setIsResegmenting(true);

      // Call the API to trigger resegmentation
      const response = await apiClient.post(`/api/projects/${projectId}/images/${imageId}/segment`, {
        force: true, // Force resegmentation even if segmentation already exists
      });

      // Axios throws an error for non-2xx responses, so no need to check response.ok
      // Check if the segmentation was successful
      if (response.data.success) {
        toast.success(t('segmentation.resegment.success'));

        // Reload the segmentation data without refreshing the page
        // We'll use a small delay to allow the server to process the segmentation
        setTimeout(() => {
          // Fetch the updated segmentation data
          fetchSegmentationData();
        }, 1000);
      } else {
        toast.error(t('segmentation.resegment.error.failed'));
      }
    } catch (error) {
      console.error('Error during resegmentation:', error);
      toast.error(
        t('segmentation.resegment.error.exception', {
          error: (error as Error).message,
        }),
      );
    } finally {
      setIsResegmenting(false);
    }
  };

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
