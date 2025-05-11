import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSegmentationV2, EditMode } from './hooks/segmentation';
import { useSegmentationKeyboard } from './hooks/useSegmentationKeyboard';
import CanvasV2 from './components/canvas/CanvasV2';
import { ToolbarV2 } from './components/toolbar/ToolbarV2';
import { StatusBarV2 } from './components/statusbar/StatusBarV2';
import KeyboardShortcutsHelp from './components/keyboard/KeyboardShortcutsHelp';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProjectData } from '@/hooks/useProjectData';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, Keyboard } from 'lucide-react';
import { toast } from 'sonner';

export const SegmentationPage: React.FC = () => {
  const { projectId, imageId } = useParams<{
    projectId: string;
    imageId: string;
  }>();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Create a ref for the canvas
  const canvasRef = useRef<HTMLDivElement>(null);

  const { images: projectImages, loading: projectLoading } = useProjectData(projectId);

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
    error,
    canUndo,
    canRedo,
    setEditMode,
    setTransform,
    setHoveredVertex,
    setSelectedPolygonId,
    setTempPoints,
    setInteractionState,
    handleSave,
    handleResegment,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    handleWheel,
    undo,
    redo,
    handleDeletePolygon,
  } = useSegmentationV2(projectId, imageId, canvasRef, t);

  const [showShortcuts, setShowShortcuts] = useState(false);

  const currentImageIndex = projectImages.findIndex((img) => img.id === imageId);

  const handleResetView = useCallback(() => {
    if (!imageData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    // Calculate zoom to fit the image in the viewport
    const zoom = Math.min(canvasWidth / imageData.width, canvasHeight / imageData.height) * 0.95;

    // Center the image
    const tx = canvasWidth / 2 - (imageData.width / 2) * zoom;
    const ty = canvasHeight / 2 - (imageData.height / 2) * zoom;

    setTransform({ zoom, translateX: tx, translateY: ty });
  }, [imageData, canvasRef, setTransform]);

  // Reset view whenever image data changes
  useEffect(() => {
    if (imageData && !isLoading && canvasRef.current) {
      handleResetView();
    }
  }, [imageData, isLoading, canvasRef, handleResetView]);

  const handleZoomIn = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.2, 10.0), // Max zoom 10x (1000%)
    }));
  }, [setTransform]);

  const handleZoomOut = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.2, 0.5), // Min zoom 0.5x (50%)
    }));
  }, [setTransform]);

  const handleDelete = useCallback(() => {
    if (selectedPolygonId) {
      handleDeletePolygon();
    }
  }, [selectedPolygonId, handleDeletePolygon]);

  // Setup keyboard shortcuts
  const { isShiftPressed } = useSegmentationKeyboard({
    editMode,
    setEditMode,
    canUndo,
    canRedo,
    onUndo: undo,
    onRedo: redo,
    onSave: handleSave,
    onDelete: handleDelete,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetView: handleResetView,
  });

  const goToImage = (index: number) => {
    if (index >= 0 && index < projectImages.length) {
      const nextImageId = projectImages[index].id;

      // Force a refresh by adding a timestamp to the URL
      const timestamp = Date.now();

      // Use navigate to change the URL without a full page reload
      navigate(`/projects/${projectId}/segmentation/${nextImageId}?t=${timestamp}`);

      console.log(`Navigation to image: ${nextImageId} with timestamp: ${timestamp}`);

      // Force a refresh of the image data and segmentation data
      // This will be handled by the useEffect in useSegmentationV2 when imageId changes
    } else {
      console.warn(`Invalid image index: ${index}, projectImages length: ${projectImages.length}`);
    }
  };

  const goToPreviousImage = () => {
    goToImage(currentImageIndex - 1);
  };

  const goToNextImage = () => {
    goToImage(currentImageIndex + 1);
  };

  const goToProject = () => {
    // Use navigate to go back to the project detail page
    navigate(`/project/${projectId}`);
  };

  if (isLoading || projectLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!imageData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2 dark:text-white">
            {t('segmentation.imageNotFound') || 'Image Not Found'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {error
              ? error
              : t('segmentation.imageNotFoundDescription') ||
                "The image you're trying to access doesn't exist or has been deleted."}
          </p>
          <div className="flex flex-col space-y-3">
            <Button variant="default" onClick={goToProject} className="w-full">
              {t('segmentation.returnToProject') || 'Return to Project'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
              {t('common.dashboard') || 'Go to Dashboard'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-shrink-0 border-r border-border">
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
        </div>

        <div className="flex-1 flex flex-col relative">
          <div className="flex items-center justify-between p-2 border-b border-border bg-muted/40">
            <Button variant="outline" size="sm" onClick={goToProject}>
              <ChevronsLeft className="h-4 w-4 mr-2" />
              {t('segmentation.backToProject') || 'Back to Project'}
            </Button>
            <div className="text-sm font-medium">
              {imageData?.name} ({currentImageIndex + 1} / {projectImages.length})
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousImage}
                disabled={currentImageIndex <= 0}
                aria-label={t('segmentation.previousImage') || 'Previous Image'}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextImage}
                disabled={currentImageIndex >= projectImages.length - 1}
                aria-label={t('segmentation.nextImage') || 'Next Image'}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={canvasRef} className="flex-1 relative overflow-hidden bg-gray-900">
            <CanvasV2
              canvasRef={canvasRef}
              imageData={imageData}
              segmentationData={segmentationData}
              transform={transform}
              selectedPolygonId={selectedPolygonId}
              hoveredVertex={hoveredVertex}
              setHoveredVertex={setHoveredVertex}
              tempPoints={tempPoints}
              editMode={editMode}
              interactionState={interactionState}
              // Add required props for vertex interactions
              setSelectedPolygonId={setSelectedPolygonId}
              setEditMode={setEditMode}
              setTempPoints={setTempPoints}
              setInteractionState={setInteractionState}
              // Event handlers
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={(e) => {
                // Convert React.WheelEvent to native WheelEvent
                handleWheel(e.nativeEvent);
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
            <Button
              variant="outline"
              size="icon"
              className="absolute bottom-4 right-4 z-10 bg-background/80 backdrop-blur-sm hover:bg-secondary/90"
              onClick={() => setShowShortcuts((prev) => !prev)}
              aria-label={t('segmentation.toggleShortcuts') || 'Toggle Keyboard Shortcuts'}
            >
              <Keyboard className="h-5 w-5" />
            </Button>
          </div>

          <StatusBarV2
            zoom={transform.zoom}
            imageCoords={null}
            editMode={editMode}
            selectedPolygonId={selectedPolygonId}
            polygonCount={segmentationData?.polygons?.length || 0}
            vertexCount={
              segmentationData?.polygons?.reduce((count, polygon) => count + (polygon.points?.length || 0), 0) || 0
            }
            imageWidth={imageData?.width}
            imageHeight={imageData?.height}
          />
        </div>
      </div>

      {/* Keyboard Shortcuts Help Modal/Dialog */}
      {showShortcuts && <KeyboardShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
};
