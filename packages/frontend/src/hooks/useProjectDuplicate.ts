import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Project } from '@/types';
import logger from '@/lib/logger';
import { useDuplicationProgress, DuplicationTask } from './useDuplicationProgress';

interface UseProjectDuplicateOptions {
  /**
   * Callback function to be called after successful duplication
   */
  onSuccess?: (newProject: Project) => void;
  
  /**
   * Whether to show toast notifications
   * @default true
   */
  showToasts?: boolean;
  
  /**
   * Whether to navigate to the new project after successful duplication
   * @default false
   */
  navigateToNewProject?: boolean;
  
  /**
   * Whether to use asynchronous duplication for large projects
   * @default true
   */
  async?: boolean;
}

interface DuplicateProjectParams {
  /**
   * ID of the project to duplicate
   */
  projectId: string;
  
  /**
   * Title for the new project
   * @default "{original title} (Copy)"
   */
  newTitle?: string;
  
  /**
   * Whether to copy image files
   * @default true
   */
  copyFiles?: boolean;
  
  /**
   * Whether to copy segmentation results
   * @default false
   */
  copySegmentations?: boolean;
  
  /**
   * Whether to reset image status to pending
   * @default true
   */
  resetStatus?: boolean;
  
  /**
   * Whether to force asynchronous duplication
   * This overrides the hook's async option
   * @default undefined (use hook's async option)
   */
  forceAsync?: boolean;
}

interface UseProjectDuplicateReturn {
  /**
   * Duplicate a project
   * @param params - Parameters for project duplication
   * @returns Promise that resolves with the new project when the duplication is complete (synchronous mode)
   *          or task information (asynchronous mode)
   */
  duplicateProject: (params: DuplicateProjectParams) => Promise<Project | null | { taskId: string }>;
  
  /**
   * Whether a project duplication is in progress
   */
  isDuplicating: boolean;
  
  /**
   * Error message if duplication failed
   */
  error: string | null;
  
  /**
   * The newly created project (if duplication was successful)
   */
  newProject: Project | null;
  
  /**
   * Current duplication task (if in async mode)
   */
  duplicationTask: DuplicationTask | null;
  
  /**
   * Cancel the current duplication task (async mode only)
   */
  cancelDuplication: () => Promise<boolean>;
}

/**
 * Hook for duplicating projects
 * 
 * @example
 * ```tsx
 * const { duplicateProject, isDuplicating } = useProjectDuplicate({
 *   onSuccess: (newProject) => {
 *     // Update UI or fetch new data
 *     refreshProjects();
 *   }
 * });
 * 
 * return (
 *   <Button 
 *     onClick={() => duplicateProject({ projectId })}
 *     disabled={isDuplicating}
 *   >
 *     {isDuplicating ? 'Duplicating...' : 'Duplicate Project'}
 *   </Button>
 * );
 * ```
 */
export const useProjectDuplicate = (options: UseProjectDuplicateOptions = {}): UseProjectDuplicateReturn => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const { 
    onSuccess, 
    showToasts = true, 
    navigateToNewProject = false,
    async = true
  } = options;
  
  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState<Project | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  
  // Use the duplication progress hook for tracking async duplication
  const {
    task: duplicationTask,
    cancelTask: cancelDuplication,
    refreshTask
  } = useDuplicationProgress({
    taskId: currentTaskId,
    onComplete: (result) => {
      setIsDuplicating(false);
      setNewProject(result);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      // Navigate to the new project if enabled
      if (navigateToNewProject && result && result.id) {
        navigate(`/projects/${result.id}`);
      }
    },
    onError: (errorMsg) => {
      setIsDuplicating(false);
      setError(errorMsg);
    },
    showToasts
  });
  
  const duplicateProject = useCallback(async (params: DuplicateProjectParams): Promise<Project | null | { taskId: string }> => {
    const { 
      projectId, 
      newTitle, 
      copyFiles = true, 
      copySegmentations = false,
      resetStatus = true,
      forceAsync
    } = params;
    
    if (isDuplicating) {
      logger.warn('Attempted to duplicate a project while another duplication is in progress');
      return null;
    }
    
    setIsDuplicating(true);
    setError(null);
    setNewProject(null);
    
    try {
      logger.info('Duplicating project', { 
        projectId, 
        newTitle: newTitle || '(auto-generated)', 
        copyFiles, 
        copySegmentations,
        resetStatus,
        async: forceAsync !== undefined ? forceAsync : async
      });
      
      if (showToasts) {
        toast.info(t('projects.duplicating') || 'Duplicating project...');
      }
      
      // Determine if we should use async mode
      const useAsyncMode = forceAsync !== undefined ? forceAsync : async;
      
      const response = await apiClient.post(
        `/projects/${projectId}/duplicate`, 
        {
          newTitle,
          copyFiles,
          copySegmentations,
          resetStatus,
          async: useAsyncMode
        }
      );
      
      // Check if this is an async duplication response (contains taskId)
      if (useAsyncMode && response.data.taskId) {
        const taskId = response.data.taskId;
        logger.info('Project duplication started asynchronously', { 
          originalProjectId: projectId, 
          taskId 
        });
        
        // Store the task ID for tracking
        setCurrentTaskId(taskId);
        
        // Return task information
        return { taskId };
      }
      
      // Handle synchronous duplication response
      const duplicatedProject = response.data;
      
      logger.info('Project duplicated successfully', { 
        originalProjectId: projectId, 
        newProjectId: duplicatedProject.id 
      });
      
      if (showToasts) {
        toast.success(t('projects.duplicateSuccess') || 'Project duplicated successfully');
      }
      
      setNewProject(duplicatedProject);
      
      if (onSuccess) {
        onSuccess(duplicatedProject);
      }
      
      // Navigate to the new project if enabled
      if (navigateToNewProject) {
        navigate(`/projects/${duplicatedProject.id}`);
      }
      
      return duplicatedProject;
    } catch (err) {
      logger.error('Failed to duplicate project', { projectId, error: err });
      
      let errorMessage = t('projects.duplicateFailed') || 'Failed to duplicate project';
      
      if (axios.isAxiosError(err) && err.response) {
        errorMessage = err.response.data?.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      if (showToasts) {
        toast.error(errorMessage);
      }
      
      return null;
    } finally {
      if (!async) {
        setIsDuplicating(false);
      }
    }
  }, [isDuplicating, onSuccess, showToasts, navigateToNewProject, t, navigate, async]);
  
  return {
    duplicateProject,
    isDuplicating,
    error,
    newProject,
    duplicationTask,
    cancelDuplication
  };
};
