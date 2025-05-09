import { useState, useRef, useEffect, useCallback, RefObject } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { TFunction } from 'i18next';

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
import { loadImageDirectly } from '../../utils/directImageLoader';
import {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  handleDeletePolygon
} from './interactions';
import { calculateCenteringTransform, getCanvasCoordinates } from './coordinates';
import { slicePolygon } from './geometry';

/**
 * Main hook for segmentation editor
 */
export const useSegmentationV2 = (
  projectId: string,
  initialImageId: string | null,
  canvasRef: RefObject<HTMLDivElement>,
  t: TFunction
) => {

  // State for segmentation data
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for editor
  const [editMode, setEditMode] = useState<EditMode>(EditMode.View);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<{ polygonId: string; vertexIndex: number } | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [lastAutoAddedPoint, setLastAutoAddedPoint] = useState<Point | null>(null);

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
    sliceStartPoint: null
  });

  // State for keyboard modifiers
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  // State for undo/redo
  const [history, setHistory] = useState<SegmentationData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Refs
  const imageIdRef = useRef<string | null>(null);
  const fetchAttemptedRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Function to update segmentation data with history
  const setSegmentationDataWithHistory = useCallback((data: SegmentationData | null, clearHistory: boolean) => {
    setSegmentationData(data);

    if (clearHistory) {
      // Reset history when loading new data
      setHistory(data ? [data] : []);
      setHistoryIndex(0);
    } else if (data) {
      // Add to history when making changes
      setHistory(prev => {
        // Remove any future history if we're not at the end
        const newHistory = prev.slice(0, historyIndex + 1);
        return [...newHistory, data];
      });
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex]);

  // Function to handle undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSegmentationData(history[newIndex]);
    }
  }, [history, historyIndex]);

  // Function to handle redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSegmentationData(history[newIndex]);
    }
  }, [history, historyIndex]);

  // Create a ref to track previous initialImageId to prevent unnecessary updates
  const prevInitialImageIdRef = useRef<string | null>(null);

  // Use a ref to track if we've already fetched data for this image
  const hasFetchedDataRef = useRef<boolean>(false);

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

    // Reset fetch attempt flag when imageId changes
    fetchAttemptedRef.current = false;

    // Reset lastFetchTimeRef to ensure we fetch the new image
    lastFetchTimeRef.current = 0;

    // Reset hasFetchedDataRef to ensure we fetch data for the new image
    hasFetchedDataRef.current = false;

    // Reset state when image changes
    setSelectedPolygonId(null);
    setTempPoints([]);
    setEditMode(EditMode.View);

    // Clear image data to avoid showing old image while loading
    setImageData(null);

    // Clear segmentation data to avoid showing old data while loading
    setSegmentationDataWithHistory(null, true);

    console.log(`[useSegmentationV2] Reset state for new image: ${initialImageId}`);
  }, [initialImageId, setSegmentationDataWithHistory]);

  // Fetch data when imageIdRef changes
  useEffect(() => {
    // Skip if no project ID or image ID
    if (!projectId || !imageIdRef.current) {
      setIsLoading(false);
      return;
    }

    // Skip if we've already fetched data for this image
    if (hasFetchedDataRef.current) {
      console.log(`[useSegmentationV2] Already fetched data for ${imageIdRef.current}, skipping`);
      return;
    }

    // Mark that we're fetching data for this image
    hasFetchedDataRef.current = true;

    console.log(`[useSegmentationV2] Starting to fetch data for image: ${imageIdRef.current}`);
    toast.info(`Načítání obrázku: ${imageIdRef.current}`);

    // Set a global timeout for the entire loading process
    const globalTimeoutId = setTimeout(() => {
      if (isLoading) {
        console.error(`[useSegmentationV2] Loading timeout after 30 seconds for image: ${imageIdRef.current}`);
        toast.error("Načítání trvá příliš dlouho. Zkuste to znovu nebo vyberte jiný obrázek.");
        setError("Loading timeout after 30 seconds");
        setIsLoading(false);

        // Reset the fetch flag so we can try again
        hasFetchedDataRef.current = false;
      }
    }, 30000); // 30 second timeout

    // Set a timeout to prevent immediate fetch to avoid race conditions
    const timeoutId = setTimeout(async () => {
      // Cancel any ongoing fetch
      if (abortControllerRef.current) {
        console.log(`[useSegmentationV2] Aborting previous fetch request`);
        abortControllerRef.current.abort();
      }

      // Create a new abort controller
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        setIsLoading(true);
        setError(null);

        console.log(`[useSegmentationV2] Fetching data for Project: ${projectId}, Image: ${imageIdRef.current}`);

        // Fetch image data with retry logic
        let fetchedImageData;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            fetchedImageData = await fetchImageData(projectId, imageIdRef.current, signal);
            break; // Success, exit the retry loop
          } catch (fetchError) {
            retryCount++;
            console.warn(`[useSegmentationV2] Fetch attempt ${retryCount} failed:`, fetchError);

            if (retryCount >= maxRetries) {
              throw fetchError; // Re-throw after max retries
            }

            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        }

        // Handle ID mismatch between requested and actual image
        if (imageIdRef.current !== fetchedImageData.id) {
          console.log(`[useSegmentationV2] Found different image ID: ${fetchedImageData.id} (requested: ${imageIdRef.current})`);

          // Store the actual ID for segmentation fetching
          fetchedImageData.actualId = fetchedImageData.id;

          // We'll continue with the current fetch using the actual ID
          // But we won't update imageIdRef.current to avoid triggering another fetch
        }

        // Set image data
        setImageData(fetchedImageData);
        console.log(`[useSegmentationV2] Fetched Image Data:`, fetchedImageData);

        // Fetch segmentation data using the actual ID if available
        const segmentationId = fetchedImageData.actualId || imageIdRef.current;
        console.log(`[useSegmentationV2] Fetching segmentation data for: ${segmentationId}`);

        try {
          const fetchedSegmentation = await fetchSegmentationData(segmentationId, signal, projectId);
          console.log("[useSegmentationV2] Received segmentation data:", fetchedSegmentation);

          // Set segmentation data with history
          setSegmentationDataWithHistory(fetchedSegmentation, true);
          console.log(`[useSegmentationV2] Fetched Segmentation Data:`, fetchedSegmentation);
        } catch (segError) {
          console.error("[useSegmentationV2] Error fetching segmentation data:", segError);

          // Create empty segmentation data
          const emptySegmentation = createEmptySegmentation(segmentationId);
          setSegmentationDataWithHistory(emptySegmentation, true);
          console.log(`[useSegmentationV2] Created empty segmentation data for: ${segmentationId}`);

          // Show a toast notification but don't treat as a fatal error
          toast.warning(t('segmentation.noSegmentationData') || 'No segmentation data found. You can create new segmentations.');
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
          console.log(`[useSegmentationV2] Set transform to center image: `, newTransform);
        } else {
          console.warn(`[useSegmentationV2] Could not center image - missing canvas or image dimensions`);
          if (!canvasRef.current) console.warn(`[useSegmentationV2] Canvas ref is null`);
          if (!fetchedImageData.width || !fetchedImageData.height) console.warn(`[useSegmentationV2] Image dimensions missing: ${fetchedImageData.width}x${fetchedImageData.height}`);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("[useSegmentationV2] Error fetching data:", error);

        // Check if this is a cancellation error (which we can ignore)
        const isCancelled = error.name === 'AbortError' ||
                           (error.message && error.message.includes('cancel'));

        if (!isCancelled) {
          // Try to load the image directly as a last resort
          console.log("[useSegmentationV2] Trying to load image directly from filesystem");
          toast.info("Pokus o přímé načtení obrázku ze serveru...");

          try {
            // Try to load the image directly
            const directImageResult = await loadImageDirectly(projectId, imageIdRef.current);

            if (directImageResult) {
              console.log("[useSegmentationV2] Successfully loaded image directly:", directImageResult);
              toast.success("Obrázek byl úspěšně načten přímo ze serveru");

              // Create image data from the direct load result
              const directImageData = {
                id: imageIdRef.current || 'unknown',
                name: imageIdRef.current || 'Direct Loaded Image',
                width: directImageResult.width,
                height: directImageResult.height,
                src: directImageResult.url,
                storage_path: directImageResult.url,
                project_id: projectId,
                user_id: 'unknown',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'completed'
              };

              // Set the image data
              setImageData(directImageData);

              // Create empty segmentation data
              const emptySegmentation = createEmptySegmentation(imageIdRef.current || 'unknown');
              setSegmentationDataWithHistory(emptySegmentation, true);

              // Center the image in the canvas
              if (canvasRef.current && directImageResult.width && directImageResult.height) {
                const canvasWidth = canvasRef.current.clientWidth;
                const canvasHeight = canvasRef.current.clientHeight;

                const newTransform = calculateCenteringTransform(
                  directImageResult.width,
                  directImageResult.height,
                  canvasWidth,
                  canvasHeight
                );

                setTransform(newTransform);
              }

              setIsLoading(false);
              return; // Exit early since we successfully loaded the image
            }
          } catch (directLoadError) {
            console.error("[useSegmentationV2] Error loading image directly:", directLoadError);
          }

          // If we get here, both API and direct loading failed

          // Set a more descriptive error message
          if (error instanceof Error) {
            setError(`Failed to load image: ${error.message}`);
            toast.error(`Failed to load image: ${error.message}`);
          } else {
            setError("Failed to load image data");
            toast.error("Failed to load image data");
          }

          // Reset the fetch flag so we can try again
          hasFetchedDataRef.current = false;

          // Create empty image and segmentation data to avoid UI errors
          const emptyImageData = {
            id: imageIdRef.current || 'unknown',
            name: 'Not Found',
            width: 800,
            height: 600,
            src: '/placeholder.png', // Use placeholder image instead of empty string
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

          console.log(`[useSegmentationV2] Created empty data for failed fetch`);
        } else {
          console.log("[useSegmentationV2] Request was cancelled, ignoring error");
        }

        setIsLoading(false);
      }
    }, 100); // Small delay to avoid race conditions

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(globalTimeoutId);
      if (abortControllerRef.current) {
        console.log(`[useSegmentationV2] Cleanup: Aborting fetch request`);
        abortControllerRef.current.abort();
      }
    };
  }, [projectId, initialImageId, t, canvasRef, setSegmentationDataWithHistory]);

  // Listen for manual image load events
  useEffect(() => {
    const handleManualImageLoad = (e: CustomEvent) => {
      console.log('[useSegmentationV2] Received manual image load event:', e.detail);

      if (e.detail && e.detail.width && e.detail.height && e.detail.src) {
        // Create image data from the event
        const manualImageData = {
          id: imageIdRef.current || 'manual-image',
          name: e.detail.name || 'Manually Loaded Image',
          width: e.detail.width,
          height: e.detail.height,
          src: e.detail.src,
          project_id: projectId,
          user_id: 'unknown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'completed'
        };

        // Set the image data
        setImageData(manualImageData);

        // Create empty segmentation data
        const emptySegmentation = createEmptySegmentation(imageIdRef.current || 'manual-image');
        setSegmentationDataWithHistory(emptySegmentation, true);

        // Center the image in the canvas
        if (canvasRef.current && e.detail.width && e.detail.height) {
          const canvasWidth = canvasRef.current.clientWidth;
          const canvasHeight = canvasRef.current.clientHeight;

          const newTransform = calculateCenteringTransform(
            e.detail.width,
            e.detail.height,
            canvasWidth,
            canvasHeight
          );

          setTransform(newTransform);
        }

        setIsLoading(false);
        setError(null);

        toast.success('Manually loaded image successfully');
      }
    };

    // Add event listener for manual image load
    document.addEventListener('manual-image-load', handleManualImageLoad as EventListener);

    return () => {
      document.removeEventListener('manual-image-load', handleManualImageLoad as EventListener);
    };
  }, [projectId, canvasRef, setSegmentationDataWithHistory]);

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
  }, [editMode, selectedPolygonId, segmentationData, undo, redo, setSegmentationDataWithHistory]);

  // Set up wheel event listener for zooming
  useEffect(() => {
    const handleWheelEvent = (e: WheelEvent) => {
      handleWheel(e, transform, canvasRef, setTransform);
    };

    const canvasElement = canvasRef.current;
    if (canvasElement) {
      canvasElement.addEventListener('wheel', handleWheelEvent, { passive: false });
    }

    return () => {
      if (canvasElement) {
        canvasElement.removeEventListener('wheel', handleWheelEvent);
      }
    };
  }, [transform, canvasRef]);

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
    setSegmentationDataWithHistory
  ]);

  // Function to handle mouse move
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
    isShiftPressed,
    lastAutoAddedPoint,
    setSegmentationDataWithHistory
  ]);

  // Function to handle mouse up
  const onMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleMouseUp(e, interactionState, setInteractionState);
  }, [interactionState]);

  // Function to handle slicing
  const handleSliceAction = useCallback(() => {
    if (!selectedPolygonId || tempPoints.length !== 2 || !segmentationData) return false;

    const polygon = segmentationData.polygons.find(p => p.id === selectedPolygonId);
    if (!polygon) return false;

    const result = slicePolygon(polygon, tempPoints[0], tempPoints[1]);

    if (result.success) {
      // Replace the original polygon with the two new ones
      const updatedPolygons = segmentationData.polygons.filter(p => p.id !== selectedPolygonId);
      updatedPolygons.push(...result.polygons);

      setSegmentationDataWithHistory({
        ...segmentationData,
        polygons: updatedPolygons
      }, false);

      // Reset state
      setTempPoints([]);
      setInteractionState(prev => ({
        ...prev,
        sliceStartPoint: null
      }));
      setSelectedPolygonId(null);

      return true;
    }

    return false;
  }, [selectedPolygonId, tempPoints, segmentationData, setSegmentationDataWithHistory]);

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

      // Refresh segmentation data after save
      try {
        const refreshedSegmentation = await fetchSegmentationData(saveId);
        console.log("Refreshed segmentation data after save:", refreshedSegmentation);
        setSegmentationDataWithHistory(refreshedSegmentation, true);
      } catch (refreshError) {
        console.error("Error refreshing segmentation data after save:", refreshError);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error saving segmentation data:", error);
      toast.error(t('segmentation.saveError') || 'Failed to save segmentation');
      setIsLoading(false);
    }
  }, [segmentationData, imageData, projectId, t, setSegmentationDataWithHistory]);

  // Return all the necessary state and functions
  return {
    // State
    segmentationData,
    imageData,
    isLoading,
    error,
    editMode,
    selectedPolygonId,
    hoveredVertex,
    tempPoints,
    transform,
    interactionState,
    isShiftPressed,

    // Functions
    setEditMode,
    setSelectedPolygonId,
    setHoveredVertex,
    setTempPoints,
    setInteractionState,
    setTransform,
    setSegmentationDataWithHistory,
    handleSave,
    undo,
    redo,
    handleSliceAction,

    // Event handlers
    onMouseDown,
    onMouseMove,
    onMouseUp,

    // Canvas coordinates helper
    getCanvasCoordinates: useCallback((mouseX: number, mouseY: number) => {
      return getCanvasCoordinates(mouseX, mouseY, transform, canvasRef);
    }, [transform, canvasRef])
  };
};
