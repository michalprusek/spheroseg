import { useState, useEffect, useCallback } from 'react';
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Project, Image, ProjectImage, ImageStatus } from "@/types";
import apiClient from '@/lib/apiClient';
import axios, { AxiosError } from 'axios';
import { Socket } from "socket.io-client";
import { constructUrl } from '@/lib/urlUtils';
import socketClient from '@/socketClient';
import config from '@/config';

// TEMPORARY: Keep local map function until export is confirmed/moved
// TODO: Refactor mapApiImageToProjectImage to a shared utility
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
    width: apiImage.width,
    height: apiImage.height,
    segmentationStatus: apiImage.status,
    segmentationResultPath: constructUrl(apiImage.segmentation_result?.path),
  };
};

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

    // IMPORTANT: We need to KEEP the "project-" prefix for API calls
    // The backend expects IDs in the format "project-XXXXXXXXX"
    if (id.startsWith('project-')) {
      console.log(`Project ID already has correct prefix: ${id}`);
      return id; // Keep the prefix for API calls
    }

    // If ID doesn't have the prefix, add it
    const prefixedId = `project-${id}`;
    console.log(`Added 'project-' prefix: ${prefixedId}`);
    return prefixedId;
  }, []);



  const fetchProjectData = useCallback(async () => {
    if (!projectId || !user?.id) {
        setError("Project ID or user information is missing.");
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
      const projectResponse = await apiClient.get<Project>(`/projects/${cleanedProjectId}`);
      console.log(`Successfully retrieved project data from API`, projectResponse.data);
      setProject(projectResponse.data);

      try {
        // Add a separate try-catch for images to handle 404 gracefully
        console.log(`Fetching images for project: ${cleanedProjectId}`);

        // Try to fetch images using the project ID without prefix first
        let imagesResponse;
        try {
          // First try with the original project ID format (with prefix)
          imagesResponse = await apiClient.get<Image[]>(`/projects/${cleanedProjectId}/images`);
          console.log(`Successfully fetched images using ID with prefix: ${cleanedProjectId}`);
        } catch (prefixError) {
          if (axios.isAxiosError(prefixError) && prefixError.response?.status === 404) {
            console.log(`Failed to fetch images with prefix, trying without prefix`);

            // If the ID starts with "project-", try without the prefix
            if (cleanedProjectId.startsWith('project-')) {
              const idWithoutPrefix = cleanedProjectId.substring(8);
              try {
                imagesResponse = await apiClient.get<Image[]>(`/projects/${idWithoutPrefix}/images`);
                console.log(`Successfully fetched images using ID without prefix: ${idWithoutPrefix}`);
              } catch (noPrefixError) {
                // Re-throw the original error if both attempts fail
                throw prefixError;
              }
            } else {
              // If there's no prefix, just re-throw the original error
              throw prefixError;
            }
          } else {
            // For non-404 errors, re-throw
            throw prefixError;
          }
        }
        console.log(`Retrieved ${imagesResponse.data.length} images for project`);

        // Use the mapping function to transform API images to UI format
        const uiImages = imagesResponse.data.map(image => {
          const mappedImage = mapApiImageToProjectImage(image);
          console.log(`Mapped image ${image.id} with URL: ${mappedImage.url} and thumbnail: ${mappedImage.thumbnail_url}`);
          return mappedImage;
        });

        setImages(uiImages);
        console.log(`Successfully set ${uiImages.length} images in state`);
      } catch (imageErr) {
        console.warn("Could not fetch project images:", imageErr);

        // Don't navigate away if we just can't get images
        if (axios.isAxiosError(imageErr)) {
          console.log(`Image fetch error - Status: ${imageErr.response?.status}, Message: ${imageErr.response?.data?.message || imageErr.message}`);

          if (imageErr.response?.status === 404) {
            console.log("Project exists but has no images endpoint or no images");
            setImages([]);
            // Show a toast notification to inform the user
            toast.info("This project doesn't have any images yet. You can upload images using the 'Upload' button.", {
              duration: 5000,
              id: `no-images-${cleanedProjectId}`
            });
          } else {
            console.error(`Non-404 error fetching images: ${imageErr.response?.status} - ${imageErr.message}`);
            // For other errors, re-throw to be caught by the outer catch
            throw imageErr;
          }
        } else {
          console.error(`Unknown error type fetching images:`, imageErr);
          throw imageErr;
        }
      }

    } catch (err: unknown) {
      console.error("Error fetching project data:", err);
      setProject(null);
      setImages([]);

      // Store the original URL for debug info
      const requestUrl = axios.isAxiosError(err)
        ? err.config?.url || 'unknown URL'
        : 'unknown URL';

      console.error(`Failed request to: ${requestUrl} for project ID: ${cleanedProjectId}`);

      let errorMessage = 'Failed to load project data';
       if (axios.isAxiosError(err) && err.response) {
            const status = err.response.status;
            const responseData = err.response.data;

            console.error(`API error: ${status} - ${JSON.stringify(responseData)}`);
            errorMessage = responseData?.message || errorMessage;

            if (status === 404 || status === 403) {
                errorMessage = "Project not found or access denied.";
                console.log(`Permission error (${status}): ${errorMessage}`);

                // Check if the project ID is a timestamp and it's in the future
                if (/^\d+$/.test(cleanedProjectId)) {
                    const idAsNumber = parseInt(cleanedProjectId, 10);
                    const now = Date.now();
                    if (idAsNumber > now) {
                        errorMessage = "Invalid project ID (future timestamp detected).";
                        console.warn(`Project ID appears to be a future timestamp: ${cleanedProjectId}`);
                    }
                }

                toast.error(errorMessage, {
                    duration: 5000,
                    id: `project-error-${cleanedProjectId}`
                });

                // Store the failed ID in local storage to help with debugging
                try {
                  localStorage.setItem('spheroseg_last_failed_id', projectId || '');
                  localStorage.setItem('spheroseg_last_failed_time', new Date().toISOString());
                } catch (e) {
                  // Ignore storage errors
                }

                // Navigate after a short delay to allow the user to see the error message
                if (status === 404) {
                  console.log(`Project not found (${cleanedProjectId}), redirecting to dashboard in 2 seconds`);
                  setTimeout(() => {
                    // Use navigation with replace: true to prevent browser history issues
                    navigate('/dashboard', { replace: true });
                  }, 2000);
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
      console.log("useProjectData: No project ID provided, skipping data fetch");
      setLoading(false);
    }
  }, [fetchProjectData, projectId]);

  // WebSocket connection and event handling
  useEffect(() => {
    if (!projectId) {
        console.log("WebSocket: Skipping connection (no project ID).");
        return;
    }

    // Clean the projectId to ensure we use just the UUID
    const cleanedProjectId = cleanProjectId(projectId);

    console.log(`WebSocket: Setting up connection for project ${cleanedProjectId} (original: ${projectId})`);

    let isComponentMounted = true;

    try {
      // Verify the project exists before attempting to setup WebSocket
      apiClient.get(`/projects/${cleanedProjectId}`)
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
  }, [projectId, fetchProjectData, cleanProjectId]);

  const refreshData = useCallback(() => {
      fetchProjectData();
  }, [fetchProjectData]);

  // Funkce pro okamžitou aktualizaci statusu obrázku bez nutnosti znovu načítat všechna data
  const updateImageStatus = useCallback((imageId: string, status: ImageStatus) => {
    setImages(prevImages =>
      prevImages.map(image => {
        if (image.id === imageId) {
          return {
            ...image,
            segmentationStatus: status
          };
        }
        return image;
      })
    );
  }, []);

  return {
    project,
    projectTitle: project?.title || "",
    images,
    loading,
    error,
    refreshData,
    updateImageStatus
  };
};
