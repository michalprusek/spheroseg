import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import type {
  Project,
  Image,
  SegmentationApiResponse,
  CanvasSegmentationData,
  ProjectImage,
  Polygon,
  Point, // Import Point type
} from '@/types';
import apiClient from '@/lib/apiClient';
import { constructUrl } from '@/lib/urlUtils';
import { v4 as uuidv4 } from 'uuid'; // Import UUID for polygon IDs

/**
 * Základní hook pro segmentační editor - práce s daty
 */

// Helper function to map API Image to ProjectImage used by UI
const mapApiImageToProjectImage = (apiImage: Image): ProjectImage => {
  // Construct URLs using the imported helper
  const imageUrl = constructUrl(apiImage.storage_path);
  const thumbnailUrl = constructUrl(apiImage.thumbnail_path);

  return {
    id: apiImage.id,
    project_id: apiImage.project_id,
    name: apiImage.name,
    url: imageUrl,
    thumbnail_url: thumbnailUrl,
    createdAt: new Date(apiImage.created_at),
    updatedAt: new Date(apiImage.updated_at),
    width: apiImage.width, // Add width
    height: apiImage.height, // Add height
    segmentationStatus: apiImage.status,
    // Construct segmentation result path using the helper
    segmentationResultPath: constructUrl(apiImage.segmentation_result?.path),
  };
};

export const useSegmentationCore = (
  projectId: string | undefined,
  imageId: string | undefined,
  userId: string | undefined,
) => {
  const params = useParams<{ projectId: string; imageId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const finalProjectId = projectId || params.projectId;
  const finalImageId = imageId || params.imageId;

  const [project, setProject] = useState<Project | null>(null);
  const [currentImage, setCurrentImage] = useState<ProjectImage | null>(null);
  const [segmentationData, setSegmentationData] = useState<CanvasSegmentationData | null>(null);
  // Separate loading states
  const [projectLoading, setProjectLoading] = useState<boolean>(true);
  const [segmentationLoading, setSegmentationLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [projectImages, setProjectImages] = useState<ProjectImage[]>([]);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch project details and all images for the project
  useEffect(() => {
    const fetchProjectAndImages = async () => {
      if (!finalProjectId) {
        setProjectLoading(false); // Stop loading if no project ID
        return;
      }
      setProjectLoading(true);
      setProjectImages([]); // Clear previous images
      setProject(null); // Clear previous project
      try {
        const projectResponse = await apiClient.get<Project>(`/api/projects/${finalProjectId}`);
        setProject(projectResponse.data);
        const imagesResponse = await apiClient.get<Image[]>(`/api/projects/${finalProjectId}/images`);
        const uiImages = imagesResponse.data.map(mapApiImageToProjectImage);
        setProjectImages(uiImages);
      } catch (error) {
        console.error(t('segmentationPage.errorFetchingProjectOrImages'), error);
        toast.error(t('segmentationPage.fetchError'));
        navigate('/dashboard');
      } finally {
        setProjectLoading(false); // Project/images loading finished (success or fail)
      }
    };
    fetchProjectAndImages();
  }, [finalProjectId, t, navigate]);

  // Function to fetch and process segmentation for the current image
  const fetchCurrentImageAndSegmentation = useCallback(async () => {
    // Wait until project images are loaded and finalImageId is available
    if (projectLoading || !finalImageId || projectImages.length === 0) {
      console.log('Skipping segmentation fetch: Project loading or no image ID/list');
      setSegmentationLoading(false); // Ensure segmentation loading stops if preconditions fail
      return;
    }

    setSegmentationLoading(true);
    setSegmentationData(null);
    setCurrentImage(null); // Clear previous image details

    // Find the image using direct string comparison (IDs should be strings)
    const uiImage = projectImages.find((img) => img.id === finalImageId);
    if (!uiImage) {
      toast.error(t('segmentationPage.imageNotFoundError'));
      setSegmentationLoading(false);
      // Maybe navigate to project page if image is invalid?
      // navigate(`/projects/${finalProjectId}`);
      return;
    }
    setCurrentImage(uiImage); // Set current image details

    try {
      console.log(`Fetching segmentation for image ${finalImageId}`);
      const segmentationResponse = await apiClient.get<SegmentationApiResponse>(
        `/api/images/${finalImageId}/segmentation`,
      );
      const result = segmentationResponse.data;
      console.log(`Segmentation API response for ${finalImageId}:`, result);

      const imageWidth = uiImage.width || 0;
      const imageHeight = uiImage.height || 0;

      // Helper function to set final segmentation data and loading state
      const finalizeSegmentation = (
        polygons: Polygon[] | null,
        source: 'cv2' | 'api' | 'empty' = 'empty',
        contoursData?: {
          contours: Array<Array<[number, number]>>;
          hierarchy: Array<[number, number, number, number]>;
        },
      ) => {
        const finalPolygons = polygons || [];
        if (imageWidth > 0 && imageHeight > 0) {
          const enhancedData: CanvasSegmentationData = {
            polygons: finalPolygons,
            imageWidth: imageWidth,
            imageHeight: imageHeight,
            // Include contours and hierarchy if provided
            ...(contoursData && {
              contours: contoursData.contours,
              hierarchy: contoursData.hierarchy,
            }),
            metadata: {
              source,
              timestamp: new Date().toISOString(),
              modelType: source === 'cv2' ? 'cv2' : undefined, // Assuming 'cv2' implies the model used
            },
          };
          setSegmentationData(enhancedData);
          console.log(
            `Final segmentation data set from ${source}: ${finalPolygons.length} polygons, ${imageWidth}x${imageHeight}`,
          );
        } else {
          // Fallback if dimensions are invalid
          setSegmentationData({
            polygons: [],
            imageWidth: 800, // Fallback dimensions
            imageHeight: 600,
            metadata: {
              source: 'empty',
              timestamp: new Date().toISOString(),
            },
          });
          console.warn('Final segmentation data created with fallback dimensions.');
        }
        setSegmentationLoading(false);
      };

      if (result?.status === 'completed' && result.result_data) {
        if (!(imageWidth > 0 && imageHeight > 0)) {
          console.error(
            `Invalid image dimensions (${imageWidth}x${imageHeight}) for image ${finalImageId}. Cannot process segmentation.`,
          );
          toast.error(t('segmentation.invalidImageDimensions'));
          finalizeSegmentation(null, 'empty');
          return;
        }

        // Check if contours and hierarchy are provided (new backend format)
        if (result.result_data.contours && result.result_data.hierarchy) {
          console.log(`Processing ${result.result_data.contours.length} contours from backend (cv2 format)`);
          const processedPolygons: Polygon[] = [];
          const contours = result.result_data.contours;
          const hierarchy = result.result_data.hierarchy;

          if (contours.length !== hierarchy.length) {
            console.error('Mismatch between contour and hierarchy count!');
            finalizeSegmentation(null, 'empty'); // Handle error
            return;
          }

          for (let i = 0; i < contours.length; i++) {
            const contourPoints = contours[i];
            const contourHierarchy = hierarchy[i]; // [Next, Previous, First_Child, Parent]

            if (!Array.isArray(contourPoints) || contourPoints.length < 3) {
              console.warn(`Skipping invalid contour at index ${i}:`, contourPoints);
              continue; // Skip invalid contours
            }

            const points: Point[] = contourPoints.map((p) => ({
              x: p[0],
              y: p[1],
            }));
            const parentIndex = contourHierarchy[3];
            // Assign color and type based on hierarchy (OpenCV convention)
            const color = parentIndex === -1 ? 'red' : 'blue'; // Outer contours red, inner (holes) blue
            const type = parentIndex === -1 ? 'external' : 'internal';
            const parentId = parentIndex !== -1 ? `temp-parent-${parentIndex}` : undefined; // Placeholder, might need mapping later

            processedPolygons.push({
              id: uuidv4(),
              points: points,
              color: color,
              type: type,
              parentId: parentId, // Include parentId if it's a hole
              // Potentially map parentId to actual polygon UUIDs if needed
            });
          }
          console.log(`Successfully processed ${processedPolygons.length} polygons from contours.`);
          finalizeSegmentation(processedPolygons, 'cv2', {
            contours: result.result_data.contours, // Keep original contour data if needed
            hierarchy: result.result_data.hierarchy,
          });

          // --- Fallback for old format ---
        } else if (result.result_data.polygons && result.result_data.polygons.length > 0) {
          console.log(`Processing ${result.result_data.polygons.length} polygons from backend (legacy format)`);
          // Ensure polygons have IDs and basic structure if needed
          const validatedPolygons = result.result_data.polygons.map((p) => ({
            ...p,
            id: p.id || uuidv4(), // Ensure ID exists
            // Optionally add color/type based on old logic if missing
            // color: p.color || (p.parentId ? 'blue' : 'red'),
            // type: p.type || (p.parentId ? 'internal' : 'external')
          }));
          finalizeSegmentation(validatedPolygons, 'api'); // Use 'api' source for old format
        } else {
          console.warn(
            `Segmentation completed but no valid contours/hierarchy or polygons found in result_data for ${finalImageId}.`,
          );
          //toast.info('Segmentace dokončena, ale bez dat kontur nebo polygonů. Zkuste resegmentaci nebo zkontrolujte backend.');
          finalizeSegmentation([], 'empty');
        }
      } else if (result?.status === 'failed') {
        console.warn(`Segmentation failed for image ${finalImageId}: ${result.error}`);
        toast.warning(t('segmentationPage.segmentationFailedPreviously') + `: ${result.error || ''}`);
        finalizeSegmentation(null, 'empty');
      } else {
        // Status is pending or processing, or result is null/undefined
        const status = result?.status || 'unknown';
        console.log(`Segmentation status for ${finalImageId} is ${status}. Waiting...`);
        if (status !== 'unknown') {
          toast.info(`Segmentace (${status}) pro ${uiImage.name} stále probíhá...`);
        }
        finalizeSegmentation(null, 'empty');
      }
    } catch (error) {
      console.error(`Error fetching segmentation for image ${finalImageId}:`, error);
      toast.error(t('segmentationPage.fetchSegmentationError'));
      setSegmentationLoading(false); // Stop loading on error
      setSegmentationData(null); // Clear data on error
    }
  }, [finalImageId, projectImages, projectLoading, t /* remove navigate? */]);

  // Fetch segmentation data when the image ID or project images change
  useEffect(() => {
    fetchCurrentImageAndSegmentation();
  }, [fetchCurrentImageAndSegmentation]); // Dependency array correctly includes the memoized callback

  // Function to trigger resegmentation using the neural network
  const handleResegmentCurrentImage = useCallback(async () => {
    if (!finalImageId) {
      toast.error(t('segmentationPage.noImageSelected') || 'No image selected for resegmentation.');
      return;
    }
    console.log(`Triggering resegmentation for image ${finalImageId}`);
    try {
      setSegmentationLoading(true);
      toast.info(
        t('segmentationPage.resegmentationStarted') || 'Starting resegmentation with ResUNet neural network...',
      );

      // Make API call to trigger batch segmentation with high priority
      await apiClient.post(`/api/segmentation/batch`, {
        imageIds: [finalImageId],
        priority: 10, // High priority for resegmentation
        model_type: 'resunet', // Explicitly specify the model
      });

      toast.success(
        t('segmentationPage.resegmentationQueued') ||
          `Resegmentation for image ${currentImage?.name || finalImageId} has been queued.`,
      );

      // Set up a polling mechanism to check for segmentation completion
      const pollInterval = setInterval(async () => {
        try {
          const response = await apiClient.get(`/api/images/${finalImageId}`);
          const imageStatus = response.data?.segmentationStatus;

          if (imageStatus === 'completed') {
            clearInterval(pollInterval);
            fetchCurrentImageAndSegmentation();
            toast.success(t('segmentationPage.resegmentationCompleted') || 'Resegmentation completed successfully.');
          } else if (imageStatus === 'failed') {
            clearInterval(pollInterval);
            setSegmentationLoading(false);
            toast.error(t('segmentationPage.resegmentationFailed') || 'Resegmentation failed.');
          }
        } catch (pollError) {
          console.error('Error polling for segmentation status:', pollError);
        }
      }, 5000); // Poll every 5 seconds

      // Clear the interval after 5 minutes (timeout)
      setTimeout(
        () => {
          clearInterval(pollInterval);
          if (segmentationLoading) {
            setSegmentationLoading(false);
            toast.error(
              t('segmentationPage.resegmentationTimeout') || 'Resegmentation timed out. Please check the queue status.',
            );
          }
        },
        5 * 60 * 1000,
      );
    } catch (error) {
      console.error('Error triggering resegmentation:', error);
      setSegmentationLoading(false);
      toast.error(t('segmentationPage.resegmentationError') || 'Failed to start resegmentation.');
    }
  }, [
    finalImageId,
    currentImage?.name,
    fetchCurrentImageAndSegmentation,
    t,
    segmentationLoading,
    setSegmentationLoading,
  ]);

  // Recalculate derived loading state - SIMPLIFIED
  const isLoading = useMemo(() => {
    // Loading is true if either the project/images fetch is running
    // OR the segmentation fetch/processing is running.
    // We rely on setSegmentationLoading(false) being called only AFTER
    // setSegmentationData has been updated with valid (or fallback) dimensions.
    return projectLoading || segmentationLoading;
  }, [projectLoading, segmentationLoading]); // Dependencies are just the direct loading flags

  // Derived state for image source
  const imageSrc = useMemo(() => currentImage?.url, [currentImage]);
  const segmentationResultPath = currentImage?.segmentationResultPath || null;
  const projectTitle = project?.title || 'Neznámý projekt';
  const imageName = currentImage?.name || 'Neznámý obrázek';

  // Function to navigate between images
  const navigateToImage = useCallback(
    (direction: 'prev' | 'next' | number) => {
      // Immediately clear current segmentation data to prevent showing stale polygons
      setSegmentationData(null);
      setCurrentImage(null); // Also clear current image details immediately
      console.log('Cleared segmentation and current image for navigation.');

      if (!projectImages || projectImages.length === 0) {
        console.warn('Navigation attempt with no project images loaded.');
        return;
      }

      const currentIndex = projectImages.findIndex((img) => img.id === finalImageId);
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (typeof direction === 'number') {
        nextIndex = direction;
      } else if (direction === 'prev') {
        nextIndex = (currentIndex - 1 + projectImages.length) % projectImages.length;
      } else {
        nextIndex = (currentIndex + 1) % projectImages.length;
      }

      if (nextIndex >= 0 && nextIndex < projectImages.length) {
        const nextImageId = projectImages[nextIndex].id;
        navigate(`/projects/${finalProjectId}/segmentation/${nextImageId}`);
      } else {
        console.warn('Invalid navigation index:', nextIndex);
      }
    },
    [projectImages, finalImageId, finalProjectId, navigate, setSegmentationData, setCurrentImage],
  );

  // Function to save segmentation data
  const handleSave = useCallback(async () => {
    if (!finalProjectId || !finalImageId || !segmentationData) return;

    // --- Temporarily comment out validation ---
    /*
    // Import the polygon validator
    const { validatePolygons } = await import('@/lib/segmentation');

    // Validate polygons before saving
    const validationResult = validatePolygons(segmentationData.polygons);

    if (!validationResult.isValid) {
      console.error('Polygon validation failed:', validationResult.errors);
      toast.error(t('segmentationPage.validationError') || 'Validation failed. Please fix the following issues:');

      // Show each validation error as a separate toast
      validationResult.errors.forEach(error => {
        toast.error(error);
      });

      return;
    }
    */
    // --- End of commented out validation ---

    setSaving(true);
    try {
      await apiClient.put(`/api/projects/${finalProjectId}/images/${finalImageId}/segmentation`, {
        segmentation_data: segmentationData,
      });
      toast.success(t('segmentationPage.saveSuccess'));
    } catch (error) {
      console.error('Error saving segmentation:', error);
      toast.error(t('segmentationPage.saveError'));
    } finally {
      setSaving(false);
    }
  }, [finalProjectId, finalImageId, segmentationData, t]);

  // Log the return value for debugging timing
  useEffect(() => {
    console.log(
      `[useSegmentationCore Return] isLoading: ${isLoading}, projectLoading: ${projectLoading}, segmentationLoading: ${segmentationLoading}, segmentationData: ${segmentationData ? 'Exists' : 'Null'}, imageWidth: ${segmentationData?.imageWidth}, imageHeight: ${segmentationData?.imageHeight}`,
    );
  });

  return {
    project,
    projectTitle,
    imageName,
    currentImage,
    imageSrc,
    segmentationResultPath,
    segmentation: segmentationData,
    setSegmentation: setSegmentationData,
    loading: isLoading, // Use combined loading state
    saving,
    handleSave,
    canvasContainerRef,
    projectImages,
    navigateToImage,
    handleResegmentCurrentImage,
  };
};
