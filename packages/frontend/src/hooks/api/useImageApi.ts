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

  const uploadImages = useCallback(async (projectId: string, files: File[]) => {
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
      });
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

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

  return {
    getImages,
    uploadImages,
    deleteImage,
    deleteImages,
    loading,
    error,
  };
};
