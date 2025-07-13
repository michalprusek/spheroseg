/**
 * Authentication API Hook
 */

import { useState, useCallback } from 'react';
import apiClient from '@/lib/apiClient';

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export const useAuthApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const login = useCallback(async (data: LoginData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', data);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/register', data);
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/logout');
      return response.data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const response = await apiClient.post('/auth/refresh');
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  return {
    login,
    register,
    logout,
    refreshToken,
    loading,
    error,
  };
};
