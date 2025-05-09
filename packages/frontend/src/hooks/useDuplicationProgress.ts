/**
 * Hook for tracking project duplication progress
 * 
 * This hook connects to the backend via API and WebSocket to monitor
 * the progress of an asynchronous project duplication task.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import logger from '@/lib/logger';
import { Project } from '@/types';

/**
 * Duplication task status
 */
export type DuplicationTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Duplication task data
 */
export interface DuplicationTask {
  /**
   * Task ID (UUID)
   */
  id: string;
  
  /**
   * Task status
   */
  status: DuplicationTaskStatus;
  
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Number of processed items
   */
  processedItems: number;
  
  /**
   * Total number of items to process
   */
  totalItems: number;
  
  /**
   * ID of the original project being duplicated
   */
  originalProjectId: string;
  
  /**
   * ID of the new project (result of duplication)
   */
  newProjectId?: string;
  
  /**
   * Error message if task failed
   */
  errorMessage?: string;
  
  /**
   * Result data (the new project)
   */
  result?: Project;
  
  /**
   * Original project title
   */
  originalProjectTitle?: string;
  
  /**
   * New project title
   */
  newProjectTitle?: string;
  
  /**
   * Task creation date
   */
  createdAt: string;
  
  /**
   * Last update date
   */
  updatedAt: string;
}

/**
 * Progress update event from WebSocket
 */
interface ProgressUpdateEvent {
  taskId: string;
  status: DuplicationTaskStatus;
  progress: number;
  processedItems: number;
  totalItems: number;
  newProjectId?: string;
  result?: Project;
  error?: string;
  timestamp: string;
}

/**
 * Options for the useDuplicationProgress hook
 */
interface UseDuplicationProgressOptions {
  /**
   * Task ID to track
   */
  taskId?: string | null;
  
  /**
   * Whether to show toast notifications for status changes
   */
  showToasts?: boolean;
  
  /**
   * Polling interval for API updates (ms)
   */
  pollingInterval?: number;
  
  /**
   * Callback when task completes successfully
   */
  onComplete?: (result: Project) => void;
  
  /**
   * Callback when task fails
   */
  onError?: (error: string) => void;
}

/**
 * Return type for the useDuplicationProgress hook
 */
interface UseDuplicationProgressReturn {
  /**
   * The current task data
   */
  task: DuplicationTask | null;
  
  /**
   * Whether the task is loading (initial fetch)
   */
  loading: boolean;
  
  /**
   * Error message if fetch failed
   */
  error: string | null;
  
  /**
   * Function to cancel the current task
   */
  cancelTask: () => Promise<boolean>;
  
  /**
   * Function to manually refresh the task data
   */
  refreshTask: () => Promise<void>;
}

/**
 * Hook for tracking duplication progress
 * 
 * @param options Hook options
 */
export function useDuplicationProgress(
  options: UseDuplicationProgressOptions = {}
): UseDuplicationProgressReturn {
  const { 
    taskId, 
    showToasts = true,
    pollingInterval = 5000,
    onComplete,
    onError
  } = options;
  
  const { t } = useLanguage();
  const { socket, isConnected } = useSocket();
  
  const [task, setTask] = useState<DuplicationTask | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldPoll, setShouldPoll] = useState<boolean>(true);
  
  /**
   * Fetch task data from API
   */
  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get(`/duplication/${taskId}`);
      const taskData = response.data;
      
      setTask(normalizeTaskData(taskData));
      
      // Disable polling if task is in a terminal state
      if (['completed', 'failed', 'cancelled'].includes(taskData.status)) {
        setShouldPoll(false);
        
        // Handle completion
        if (taskData.status === 'completed' && taskData.result && onComplete) {
          onComplete(taskData.result);
        }
        
        // Handle error
        if (taskData.status === 'failed' && taskData.error_message && onError) {
          onError(taskData.error_message);
        }
      }
    } catch (err) {
      logger.error('Error fetching duplication task', { taskId, error: err });
      setError(t('projects.duplicationTaskFetchError') || 'Error fetching task data');
    } finally {
      setLoading(false);
    }
  }, [taskId, onComplete, onError, t]);
  
  /**
   * Cancel the current task
   */
  const cancelTask = useCallback(async (): Promise<boolean> => {
    if (!taskId) return false;
    
    try {
      await apiClient.delete(`/duplication/${taskId}`);
      
      if (showToasts) {
        toast.info(t('projects.duplicationCancelled') || 'Project duplication cancelled');
      }
      
      // Refresh task data
      await fetchTask();
      
      return true;
    } catch (err) {
      logger.error('Error cancelling duplication task', { taskId, error: err });
      
      if (showToasts) {
        toast.error(t('projects.duplicationCancelError') || 'Error cancelling duplication');
      }
      
      return false;
    }
  }, [taskId, fetchTask, showToasts, t]);
  
  /**
   * Handle progress update from WebSocket
   */
  const handleProgressUpdate = useCallback((data: ProgressUpdateEvent) => {
    if (!taskId || data.taskId !== taskId) return;
    
    logger.debug('Received duplication progress update', data);
    
    // Convert API data format to hook format
    const updatedTask: DuplicationTask = {
      id: data.taskId,
      status: data.status,
      progress: data.progress,
      processedItems: data.processedItems,
      totalItems: data.totalItems,
      originalProjectId: task?.originalProjectId || '',
      newProjectId: data.newProjectId || task?.newProjectId,
      errorMessage: data.error,
      result: data.result,
      originalProjectTitle: task?.originalProjectTitle,
      newProjectTitle: task?.newProjectTitle || data.result?.title,
      createdAt: task?.createdAt || new Date().toISOString(),
      updatedAt: data.timestamp
    };
    
    setTask(updatedTask);
    
    // Show toast notifications for status changes
    if (showToasts) {
      if (data.status === 'completed' && !task?.status !== 'completed') {
        toast.success(t('projects.duplicationComplete') || 'Project duplication completed');
      } else if (data.status === 'failed' && task?.status !== 'failed') {
        toast.error(
          data.error || t('projects.duplicationFailed') || 'Project duplication failed'
        );
      } else if (data.status === 'cancelled' && task?.status !== 'cancelled') {
        toast.info(t('projects.duplicationCancelled') || 'Project duplication cancelled');
      }
    }
    
    // Call completion callback
    if (data.status === 'completed' && data.result && onComplete) {
      onComplete(data.result);
    }
    
    // Call error callback
    if (data.status === 'failed' && data.error && onError) {
      onError(data.error);
    }
    
    // Stop polling for terminal states
    if (['completed', 'failed', 'cancelled'].includes(data.status)) {
      setShouldPoll(false);
    }
  }, [taskId, task, showToasts, t, onComplete, onError]);
  
  /**
   * Initialize WebSocket listener and polling
   */
  useEffect(() => {
    if (!taskId) return;
    
    // Initial fetch
    fetchTask();
    
    // Set up polling for non-WebSocket fallback
    let pollTimer: NodeJS.Timeout | null = null;
    
    if (shouldPoll) {
      pollTimer = setInterval(() => {
        // Only poll if socket not connected or task not in terminal state
        if (!isConnected || (task && !['completed', 'failed', 'cancelled'].includes(task.status))) {
          fetchTask();
        }
      }, pollingInterval);
    }
    
    // Clean up
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [taskId, fetchTask, isConnected, shouldPoll, task, pollingInterval]);
  
  /**
   * Listen for WebSocket events
   */
  useEffect(() => {
    if (!socket || !taskId) return;
    
    // Listen for progress updates
    socket.on('project_duplication_progress', handleProgressUpdate);
    
    // Clean up
    return () => {
      socket.off('project_duplication_progress', handleProgressUpdate);
    };
  }, [socket, taskId, handleProgressUpdate]);
  
  return {
    task,
    loading,
    error,
    cancelTask,
    refreshTask: fetchTask
  };
}

/**
 * Convert API response to normalized task data
 */
function normalizeTaskData(data: any): DuplicationTask {
  return {
    id: data.id,
    status: data.status,
    progress: data.progress || 0,
    processedItems: data.processed_items || 0,
    totalItems: data.total_items || 0,
    originalProjectId: data.original_project_id,
    newProjectId: data.new_project_id,
    errorMessage: data.error_message,
    result: data.result,
    originalProjectTitle: data.original_project_title,
    newProjectTitle: data.new_project_title,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}