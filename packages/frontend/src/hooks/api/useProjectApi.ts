/**
 * Project API Hook
 */

import { useState, useCallback } from 'react';
import apiClient from '@/services/api/client';

export interface Project {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
  image_count: number;
}

export const useProjectApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/projects');
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProject = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/projects/${id}`);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (data: { title: string; description?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/projects', data);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProject = useCallback(async (id: string, data: Partial<Project>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.put(`/projects/${id}`, data);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.delete(`/projects/${id}`);
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
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    // Aliases for test compatibility
    fetchProjects: getProjects,
    fetchProjectDetails: getProject,
    loading,
    error,
  };
};
