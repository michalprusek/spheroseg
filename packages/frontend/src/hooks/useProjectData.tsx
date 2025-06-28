import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { Project, Image, ProjectImage, ImageStatus } from '@/types';
import apiClient from '@/lib/apiClient';
import axios, { AxiosError } from 'axios';
import { Socket } from 'socket.io-client';
import socketClient from '@/services/socketClient';
import config from '@/config';
import { getProjectImages, mapApiImageToProjectImage } from '@/api/projectImages';

// The mapApiImageToProjectImage function is now imported from @/api/projectImages

// Define the shape of the data received via WebSocket
interface SegmentationUpdateData {
  imageId: string;
  status: ImageStatus;
  resultPath?: string | null; // Expect client-relative path from the service
  error?: string;
}

export const useProjectData = (projectId: string | undefined) => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Import API configuration from config
  const apiBaseUrl = config.apiBaseUrl;

  // Helper function to clean project ID (ensure it has the correct format for API calls)
  const cleanProjectId = useCallback((id: string): string => {
    // Skip if id is not valid
    if (!id) return id;

    console.log(`Cleaning project ID: ${id}`);

    // Remove "project-" prefix if it exists
    if (id.startsWith('project-')) {
      const cleanedId = id.substring(8);
      console.log(`Removed 'project-' prefix: ${cleanedId}`);
      return cleanedId;
    }

    // Return the ID as is if it doesn't have the prefix
    return id;
  }, []);

  const fetchProjectData = useCallback(async () => {
    if (!projectId || !user?.id) {
      setError('Project ID or user information is missing.');
      setLoading(false);
      return;
    }

    // Clean the projectId to ensure we use just the UUID
    const cleanedProjectId = cleanProjectId(projectId);

    console.log(`Fetching project data with cleaned ID: ${cleanedProjectId} (original: ${projectId})`);

    setLoading(true);
    setError(null);

    try {
      // First, attempt to check if this is a valid project
      console.log(`Starting API call to fetch project with ID: ${cleanedProjectId}`);

      // Try different API endpoints for project data
      let projectResponse;

      // Define all possible endpoints to try
      const projectEndpoints = [`/projects/${cleanedProjectId}`, `/api/projects/${cleanedProjectId}`];

      // If the ID has a prefix, also try without it
      if (cleanedProjectId.startsWith('project-')) {
        const idWithoutPrefix = cleanedProjectId.substring(8);
        projectEndpoints.push(`/projects/${idWithoutPrefix}`);
        projectEndpoints.push(`/api/projects/${idWithoutPrefix}`);
      }

      // Try each endpoint until one works
      let lastProjectError;
      for (const endpoint of projectEndpoints) {
        try {
          console.log(`Trying to fetch project data from endpoint: ${endpoint}`);
          projectResponse = await apiClient.get<Project>(endpoint);
          console.log(`Successfully retrieved project data from API endpoint ${endpoint}`, projectResponse.data);
          break; // Exit the loop if successful
        } catch (endpointError) {
          lastProjectError = endpointError;
          if (axios.isAxiosError(endpointError) && endpointError.response?.status === 404) {
            console.log(`Endpoint ${endpoint} returned 404, trying next endpoint`);
            continue;
          } else {
            console.error(`Error fetching project data from ${endpoint}:`, endpointError);
            continue;
          }
        }
      }

      // If all endpoints failed, throw the last error
      if (!projectResponse) {
        console.error('All project data endpoints failed');
        throw lastProjectError;
      }

      // Set project data in state
      setProject(projectResponse.data);

      try {
        // Add a separate try-catch for images to handle 404 gracefully
        console.log(`Fetching images for project: ${cleanedProjectId}`);

        // Use our new API module to get project images
        const projectImages = await getProjectImages(cleanedProjectId);

        if (projectImages.length === 0) {
          console.log('Project has no images');
          setImages([]);

          // Don't show a toast for no images - the UI will show an empty state
          // This avoids duplicate messages
        } else {
          console.log(`Retrieved ${projectImages.length} images for project`);
          setImages(projectImages);
          console.log(`Successfully set ${projectImages.length} images in state`);
        }
      } catch (imageErr) {
        console.warn('Could not fetch project images:', imageErr);

        // Set empty images array
        setImages([]);

        toast.error('Could not load project images. Please try again later.', {
          duration: 5000,
          id: 'image-fetch-error-notice',
        });
      }
    } catch (err: unknown) {
      console.error('Error fetching project data:', err);
      setProject(null);
      setImages([]);

      // Store the original URL for debug info
      const requestUrl = axios.isAxiosError(err) ? err.config?.url || 'unknown URL' : 'unknown URL';

      console.error(`Failed request to: ${requestUrl} for project ID: ${cleanedProjectId}`);

      let errorMessage = 'Failed to load project data';
      if (axios.isAxiosError(err) && err.response) {
        const status = err.response.status;
        const responseData = err.response.data;

        console.error(`API error: ${status} - ${JSON.stringify(responseData)}`);
        errorMessage = responseData?.message || errorMessage;

        if (status === 404 || status === 403) {
          errorMessage = 'Project not found or access denied.';
          console.log(`Permission error (${status}): ${errorMessage}`);

          // Check if the project ID is a timestamp and it's in the future
          if (/^\d+$/.test(cleanedProjectId)) {
            const idAsNumber = parseInt(cleanedProjectId, 10);
            const now = Date.now();
            if (idAsNumber > now) {
              errorMessage = 'Invalid project ID (future timestamp detected).';
              console.warn(`Project ID appears to be a future timestamp: ${cleanedProjectId}`);
            }
          }

          toast.error(errorMessage, {
            duration: 5000,
            id: `project-error-${cleanedProjectId}`,
          });

          // Store the failed ID in local storage to help with debugging
          try {
            localStorage.setItem('spheroseg_last_failed_id', projectId || '');
            localStorage.setItem('spheroseg_last_failed_time', new Date().toISOString());
          } catch (e) {
            // Ignore storage errors
          }

          // DISABLED: Navigation on 404 to prevent logout
          if (status === 404) {
            console.log(`Project not found (${cleanedProjectId}), but staying on page to prevent logout`);
            // Don't navigate away, just show the error message
            // This prevents the user from being logged out
          }
          return;
        }
      } else if (err instanceof Error) {
        console.error(`Non-Axios error: ${err.name} - ${err.message}`);
        errorMessage = err.message;
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id, navigate, cleanProjectId]);

  useEffect(() => {
    // Only fetch data if we have a valid projectId
    if (projectId) {
      fetchProjectData();
    } else {
      console.log('useProjectData: No project ID provided, skipping data fetch');
      setLoading(false);
    }
  }, [fetchProjectData, projectId]);

  // Function to handle image status updates (defined before the effect that uses it)
  const updateImageStatus = useCallback(
    (imageId: string, status: ImageStatus, resultPath?: string | null, error?: string) => {
      setImages((prevImages) => {
        const updatedImages = prevImages.map((image) => {
          if (image.id === imageId) {
            const updatedImage = {
              ...image,
              segmentationStatus: status,
            };

            // Update segmentation result path if provided
            if (resultPath) {
              updatedImage.segmentationResultPath = resultPath;
            }

            // Update error message if provided and status is failed
            if (status === 'failed' && error) {
              updatedImage.error = error;
            }

            return updatedImage;
          }
          return image;
        });

        // After updating images in memory, save to localStorage
        try {
          const projectIdToUse = project?.id || projectId;
          if (projectIdToUse) {
            import('@/api/projectImages').then(({ storeUploadedImages }) => {
              storeUploadedImages(projectIdToUse, updatedImages);
            });
          }
        } catch (storageError) {
          console.error('Failed to save updated images to localStorage:', storageError);
        }

        return updatedImages;
      });
    },
    [project?.id, projectId],
  );

  const refreshData = useCallback(() => {
    console.log('Manually refreshing project data');
    fetchProjectData();
    
    // When refreshing data, also check for any ongoing segmentations
    if (projectId) {
      const cleanedProjectId = cleanProjectId(projectId);
      
      // Try different API endpoints to get current segmentation status
      const endpoints = [
        `/api/segmentation/queue-status/${cleanedProjectId}`,
        `/api/segmentation/queue-status/${cleanedProjectId}`,
        `/api/segmentations/queue/status/${cleanedProjectId}`
      ];
      
      // Try each endpoint until one works
      (async () => {
        for (const endpoint of endpoints) {
          try {
            console.log(`Checking segmentation status from ${endpoint}`);
            const response = await apiClient.get(endpoint);
            
            if (response.data) {
              console.log('Got segmentation status data:', response.data);
              // If we have images with processing status, update local state
              const images = response.data.images || {};
              if (images.processing_count > 0) {
                // Fetch the specific list of images from the API again
                await fetchProjectData();
              }
              break;
            }
          } catch (error) {
            console.warn(`Failed to fetch from ${endpoint}:`, error);
            // Continue to the next endpoint
          }
        }
      })();
    }
  }, [fetchProjectData, projectId, cleanProjectId]);

  // Listen for image-deleted events
  useEffect(() => {
    if (!projectId) {
      return;
    }

    // Clean the projectId to ensure we use just the UUID
    const cleanedProjectId = cleanProjectId(projectId);

    // Define the handler for image-deleted events
    const handleImageDeleted = (event: Event) => {
      const customEvent = event as CustomEvent<{
        imageId: string;
        projectId: string;
      }>;
      const { imageId, projectId: eventProjectId } = customEvent.detail;

      // Only handle events for this project
      if (eventProjectId === cleanedProjectId) {
        console.log(`Received image-deleted event for image ${imageId} in project ${eventProjectId}`);

        // Update the images state
        setImages((prevImages) => prevImages.filter((img) => img.id !== imageId));
      }
    };

    // Add event listeners
    window.addEventListener('image-deleted', handleImageDeleted);

    // Clean up
    return () => {
      window.removeEventListener('image-deleted', handleImageDeleted);
    };
  }, [projectId, cleanProjectId]);
  
  // Second event listener for image-status-update
  useEffect(() => {
    if (!projectId) {
      return;
    }
    
    // Define the handler for image-status-update events
    const handleImageStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        imageId: string;
        status: ImageStatus;
        forceQueueUpdate?: boolean;
        error?: string;
        resultPath?: string | null;
      }>;
      const { imageId, status, error, resultPath } = customEvent.detail;

      console.log(`Received image-status-update event for image ${imageId} with status ${status}`);
      
      // Update the image status directly
      updateImageStatus(imageId, status, resultPath, error);

      // Only refresh data for completed status to avoid infinite loops
      if (status === 'completed') {
        console.log('Image completed, refreshing project data');
        refreshData();
      }
    };
    
    // Add event listener
    window.addEventListener('image-status-update', handleImageStatusUpdate);
    
    // Clean up
    return () => {
      window.removeEventListener('image-status-update', handleImageStatusUpdate);
    };
  }, [projectId, updateImageStatus, refreshData]);

  // WebSocket connection and event handling
  useEffect(() => {
    if (!projectId) {
      console.log('WebSocket: Skipping connection (no project ID).');
      return;
    }

    // Clean the projectId to ensure we use just the UUID
    const cleanedProjectId = cleanProjectId(projectId);

    console.log(`WebSocket: WebSocket connections disabled to prevent API spam`);

    // DISABLED: WebSocket connections to prevent API spam
    return;

    // The code below is disabled to prevent WebSocket connection attempts
    /*
    console.log(`WebSocket: Setting up connection for project ${cleanedProjectId} (original: ${projectId})`);

    let isComponentMounted = true;

    try {
      // Verify the project exists before attempting to setup WebSocket
      apiClient.get(`/api/projects/${cleanedProjectId}`)
        .then(() => {
          console.log(`WebSocket: Project ${cleanedProjectId} verified as existing, proceeding with socket setup`);
        })
        .catch(err => {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            console.error(`WebSocket: Project ${cleanedProjectId} not found, skipping socket setup`);

            // Check if the project ID is a timestamp and it's in the future
            if (/^\d+$/.test(cleanedProjectId)) {
                const idAsNumber = parseInt(cleanedProjectId, 10);
                const now = Date.now();
                if (idAsNumber > now) {
                    console.warn(`WebSocket: Project ID appears to be a future timestamp: ${cleanedProjectId}`);
                    toast.error("Invalid project ID (future timestamp detected).", {
                        duration: 5000,
                        id: `ws-project-error-${cleanedProjectId}`
                    });
                }
            }

            return;
          }
          console.warn(`WebSocket: Error verifying project existence:`, err);
        });

      // Get a socket connection using the centralized client
      const socket = socketClient.getSocket();

      // Define event handlers
      const handleConnect = () => {
          if (!isComponentMounted) return;
          console.log('WebSocket: Connected successfully. Socket ID:', socket.id);

          // Try to join a room for this project
          try {
            socket.emit('join_project', { projectId: cleanedProjectId });
            console.log(`WebSocket: Joined project room for ${cleanedProjectId}`);
          } catch (joinErr) {
            console.error('Failed to join project room:', joinErr);
          }
      };

      const handleConnectError = (err: any) => {
          if (!isComponentMounted) return;
          // Log the full error object for more details
          console.error('WebSocket: Connection Error:', err);
          // Only show toast for persistent errors, not during initial connection attempts
          if (socket.io.attempts > 2) {
              toast.error(`WebSocket connection failed: ${err.message}`, {
                  id: 'ws-connect-error',
                  duration: 3000
              });
          }
      };

      const handleDisconnect = (reason: string, description?: any) => {
          if (!isComponentMounted) return;
          // Log description if available (added in newer socket.io versions)
          console.log('WebSocket: Disconnected. Reason:', reason, 'Description:', description);

          // Only show toast for unexpected disconnections
          if (reason === 'io server disconnect') {
             toast.error('WebSocket disconnected by server.', { id: 'ws-server-disconnect' });
          } else if (reason === 'transport close') {
             console.warn('WebSocket: Transport closed. May attempt reconnection.');
          }
      };

      const handleSegmentationUpdate = (data: SegmentationUpdateData) => {
          if (!isComponentMounted) return;

          console.log('WebSocket: Received segmentation_update:', data);
          if (!data || !data.imageId || !data.status) {
               console.warn('WebSocket: Received invalid segmentation_update data', data);
               return;
          }

          // Update image in the list immediately using requestAnimationFrame
          requestAnimationFrame(() => {
              setImages(prevImages =>
                  prevImages.map(image => {
                      if (image.id === data.imageId) {
                          console.log(`WebSocket: Updating image ${data.imageId} status to ${data.status}`);
                          // Construct full result path URL using imported function
                          const resultFullPath = data.resultPath
                             ? constructUrl(data.resultPath)
                             : image.segmentationResultPath;
                          return {
                             ...image,
                             segmentationStatus: data.status,
                             segmentationResultPath: resultFullPath,
                          };
                      }
                      return image;
                  })
              );
          });

          // Show notification about segmentation completion
          if (data.status === 'completed') {
              toast.success(`Image segmentation complete!`, { id: `seg-${data.imageId}` });
              // Refresh project data to update queue indicator
              fetchProjectData();
          } else if (data.status === 'failed') {
              toast.error(`Image segmentation failed: ${data.error || 'Unknown error'}`, { id: `seg-${data.imageId}` });
              // Refresh project data to update queue indicator
              fetchProjectData();
          }
      };

      // Register event handlers
      socket.on('connect', handleConnect);
      socket.on('connect_error', handleConnectError);
      socket.on('disconnect', handleDisconnect);
      socket.on('segmentation_update', handleSegmentationUpdate);

      // Log connection status
      if (socket.connected) {
          console.log('WebSocket already connected:', socket.id);
          // If already connected, manually trigger the join_project emit
          socket.emit('join_project', { projectId: cleanedProjectId });
      } else {
          console.log('WebSocket connecting...');
          socket.connect();
      }

      // Store the project ID in localStorage for future reference/debugging
      try {
        localStorage.setItem('spheroseg_last_project_id', cleanedProjectId);
      } catch (e) {
        // Ignore localStorage errors
      }

      // Clean up function
      return () => {
          isComponentMounted = false;

          // Try to leave the project room
          try {
            socket.emit('leave_project', { projectId: cleanedProjectId });
            console.log(`WebSocket: Left project room for ${cleanedProjectId}`);
          } catch (leaveErr) {
            console.error('Failed to leave project room:', leaveErr);
          }

          // Remove event listeners
          socket.off('connect', handleConnect);
          socket.off('connect_error', handleConnectError);
          socket.off('disconnect', handleDisconnect);
          socket.off('segmentation_update', handleSegmentationUpdate);

          // Note: We don't disconnect the socket here since it's managed by the centralized client
          console.log('WebSocket: Cleaned up event listeners');
      };
    } catch (error) {
      console.error('Error setting up WebSocket in useProjectData:', error);
      return () => {
          isComponentMounted = false;
      };
    }
    */
  }, [projectId, cleanProjectId]);

  return {
    project,
    projectTitle: project?.title || '',
    images,
    loading,
    error,
    refreshData,
    updateImageStatus,
    setImages,
  };
};