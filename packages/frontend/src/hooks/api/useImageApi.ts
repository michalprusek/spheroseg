/**
 * Image API Hook
 */

import { useState, useCallback } from 'react';
import apiClient from '@/lib/apiClient';

export interface ProjectImage {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
  segmentation_status: string;
}

export const useImageApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const getImages = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/projects/${projectId}/images`);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadImages = useCallback(
    async (projectId: string, files: File[], onProgress?: (event: { progress: number }) => void) => {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('images', file);
        });

        const response = await apiClient.post(`/projects/${projectId}/images`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(progress);
              if (onProgress) {
                onProgress({ progress });
              }
            }
          },
        });
        return response.data;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deleteImage = useCallback(async (projectId: string, imageId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.delete(`/projects/${projectId}/images/${imageId}`);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteImages = useCallback(async (projectId: string, imageIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.delete(`/projects/${projectId}/images`, {
        data: { imageIds },
      });
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Method to upload a single image (for test compatibility)
  const uploadImage = useCallback(
    async (projectId: string, file: File, onProgress?: (event: { progress: number }) => void) => {
      return uploadImages(projectId, [file], onProgress);
    },
    [uploadImages],
  );

  // Method to get image details
  const getImageDetails = useCallback(async (projectId: string, imageId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/projects/${projectId}/images/${imageId}`);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Method to update image status
  const updateImageStatus = useCallback(async (projectId: string, imageId: string, status: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.patch(`/projects/${projectId}/images/${imageId}`, { status });
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // Original method names
    getImages,
    uploadImages,
    deleteImage,
    deleteImages,
    // Test compatibility methods
    fetchProjectImages: getImages,
    uploadImage,
    getImageDetails,
    updateImageStatus,
    loading,
    error,
    uploadProgress,
  };
};
