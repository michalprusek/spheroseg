import { useState, useRef, useEffect, useCallback, RefObject } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { TFunction } from 'i18next';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import apiClient from '@/lib/apiClient';

import {
  EditMode,
  InteractionState,
  Point,
  SegmentationData,
  TransformState,
  ImageData
} from './types';
import { MIN_ZOOM, MAX_ZOOM } from './constants';
import {
  fetchImageData,
  fetchSegmentationData,
  createEmptySegmentation,
  saveSegmentationData
} from './api';
import {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  handleDeletePolygon
} from './interactions';
import { calculateCenteringTransform, getCanvasCoordinates } from './coordinates';
import { useSegmentationCache } from './useSegmentationCache';
// Import other utilities but not slicePolygon (now handled by useSlicing)

/**
 * Main hook for segmentation editor
 */
export const useSegmentationV2 = (
  projectId: string,
  initialImageId: string | null,
  canvasRef: RefObject<HTMLDivElement>,
  t: TFunction
) => {

  // State for image data and loading
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResegmenting, setIsResegmenting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Use the useUndoRedo hook for segmentation data with history management
  const {
    state: segmentationData,
    setState: setSegmentationDataWithHistory,
    setStateWithoutHistory: updateSegmentationWithoutHistory,
    undo,
    redo,
    canUndo,
    canRedo
  } = useUndoRedo<SegmentationData | null>(null);

  // Use segmentation cache
  const {
    getFromCache,
    addToCache,
    removeFromCache,
    getCacheStats
  } = useSegmentationCache();

  // State for editor
  const [editMode, setEditModeInternal] = useState<EditMode>(EditMode.View);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<{ polygonId: string; vertexIndex: number } | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [lastAutoAddedPoint, setLastAutoAddedPoint] = useState<Point | null>(null);

  // Wrapper for setEditMode that resets state when mode changes
  const setEditMode = useCallback((newMode: EditMode) => {
    console.log(`[useSegmentationV2] Changing edit mode from ${EditMode[editMode]} to ${EditMode[newMode]}`);

    // Reset state when changing modes
    if (newMode !== editMode) {
      // Reset temp points
      setTempPoints([]);

      // Reset interaction state
      setInteractionState({
        isDraggingVertex: false,
        isPanning: false,
        panStart: null,
        draggedVertexInfo: null,
        sliceStartPoint: null,
        addPointStartVertex: null,
        addPointEndVertex: null,
        isAddingPoints: false
      });

      // Handle mode-specific transitions
      if (newMode === EditMode.View) {
        // Always clear selection when going to View mode
        setSelectedPolygonId(null);
      } else if (newMode === EditMode.CreatePolygon) {
        // Always clear selection when creating a new polygon
        setSelectedPolygonId(null);
      } else if (newMode === EditMode.Slice) {
        // Keep selection if we have one, as we need a polygon to slice
        // But don't auto-select a polygon - user should explicitly select what to slice
        // No toast notification - user will figure it out
      } else if (newMode === EditMode.AddPoints) {
        // In Add Points mode, we don't require a polygon to be selected
        // User will click directly on a vertex to start adding points
      } else if (newMode === EditMode.EditVertices) {
        // Keep selection if we have one, as we need a polygon to edit
        // But don't auto-select a polygon - user should explicitly select what to edit
        // No toast notification - user will figure it out
      } else if (newMode === EditMode.DeletePolygon) {
        // Keep selection if we have one, but don't require it
        // User will click on the polygon they want to delete
      }

      // Reset hovered vertex
      setHoveredVertex(null);

      // Reset last auto-added point
      setLastAutoAddedPoint(null);
    }

    // Set the new mode
    setEditModeInternal(newMode);

    // Log the mode change for debugging
    console.log(`[useSegmentationV2] Edit mode changed to ${EditMode[newMode]}`);
  }, [editMode]);

  // State for transform (pan/zoom)
  const [transform, setTransform] = useState<TransformState>({
    zoom: 1,
    translateX: 0,
    translateY: 0
  });

  // State for interaction
  const [interactionState, setInteractionState] = useState<InteractionState>({
    isDraggingVertex: false,
    isPanning: false,
    panStart: null,
    draggedVertexInfo: null,
    sliceStartPoint: null,
    // Add point mode states
    addPointStartVertex: null,
    addPointEndVertex: null,
    isAddingPoints: false
  });

  // State for keyboard modifiers
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  // Refs
  const imageIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const backgroundRefreshControllerRef = useRef<AbortController | null>(null);

  // Function to refresh segmentation data in the background
  const refreshSegmentationInBackground = async (segmentationId: string) => {
    console.log(`[useSegmentationV2] Refreshing segmentation in background: ${segmentationId}`);

    // Cancel any ongoing background refresh
    if (backgroundRefreshControllerRef.current) {
      backgroundRefreshControllerRef.current.abort();
    }

    // Create a new abort controller
    backgroundRefreshControllerRef.current = new AbortController();
    const signal = backgroundRefreshControllerRef.current.signal;

    try {
      // Fetch segmentation data
      const refreshedSegmentation = await fetchSegmentationData(segmentationId, signal);

      // Update cache with fresh data
      addToCache(segmentationId, refreshedSegmentation);

      console.log(`[useSegmentationV2] Background refresh completed for: ${segmentationId}`);

      // If this is the current segmentation, update it
      if (segmentationData && segmentationData.image_id === segmentationId) {
        console.log(`[useSegmentationV2] Updating current segmentation with refreshed data`);
        setSegmentationDataWithHistory(refreshedSegmentation, true);
      }
    } catch (error) {
      // Ignore errors in background refresh
      console.log(`[useSegmentationV2] Background refresh failed for: ${segmentationId}`, error);
    }
  };

  // Create a ref to track previous initialImageId to prevent unnecessary updates
  const prevInitialImageIdRef = useRef<string | null>(null);

  // Update imageIdRef when initialImageId changes
  useEffect(() => {
    if (!initialImageId) return;

    // Only process if initialImageId has actually changed
    if (initialImageId === prevInitialImageIdRef.current) {
      console.log(`[useSegmentationV2] Skipping update - initialImageId ${initialImageId} hasn't changed`);
      return;
    }

    // Update the previous ID ref
    prevInitialImageIdRef.current = initialImageId;
    console.log(`[useSegmentationV2] initialImageId changed to: ${initialImageId}`);

    // Store the requested ID
    imageIdRef.current = initialImageId;

    // Reset state when image changes
    setSelectedPolygonId(null);
    setTempPoints([]);
    setEditMode(EditMode.View);

    // Clear segmentation data to avoid showing old data while loading
    setSegmentationDataWithHistory(null, true);

    // Abort any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    console.log(`[useSegmentationV2] Reset state for new image: ${initialImageId}`);
  }, [initialImageId, setSegmentationDataWithHistory]);

  // Fetch data when projectId or imageIdRef changes
  useEffect(() => {
    // Skip if no project ID or image ID
    if (!projectId || !imageIdRef.current) {
      setIsLoading(false);
      return;
    }

    // Use a flag to track if the component is still mounted
    let isMounted = true;

    // Create a new abort controller for this effect instance
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`[useSegmentationV2] Fetching data for Project: ${projectId}, Image: ${imageIdRef.current}`);

        // Log cache stats
        const cacheStats = getCacheStats();
        console.log(`[useSegmentationV2] Cache stats: ${cacheStats.size} items cached`);

        // Fetch image data
        const fetchedImageData = await fetchImageData(projectId, imageIdRef.current, signal);

        // Check if component is still mounted before updating state
        if (!isMounted) return;

        // Handle ID mismatch between requested and actual image
        if (imageIdRef.current !== fetchedImageData.id) {
          console.log(`[useSegmentationV2] Found different image ID: ${fetchedImageData.id} (requested: ${imageIdRef.current})`);
          // Store the actual ID for segmentation fetching
          fetchedImageData.actualId = fetchedImageData.id;
        }

        // Set image data
        setImageData(fetchedImageData);
        console.log(`[useSegmentationV2] Fetched Image Data:`, fetchedImageData);

        // Fetch segmentation data using the actual ID if available
        const segmentationId = fetchedImageData.actualId || imageIdRef.current;

        // Try to get segmentation data from cache first
        const cachedSegmentation = getFromCache(segmentationId);

        if (cachedSegmentation) {
          // Use cached segmentation data
          console.log(`[useSegmentationV2] Using cached segmentation data for: ${segmentationId}`);
          setSegmentationDataWithHistory(cachedSegmentation, true);
          setIsLoading(false);

          // Optionally refresh cache in background
          setTimeout(() => {
            refreshSegmentationInBackground(segmentationId);
          }, 2000);

          return;
        }

        console.log(`[useSegmentationV2] No cached data, fetching segmentation from API: ${segmentationId}`);

        try {
          // Create a separate controller for segmentation fetch that won't be aborted by navigation
          const segmentationController = new AbortController();
          const segmentationSignal = segmentationController.signal;

          // Fetch segmentation data with a timeout
          const fetchSegmentationPromise = fetchSegmentationData(segmentationId, segmentationSignal);

          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Segmentation fetch timeout'));
              segmentationController.abort();
            }, 5000); // 5 second timeout
          });

          // Race the fetch against the timeout
          const fetchedSegmentation = await Promise.race([
            fetchSegmentationPromise,
            timeoutPromise
          ]) as SegmentationData;

          // Check if component is still mounted before updating state
          if (!isMounted) return;

          console.log("[useSegmentationV2] Received segmentation data:", fetchedSegmentation);

          // Add to cache
          addToCache(segmentationId, fetchedSegmentation);

          // Set segmentation data with history (true = overwrite history)
          setSegmentationDataWithHistory(fetchedSegmentation, true);
          console.log(`[useSegmentationV2] Fetched Segmentation Data:`, fetchedSegmentation);
        } catch (segError) {
          // Check if component is still mounted before updating state
          if (!isMounted) return;

          console.error("[useSegmentationV2] Error fetching segmentation data:", segError);

          // Create empty segmentation data and reset history
          const emptySegmentation = createEmptySegmentation(segmentationId);

          // Add empty segmentation to cache
          addToCache(segmentationId, emptySegmentation);

          setSegmentationDataWithHistory(emptySegmentation, true);
          console.log(`[useSegmentationV2] Created empty segmentation data for: ${segmentationId}`);
        }

        // Center the image in the canvas
        if (canvasRef.current && fetchedImageData.width && fetchedImageData.height) {
          const canvasWidth = canvasRef.current.clientWidth;
          const canvasHeight = canvasRef.current.clientHeight;

          const newTransform = calculateCenteringTransform(
            fetchedImageData.width,
            fetchedImageData.height,
            canvasWidth,
            canvasHeight
          );

          setTransform(newTransform);
        }

        setIsLoading(false);
      } catch (error) {
        // Check if component is still mounted before updating state
        if (!isMounted) return;

        console.error("[useSegmentationV2] Error fetching data:", error);

        // Check if this is a cancellation error (which we can ignore)
        const isCancelled = error.name === 'AbortError' ||
                           (error.message && error.message.includes('cancel'));

        if (!isCancelled) {
          setError("Failed to load image data");

          // Create empty image and segmentation data to avoid UI errors
          const emptyImageData = {
            id: imageIdRef.current || 'unknown',
            name: 'Not Found',
            width: 800,
            height: 600,
            src: '/placeholder.svg',
            project_id: projectId || 'unknown',
            user_id: 'unknown',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            storage_path: '',
            thumbnail_path: '',
            status: 'error'
          };

          setImageData(emptyImageData);

          // Create empty segmentation
          const emptySegmentation = createEmptySegmentation(imageIdRef.current || 'unknown');
          setSegmentationDataWithHistory(emptySegmentation, true);
        } else {
          console.log("[useSegmentationV2] Request was cancelled, ignoring error");
        }

        setIsLoading(false);
      }
    };

    // Start the fetch with a small delay to avoid race conditions
    const timeoutId = setTimeout(fetchData, 50);

    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      if (backgroundRefreshControllerRef.current) {
        backgroundRefreshControllerRef.current.abort();
        backgroundRefreshControllerRef.current = null;
      }
    };
  }, [projectId, initialImageId]);

  // Set up keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift key for equidistant point placement
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }

      // Escape key to cancel current operation
      if (e.key === 'Escape') {
        if (editMode !== EditMode.View) {
          setEditMode(EditMode.View);
          setTempPoints([]);
        }
      }

      // Delete key to delete selected polygon
      if (e.key === 'Delete' && selectedPolygonId) {
        handleDeletePolygon(selectedPolygonId, segmentationData, setSelectedPolygonId, setSegmentationDataWithHistory);
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
        setLastAutoAddedPoint(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    editMode,
    selectedPolygonId,
    segmentationData,
    setEditMode,
    setTempPoints,
    setSelectedPolygonId,
    setSegmentationDataWithHistory,
    redo,
    undo,
    setIsShiftPressed,
    setLastAutoAddedPoint
  ]);

  // Function to handle mouse down
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleMouseDown(
      e,
      editMode,
      interactionState,
      segmentationData,
      selectedPolygonId,
      tempPoints,
      transform,
      canvasRef,
      setSelectedPolygonId,
      setEditMode,
      setTempPoints,
      setInteractionState,
      setSegmentationDataWithHistory
    );
  }, [
    editMode,
    interactionState,
    segmentationData,
    selectedPolygonId,
    tempPoints,
    transform,
    canvasRef,
    setSelectedPolygonId,
    setEditMode,
    setTempPoints,
    setInteractionState,
    setSegmentationDataWithHistory
  ]);

  // Function to handle mouse move
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Pokud táhneme vertex, použijeme updateSegmentationWithoutHistory, 
    // aby se pohyb neuložil do historie a undo/redo bral celý tah jako jednu akci
    const updateFn = interactionState.isDraggingVertex
      ? updateSegmentationWithoutHistory
      : setSegmentationDataWithHistory;
    
    handleMouseMove(
      e,
      editMode,
      interactionState,
      segmentationData,
      selectedPolygonId,
      tempPoints,
      transform,
      canvasRef,
      isShiftPressed,
      lastAutoAddedPoint,
      setHoveredVertex,
      setTempPoints,
      setLastAutoAddedPoint,
      setTransform,
      setInteractionState,
      updateFn
    );
  }, [
    editMode,
    interactionState,
    segmentationData,
    selectedPolygonId,
    tempPoints,
    transform,
    canvasRef,
    isShiftPressed,
    lastAutoAddedPoint,
    setHoveredVertex,
    setTempPoints,
    setLastAutoAddedPoint,
    setTransform,
    setInteractionState,
    setSegmentationDataWithHistory,
    updateSegmentationWithoutHistory
  ]);

  // Function to handle mouse up - includes adding to history after vertex dragging
  const onMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Pokud jsme táhli vertex, musíme po dokončení tahu přidat stav do historie pro undo/redo
    const wasDraggingVertex = interactionState.isDraggingVertex;
    
    handleMouseUp(
      e,
      interactionState,
      setInteractionState,
      segmentationData,
      setSegmentationDataWithHistory
    );
    
    // Po dokončení tahu vertexu přidáme explicitně stav do historie
    // tím zajistíme, že celý tah bude považován za jednu akci pro undo/redo
    if (wasDraggingVertex && segmentationData) {
      setSegmentationDataWithHistory({...segmentationData}, false);
    }
  }, [interactionState, segmentationData, setInteractionState, setSegmentationDataWithHistory]);

  // Function to handle wheel events for zooming
  const handleWheelEvent = useCallback((e: WheelEvent) => {
    handleWheel(
      e,
      transform,
      canvasRef,
      setTransform
    );
  }, [transform, canvasRef, setTransform]);

  // Set up wheel event listener for zooming with debounce for performance
  useEffect(() => {
    // Throttle function to limit how often we process wheel events
    let lastWheelTimestamp = 0;
    const throttleDelay = 10; // 10ms throttling for smoother performance
    
    const wheelEventHandler = (e: WheelEvent) => {
      const now = performance.now();
      
      // Throttle events for smoother performance, especially on trackpads
      if (now - lastWheelTimestamp < throttleDelay) {
        e.preventDefault();
        return;
      }
      
      lastWheelTimestamp = now;
      handleWheelEvent(e);
    };

    const canvasElement = canvasRef.current;
    if (canvasElement) {
      canvasElement.addEventListener('wheel', wheelEventHandler, { passive: false });
    }

    return () => {
      if (canvasElement) {
        canvasElement.removeEventListener('wheel', wheelEventHandler);
      }
    };
  }, [transform, canvasRef, handleWheelEvent]);

  // setSegmentationDataWithHistory, undo, and redo are now provided by useUndoRedo

  // Slicing functionality moved to useSlicing hook

  // Function to handle resegmentation
  const handleResegment = useCallback(async () => {
    if (!segmentationData || !imageData || !imageIdRef.current) {
      console.error("Cannot resegment: No segmentation data or image data");
      toast.error(t('segmentation.resegmentError') || 'Failed to resegment image');
      return;
    }

    try {
      setIsResegmenting(true);
      console.log("[useSegmentationV2] Requesting resegmentation for image:", imageIdRef.current);

      toast.info('Spouštím opětovnou segmentaci pomocí neuronové sítě ResUNet...');

      // Použijeme stejný endpoint a parametry jako v ImageCard
      await apiClient.post(`/images/segmentation/trigger-batch`, {
        imageIds: [imageIdRef.current],
        priority: 5, // Vysoká priorita pro re-trigger
        model_type: 'resunet' // Explicitně specifikujeme model
      });

      toast.success('Úloha opětovné segmentace pomocí neuronové sítě byla úspěšně zařazena.');

      // Neukončujeme isResegmenting stav - tlačítko zůstane v režimu načítání
      // Místo toho budeme čekat na notifikaci o dokončení segmentace

      // Poll for updated segmentation data
      const POLLING_INTERVAL_MS = 5000;
      const MAX_POLLING_ATTEMPTS = 60;
      let attempts = 0;

      const pollForUpdates = async () => {
        if (attempts >= MAX_POLLING_ATTEMPTS) {
          console.log("[useSegmentationV2] Max polling attempts reached");
          setIsResegmenting(false);
          toast.error(t('segmentationPage.resegmentationTimeout') || 'Resegmentation timed out. Please check the queue status.');
          return;
        }

        attempts++;
        console.log(`[useSegmentationV2] Polling for updated segmentation (attempt ${attempts}/${MAX_POLLING_ATTEMPTS})`);

        try {
          // Nejprve zkontrolujeme stav obrázku
          const segmentationResponse = await apiClient.get(`/images/${imageIdRef.current}/segmentation`);
          const segmentationStatus = segmentationResponse.data?.status;

          console.log(`[useSegmentationV2] Current segmentation status: ${segmentationStatus}`);

          if (segmentationStatus === 'completed') {
            console.log("[useSegmentationV2] Image segmentation completed, fetching updated data");

            // Načteme aktualizovaná segmentační data
            const refreshedSegmentation = segmentationResponse.data;

            // Update the segmentation data
            setSegmentationDataWithHistory(refreshedSegmentation, true);
            setIsResegmenting(false);

            toast.success(t('segmentationPage.resegmentationCompleted') || 'Resegmentation completed successfully.');
            return;
          } else if (segmentationStatus === 'failed') {
            console.log("[useSegmentationV2] Image segmentation failed");
            setIsResegmenting(false);
            toast.error(t('segmentationPage.resegmentationFailed') || 'Resegmentation failed.');
            return;
          }

          // Pokud segmentace stále probíhá, pokračujeme v pollování
          setTimeout(pollForUpdates, POLLING_INTERVAL_MS);
        } catch (error) {
          console.error("[useSegmentationV2] Error polling for updated segmentation:", error);
          // Pokračujeme v pollování i při chybě
          setTimeout(pollForUpdates, POLLING_INTERVAL_MS);
        }
      };

      // Start polling after a short delay
      setTimeout(pollForUpdates, POLLING_INTERVAL_MS);

    } catch (error) {
      console.error("[useSegmentationV2] Error requesting resegmentation:", error);
      toast.error(t('segmentation.resegmentError') || 'Failed to resegment image');
      setIsResegmenting(false);
    }
  }, [
    segmentationData,
    imageData,
    t,
    // imageIdRef.current is excluded as it's a ref
    setSegmentationDataWithHistory,
    setIsResegmenting
  ]);

  // Function to save segmentation data
  const handleSave = useCallback(async () => {
    if (!segmentationData || !imageData || !imageIdRef.current) {
      toast.error(t('segmentation.noDataToSave') || 'No data to save');
      return;
    }

    try {
      setIsLoading(true);

      // Get the actual ID to use for saving
      const saveId = imageData.actualId || imageIdRef.current;

      // Save segmentation data
      await saveSegmentationData(projectId, imageIdRef.current, imageData.actualId, segmentationData);

      toast.success(t('segmentation.saveSuccess') || 'Segmentation saved successfully');
      console.log("[useSegmentationV2] Save successful.");

      // Update the current segmentation data without resetting history
      // This preserves the current zoom and translation
      try {
        const refreshedSegmentation = await fetchSegmentationData(saveId);
        console.log("Refreshed segmentation data after save:", refreshedSegmentation);

        // Update the segmentation data but preserve history
        // This ensures we don't lose the current view state
        if (refreshedSegmentation) {
          // Only update the polygons, not the entire segmentation data
          setSegmentationDataWithHistory({
            ...segmentationData,
            polygons: refreshedSegmentation.polygons,
            // Keep other properties from the current segmentation data
            updated_at: refreshedSegmentation.updated_at
          }, false); // Don't reset history
        }
      } catch (refreshError) {
        console.error("Error refreshing segmentation data after save:", refreshError);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error saving segmentation data:", error);
      toast.error(t('segmentation.saveError') || 'Failed to save segmentation');
      setIsLoading(false);
    }
  }, [
    segmentationData,
    imageData,
    projectId,
    t,
    setSegmentationDataWithHistory,
    setIsLoading
  ]);

  // Return all the necessary state and functions
  return {
    // State
    segmentationData,
    imageData,
    isLoading,
    isSaving,
    isResegmenting,
    error,
    editMode,
    selectedPolygonId,
    hoveredVertex,
    tempPoints,
    transform,
    interactionState,
    isShiftPressed,
    canUndo,
    canRedo,

    // Functions
    setEditMode,
    setSelectedPolygonId,
    setHoveredVertex,
    setTempPoints,
    setInteractionState,
    setTransform,
    setSegmentationDataWithHistory,
    updateSegmentationWithoutHistory, // Přidáno pro potřeby přímé manipulace bez historie
    handleSave,
    handleResegment,
    undo,
    redo,

    // Event handlers
    onMouseDown,
    onMouseMove,
    onMouseUp,
    handleWheel: handleWheelEvent,

    // Canvas coordinates helper - directly use the imported function
    getCanvasCoordinates: (mouseX: number, mouseY: number) =>
      getCanvasCoordinates(mouseX, mouseY, transform, canvasRef)
  };
};
