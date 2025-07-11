import { useState, useRef, useEffect, useCallback, RefObject } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { TFunction } from 'i18next';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import apiClient from '@/lib/apiClient';
import { createNamespacedLogger } from '@/utils/logger';

// Create a logger for this module
const logger = createNamespacedLogger('useSegmentationV2');

import { EditMode, InteractionState, Point, SegmentationData, TransformState, ImageData } from './types';
import { MIN_ZOOM, MAX_ZOOM } from './constants';
import { fetchImageData, fetchSegmentationData, createEmptySegmentation, saveSegmentationData } from './api';
import { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleDeletePolygon } from './interactions';
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
  t: TFunction,
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
    canRedo,
    startDragging,
    updateDuringDrag,
    finishDragging,
    cancelDragging,
    isDragging,
  } = useUndoRedo<SegmentationData | null>(null);

  // Use segmentation cache
  const { getFromCache, addToCache, removeFromCache, getCacheStats } = useSegmentationCache();

  // State for editor
  const [editMode, setEditModeInternal] = useState<EditMode>(EditMode.View);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<{
    polygonId: string;
    vertexIndex: number;
  } | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [lastAutoAddedPoint, setLastAutoAddedPoint] = useState<Point | null>(null);

  // Wrapper for setEditMode that resets state when mode changes
  const setEditMode = useCallback(
    (newMode: EditMode) => {
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
          isAddingPoints: false,
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
    },
    [editMode],
  );

  // State for transform (pan/zoom)
  const [transform, setTransform] = useState<TransformState>({
    zoom: 1,
    translateX: 0,
    translateY: 0,
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
    isAddingPoints: false,
  });

  // State for keyboard modifiers
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  // Refs
  const imageIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const backgroundRefreshControllerRef = useRef<AbortController | null>(null);
  const hasFetchedRef = useRef<Set<string>>(new Set());
  const isSavingRef = useRef<boolean>(false);

  // Refs for frequently changing values to prevent re-render loops
  const segmentationDataRef = useRef<SegmentationData | null>(segmentationData);
  const interactionStateRef = useRef<InteractionState>(interactionState);
  const transformRef = useRef<TransformState>(transform);
  const fetchDataRef = useRef<() => Promise<void>>();

  // Update refs when state changes
  useEffect(() => {
    segmentationDataRef.current = segmentationData;
  }, [segmentationData]);

  useEffect(() => {
    interactionStateRef.current = interactionState;
  }, [interactionState]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

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
      // Commented out to prevent update loops
      // if (segmentationData && segmentationData.image_id === segmentationId) {
      //   console.log(`[useSegmentationV2] Updating current segmentation with refreshed data`);
      //   setSegmentationDataWithHistory(refreshedSegmentation, true);
      // }
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

    // Clear the fetch tracker to allow fetching the new image
    hasFetchedRef.current.clear();

    // Abort any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    console.log(`[useSegmentationV2] Reset state for new image: ${initialImageId}`);
  }, [initialImageId, setSegmentationDataWithHistory]);

  // Define fetchData as a useCallback at the top level of the hook
  const fetchData = useCallback(async () => {
    // Use a flag to track if the component is still mounted within this callback
    const isMounted = true; // This flag is local to the useCallback scope

    // Ensure projectId and imageIdRef.current are not null/undefined before proceeding
    if (!projectId || !imageIdRef.current) {
      setIsLoading(false);
      return;
    }

    // Skip fetching if we're currently saving
    if (isSavingRef.current) {
      logger.debug(`Currently saving, skipping fetch for ${imageIdRef.current}`);
      return;
    }

    // Check if we already have data loaded
    if (imageData && imageData.id === imageIdRef.current && segmentationData) {
      logger.debug(`Data already loaded for ${imageIdRef.current}, skipping fetch`);
      return;
    }

    // Check if we've already fetched this image ID recently
    const fetchKey = `${projectId}-${imageIdRef.current}`;
    if (hasFetchedRef.current.has(fetchKey)) {
      logger.debug(`Already fetching/fetched data for ${fetchKey}, skipping duplicate request`);
      return;
    }

    // Mark this fetch as in progress
    hasFetchedRef.current.add(fetchKey);

    // Create a new abort controller for this fetch operation
    const controller = new AbortController();
    abortControllerRef.current = controller; // Store it in the ref for cleanup
    const signal = controller.signal;

    try {
      setIsLoading(true);
      setError(null);

      logger.debug(`Fetching data for Project: ${projectId}, Image: ${imageIdRef.current}`);

      // Log cache stats
      const cacheStats = getCacheStats();
      logger.debug(`Cache stats: ${cacheStats.size} items cached`);

      // Fetch image data
      const fetchedImageData = await fetchImageData(projectId, imageIdRef.current, signal);

      // Check if component is still mounted before updating state
      if (!isMounted) return;

      // Handle ID mismatch between requested and actual image
      if (imageIdRef.current !== fetchedImageData.id) {
        logger.warn(`Found different image ID: ${fetchedImageData.id} (requested: ${imageIdRef.current})`);
        // Store the actual ID for segmentation fetching
        fetchedImageData.actualId = fetchedImageData.id;
      }

      // Set image data
      setImageData(fetchedImageData);
      logger.debug(`Fetched Image Data:`, fetchedImageData);

      // Fetch segmentation data using the actual ID if available
      const segmentationId = fetchedImageData.actualId || imageIdRef.current;

      // Try to get segmentation data from cache first
      const cachedSegmentation = getFromCache(segmentationId);

      if (cachedSegmentation) {
        // Use cached segmentation data
        logger.debug(`Using cached segmentation data for: ${segmentationId}`);
        setSegmentationDataWithHistory(cachedSegmentation, true);
        setIsLoading(false);

        // Disable background refresh for now to prevent repeated loading
        // TODO: Implement proper background refresh with proper debouncing
        // setTimeout(() => {
        //   refreshSegmentationInBackground(segmentationId);
        // }, 2000);

        return;
      }

      logger.debug(`No cached data, fetching segmentation from API: ${segmentationId}`);

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
        const fetchedSegmentation = (await Promise.race([
          fetchSegmentationPromise,
          timeoutPromise,
        ])) as SegmentationData;

        // Check if component is still mounted before updating state
        if (!isMounted) return;

        logger.debug('Received segmentation data:', fetchedSegmentation);

        // Add to cache
        addToCache(segmentationId, fetchedSegmentation);

        // Set segmentation data with history (true = overwrite history)
        setSegmentationDataWithHistory(fetchedSegmentation, true);
        logger.debug(`Fetched Segmentation Data:`, fetchedSegmentation);
      } catch (segError) {
        // Check if component is still mounted before updating state
        if (!isMounted) return;

        logger.error('Error fetching segmentation data:', segError);

        // Log detailed error information
        logger.error(`Error fetching segmentation data for imageId=${segmentationId}`, {
          error: segError,
          projectId,
          imageId: segmentationId,
        });

        // Create empty segmentation data and reset history
        const emptySegmentation = createEmptySegmentation(segmentationId);

        // Add empty segmentation to cache
        addToCache(segmentationId, emptySegmentation);

        setSegmentationDataWithHistory(emptySegmentation, true);
        logger.debug(`Created empty segmentation data for: ${segmentationId}`);
      }

      // Center the image in the canvas
      if (canvasRef.current && fetchedImageData.width && fetchedImageData.height) {
        const canvasWidth = canvasRef.current.clientWidth;
        const canvasHeight = canvasRef.current.clientHeight;

        const newTransform = calculateCenteringTransform(
          fetchedImageData.width,
          fetchedImageData.height,
          canvasWidth,
          canvasHeight,
        );

        setTransform(newTransform);
      }

      setIsLoading(false);

      // Clear the fetch key after successful completion
      setTimeout(() => {
        hasFetchedRef.current.delete(fetchKey);
      }, 5000); // Keep it for 5 seconds to prevent rapid re-fetches
    } catch (error: any) {
      // Explicitly type error as any for now
      // Check if component is still mounted before updating state
      if (!isMounted) return;

      // Clear the fetch key on error too
      hasFetchedRef.current.delete(fetchKey);

      logger.error('Error fetching data:', error);

      // Check if this is a cancellation error (which we can ignore)
      const isCancelled = error.name === 'AbortError' || (error.message && error.message.includes('cancel'));

      if (!isCancelled) {
        setError('Failed to load image data');

        // Nepokračovat, pokud data nelze načíst
        // Místo vytváření prázdného obrázku oznámit chybu
        toast.error('Nepodařilo se načíst data obrázku. Zkuste to znovu nebo kontaktujte správce systému.');

        // Nastavit loading na false, ale nechat imageData jako null
        setImageData(null);

        // Create empty segmentation
        const emptySegmentation = createEmptySegmentation(imageIdRef.current || 'unknown');
        setSegmentationDataWithHistory(emptySegmentation, true);
      } else {
        logger.info('Request was cancelled, ignoring error');
      }

      setIsLoading(false);
    }
  }, [projectId, addToCache, getFromCache, imageData, segmentationData]); // Added imageData and segmentationData for proper checks

  // Update fetchData ref when fetchData changes
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Fetch data when projectId or initialImageId changes
  useEffect(() => {
    // Use a flag to track if the component is still mounted for the useEffect cleanup
    let isMounted = true;

    // Skip if no project ID or image ID
    if (!projectId || !initialImageId) {
      // Use initialImageId directly here
      setIsLoading(false);
      return () => {
        isMounted = false;
      }; // Cleanup for this case
    }

    // Store the requested ID in the ref
    imageIdRef.current = initialImageId;

    // Start the fetch with a small delay to avoid race conditions
    // This will call the `fetchData` useCallback function
    const timeoutId = setTimeout(() => {
      if (isMounted && fetchDataRef.current) {
        // Only call fetchData if component is mounted
        fetchDataRef.current();
      }
    }, 50);

    // Cleanup function for this useEffect
    return () => {
      isMounted = false; // Mark as unmounted
      clearTimeout(timeoutId);

      // Abort any ongoing fetch that was started by this useEffect
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Abort any ongoing background refresh
      if (backgroundRefreshControllerRef.current) {
        backgroundRefreshControllerRef.current.abort();
        backgroundRefreshControllerRef.current = null;
      }
    };
  }, [projectId, initialImageId]); // Removed fetchData to prevent re-renders on edit mode changes

  // Set up keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Shift key for equidistant point placement
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }

      // Command/Control + key shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case 's':
            e.preventDefault();
            // Trigger save via custom event to avoid dependency issues
            window.dispatchEvent(new Event('segmentation-save'));
            break;
          case '+':
          case '=':
            e.preventDefault();
            setTransform((prev) => ({
              ...prev,
              zoom: Math.min(prev.zoom * 1.2, 10), // Max zoom 10x
            }));
            break;
          case '-':
            e.preventDefault();
            setTransform((prev) => ({
              ...prev,
              zoom: Math.max(prev.zoom / 1.2, 0.1), // Min zoom 0.1x
            }));
            break;
          case '0':
            e.preventDefault();
            // Reset view - need image data for this
            if (imageData && canvasRef.current) {
              const canvasRect = canvasRef.current.getBoundingClientRect();
              const initialZoom = Math.min(canvasRect.width / imageData.width, canvasRect.height / imageData.height);
              const tx = canvasRect.width / 2 - (imageData.width / 2) * initialZoom;
              const ty = canvasRect.height / 2 - (imageData.height / 2) * initialZoom;
              setTransform({
                zoom: initialZoom,
                translateX: tx,
                translateY: ty,
              });
            }
            break;
        }
        return;
      }

      // Single key shortcuts with toggle behavior
      switch (e.key.toLowerCase()) {
        case 'v':
          setEditMode(EditMode.View);
          setTempPoints([]);
          break;
        case 'e':
          setEditMode(editMode === EditMode.EditVertices ? EditMode.View : EditMode.EditVertices);
          if (editMode === EditMode.EditVertices) setTempPoints([]);
          break;
        case 'a':
          setEditMode(editMode === EditMode.AddPoints ? EditMode.View : EditMode.AddPoints);
          if (editMode === EditMode.AddPoints) setTempPoints([]);
          break;
        case 'n':
          setEditMode(editMode === EditMode.CreatePolygon ? EditMode.View : EditMode.CreatePolygon);
          if (editMode === EditMode.CreatePolygon) setTempPoints([]);
          break;
        case 's':
          setEditMode(editMode === EditMode.Slice ? EditMode.View : EditMode.Slice);
          if (editMode === EditMode.Slice) setTempPoints([]);
          break;
        case 'd':
          setEditMode(editMode === EditMode.DeletePolygon ? EditMode.View : EditMode.DeletePolygon);
          if (editMode === EditMode.DeletePolygon) setTempPoints([]);
          break;
        case 'delete':
          if (selectedPolygonId) {
            handleDeletePolygon(
              selectedPolygonId,
              segmentationData,
              setSelectedPolygonId,
              setSegmentationDataWithHistory,
            );
          }
          break;
        case 'escape':
          // Reset to view mode
          if (editMode !== EditMode.View) {
            setEditMode(EditMode.View);
            setTempPoints([]);
          }
          break;
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
    setLastAutoAddedPoint,
    setTransform,
    imageData,
    canvasRef,
  ]);

  // Listen for real-time segmentation status updates
  useEffect(() => {
    const handleSegmentationStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        imageId: string;
        status: string;
        error?: string;
        resultPath?: string;
      }>;

      const { imageId, status } = customEvent.detail;

      // Check if this update is for our current image
      if (imageId === imageIdRef.current && segmentationData) {
        console.log(`[useSegmentationV2] Received status update for current image: ${status}`);

        // Update the segmentation status
        setSegmentationDataWithHistory(
          {
            ...segmentationData,
            status: status,
          },
          false,
        );

        // If status is completed or failed, and we're resegmenting, stop the spinner
        if ((status === 'completed' || status === 'failed') && isResegmenting) {
          setIsResegmenting(false);

          if (status === 'completed') {
            // Fetch the updated segmentation data
            fetchDataRef.current?.();
            toast.success(t('segmentationPage.resegmentationCompleted') || 'Resegmentation completed successfully.');
          } else if (status === 'failed') {
            toast.error(t('segmentationPage.resegmentationFailed') || 'Resegmentation failed.');
          }
        }
      }
    };

    // Listen for the event
    window.addEventListener('image-status-update', handleSegmentationStatusUpdate);

    return () => {
      window.removeEventListener('image-status-update', handleSegmentationStatusUpdate);
    };
  }, [segmentationData, imageIdRef.current, isResegmenting, setSegmentationDataWithHistory, t]);

  // Function to handle mouse down
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
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
        setSegmentationDataWithHistory,
        startDragging,
      );
    },
    [
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
      setSegmentationDataWithHistory,
      startDragging,
    ],
  );

  // Function to handle mouse move - optimized to prevent re-render loops
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Use refs for frequently changing values to prevent callback recreation
      const currentSegmentationData = segmentationDataRef.current;
      const currentInteractionState = interactionStateRef.current;
      const currentTransform = transformRef.current;

      // If we're dragging a vertex, use updateDuringDrag for the new dragging system
      // Otherwise use setSegmentationDataWithHistory for normal operations
      const updateFn = currentInteractionState.isDraggingVertex ? updateDuringDrag : setSegmentationDataWithHistory;

      // Call the main mouse move handler with current values from refs
      handleMouseMove(
        e,
        editMode,
        currentInteractionState,
        currentSegmentationData,
        selectedPolygonId,
        tempPoints,
        currentTransform,
        canvasRef,
        isShiftPressed,
        lastAutoAddedPoint,
        setHoveredVertex,
        setTempPoints,
        setLastAutoAddedPoint,
        setTransform,
        setInteractionState,
        updateFn,
        updateDuringDrag,
      );
    },
    [
      // Only include stable dependencies that don't change frequently
      editMode,
      selectedPolygonId,
      tempPoints,
      canvasRef,
      isShiftPressed,
      lastAutoAddedPoint,
      setHoveredVertex,
      setTempPoints,
      setLastAutoAddedPoint,
      setTransform,
      setInteractionState,
      setSegmentationDataWithHistory,
      updateDuringDrag,
    ],
  );

  // Function to handle mouse up - includes adding to history after vertex dragging
  const onMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // If we were dragging a vertex, we need to add the state to history for undo/redo
      const wasDraggingVertex = interactionState.isDraggingVertex;
      const vertexInfo = interactionState.draggedVertexInfo; // Capture the vertex info before resetting
      const originalPosition = interactionState.originalVertexPosition; // Capture the original position before resetting

      // First reset the drag state to stop the dragging
      handleMouseUp(
        e,
        interactionState,
        setInteractionState,
        segmentationData,
        setSegmentationDataWithHistory,
        finishDragging,
      );

      // The dragging system now handles history management properly
      // No need for additional history management here

      // Finally, fully clear the drag state including originalVertexPosition
      setInteractionState((prevState) => ({
        ...prevState,
        draggedVertexInfo: null,
        originalVertexPosition: null,
      }));
    },
    [interactionState, segmentationData, setInteractionState, setSegmentationDataWithHistory, finishDragging],
  );

  // Function to handle wheel events for zooming
  const handleWheelEvent = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      // Changed type to React.WheelEvent<HTMLDivElement>
      handleWheel(e, transform, canvasRef, setTransform);
    },
    [transform, canvasRef, setTransform],
  );

  // Set up wheel event listener for zooming with debounce for performance
  useEffect(() => {
    // Throttle function to limit how often we process wheel events
    let lastWheelTimestamp = 0;
    const throttleDelay = 10; // 10ms throttling for smoother performance

    const wheelEventHandler = (e: React.WheelEvent<HTMLDivElement>) => {
      // Changed type to React.WheelEvent<HTMLDivElement>
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
      canvasElement.addEventListener('wheel', wheelEventHandler, {
        passive: false,
      });
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
      console.error('Cannot resegment: No segmentation data or image data');
      toast.error(t('segmentation.resegmentError') || 'Failed to resegment image');
      return;
    }

    try {
      setIsResegmenting(true);
      console.log('[useSegmentationV2] Requesting resegmentation for image:', imageIdRef.current);

      toast.info(t('segmentation.startingResegmentation') || 'Starting resegmentation with ResUNet neural network...');

      // Use the dedicated resegment endpoint that deletes old data
      await apiClient.post(`/api/segmentation/${imageIdRef.current}/resegment`, {
        project_id: projectId,
      });

      toast.success(t('segmentation.resegmentQueued') || 'Resegmentation task has been queued successfully.');

      // Update the segmentation status to 'queued' immediately
      if (segmentationData) {
        setSegmentationDataWithHistory(
          {
            ...segmentationData,
            status: 'queued',
          },
          false,
        );
      }

      // Listen for status updates via WebSocket or polling
      // The isResegmenting state will remain true until we receive a completion status

      // Start polling for status updates
      const POLLING_INTERVAL_MS = 3000;
      const MAX_POLLING_ATTEMPTS = 100;
      let attempts = 0;

      const pollForUpdates = async () => {
        if (attempts >= MAX_POLLING_ATTEMPTS) {
          console.log('[useSegmentationV2] Max polling attempts reached');
          setIsResegmenting(false);
          toast.error(
            t('segmentationPage.resegmentationTimeout') || 'Resegmentation timed out. Please check the queue status.',
          );
          return;
        }

        attempts++;
        console.log(
          `[useSegmentationV2] Polling for updated segmentation (attempt ${attempts}/${MAX_POLLING_ATTEMPTS})`,
        );

        try {
          // Check the segmentation status
          const segmentationResponse = await apiClient.get(`/api/images/${imageIdRef.current}/segmentation`);
          const segmentationStatus = segmentationResponse.data?.status;

          console.log(`[useSegmentationV2] Current segmentation status: ${segmentationStatus}`);

          // Update the status in UI
          if (segmentationData && segmentationStatus !== segmentationData.status) {
            setSegmentationDataWithHistory(
              {
                ...segmentationData,
                status: segmentationStatus,
              },
              false,
            );
          }

          if (segmentationStatus === 'completed') {
            console.log('[useSegmentationV2] Image segmentation completed, fetching updated data');

            // Fetch the complete updated segmentation data
            const refreshedSegmentation = segmentationResponse.data;

            // Update the segmentation data
            setSegmentationDataWithHistory(refreshedSegmentation, true);
            setIsResegmenting(false);

            toast.success(t('segmentationPage.resegmentationCompleted') || 'Resegmentation completed successfully.');
            return;
          } else if (segmentationStatus === 'failed') {
            console.log('[useSegmentationV2] Image segmentation failed');
            setIsResegmenting(false);
            toast.error(t('segmentationPage.resegmentationFailed') || 'Resegmentation failed.');
            return;
          }

          // Continue polling if status is 'queued' or 'processing'
          setTimeout(pollForUpdates, POLLING_INTERVAL_MS);
        } catch (error) {
          console.error('[useSegmentationV2] Error polling for updated segmentation:', error);
          // On error, stop polling and reset state
          console.log('[useSegmentationV2] Resetting resegmenting state due to error');
          setIsResegmenting(false);
          toast.error(t('segmentation.resegmentError') || 'Failed to check segmentation status');
        }
      };

      // Start polling after a short delay
      setTimeout(pollForUpdates, POLLING_INTERVAL_MS);
    } catch (error) {
      console.error('[useSegmentationV2] Error requesting resegmentation:', error);
      toast.error(t('segmentation.resegmentError') || 'Failed to resegment image');
      setIsResegmenting(false);
    }
  }, [
    segmentationData,
    imageData,
    projectId,
    t,
    // imageIdRef.current is excluded as it's a ref
    setSegmentationDataWithHistory,
    setIsResegmenting,
  ]);

  // Function to save segmentation data
  const handleSave = useCallback(async () => {
    if (!segmentationData || !imageData || !imageIdRef.current) {
      toast.error(t('segmentation.noDataToSave') || 'No data to save');
      return;
    }

    try {
      setIsLoading(true);
      isSavingRef.current = true;

      // Get the actual ID to use for saving
      const saveId = imageData.actualId || imageIdRef.current;

      // Save segmentation data
      await saveSegmentationData(projectId, imageIdRef.current, imageData.actualId, segmentationData);

      toast.success(t('segmentation.saveSuccess') || 'Segmentation saved successfully');
      console.log('[useSegmentationV2] Save successful.');

      // Don't refresh data after save to prevent canvas reload
      // The data is already up to date in the frontend
      // Commented out to prevent unnecessary canvas refresh
      /*
      try {
        const refreshedSegmentation = await fetchSegmentationData(saveId);
        console.log('Refreshed segmentation data after save:', refreshedSegmentation);

        // Update the segmentation data but preserve history
        // This ensures we don't lose the current view state
        if (refreshedSegmentation) {
          // Only update the polygons, not the entire segmentation data
          setSegmentationDataWithHistory(
            {
              ...segmentationData,
              polygons: refreshedSegmentation.polygons,
              // Keep other properties from the current segmentation data
              updated_at: refreshedSegmentation.updated_at,
            },
            false,
          ); // Don't reset history
        }
      } catch (refreshError) {
        console.error('Error refreshing segmentation data after save:', refreshError);
      }
      */

      setIsLoading(false);
      isSavingRef.current = false;
    } catch (error) {
      console.error('Error saving segmentation data:', error);
      toast.error(t('segmentation.saveError') || 'Failed to save segmentation');
      setIsLoading(false);
      isSavingRef.current = false;
    }
  }, [segmentationData, imageData, projectId, t, setSegmentationDataWithHistory]);

  // Listen for save events triggered by keyboard shortcuts
  useEffect(() => {
    const handleSaveEvent = () => {
      handleSave();
    };

    window.addEventListener('segmentation-save', handleSaveEvent);

    return () => {
      window.removeEventListener('segmentation-save', handleSaveEvent);
    };
  }, [handleSave]);

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
    fetchData,

    // Event handlers
    onMouseDown,
    onMouseMove,
    onMouseUp,
    handleWheelEvent, // Ensure handleWheelEvent is returned

    // Canvas coordinates helper - directly use the imported function
    getCanvasCoordinates: (mouseX: number, mouseY: number) =>
      getCanvasCoordinates(mouseX, mouseY, transform, canvasRef),
  };
};
