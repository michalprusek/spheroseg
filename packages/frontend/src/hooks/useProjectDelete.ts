import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import logger from '@/lib/logger';

interface UseProjectDeleteOptions {
  /**
   * Callback function to be called after successful deletion
   */
  onSuccess?: (deletedProjectId: string) => void;

  /**
   * Whether to show toast notifications
   * @default true
   */
  showToasts?: boolean;

  /**
   * Whether to navigate to dashboard after successful deletion
   * @default true
   */
  navigateToDashboard?: boolean;

  /**
   * Whether to show confirmation dialog before deletion
   * @default true
   */
  showConfirmation?: boolean;

  /**
   * Custom confirmation message
   * @default "Are you sure you want to delete this project? This action cannot be undone."
   */
  confirmationMessage?: string;

  /**
   * Request timeout in milliseconds
   * @default 10000 (10 seconds)
   */
  timeout?: number;

  /**
   * Whether to invalidate queries after deletion
   * @default true
   */
  invalidateQueries?: boolean;
}

interface UseProjectDeleteReturn {
  /**
   * Delete a project
   * @param projectId - ID of the project to delete
   * @param projectName - Name of the project (for display purposes)
   * @returns Promise that resolves with the deleted project ID when the deletion is complete
   */
  deleteProject: (projectId: string, projectName?: string) => Promise<string | null>;

  /**
   * Whether a project deletion is in progress
   */
  isDeleting: boolean;

  /**
   * Error message if deletion failed
   */
  error: string | null;

  /**
   * ID of the project that was last deleted successfully
   */
  deletedProjectId: string | null;
}

/**
 * Hook for deleting projects
 *
 * @example
 * ```tsx
 * const { deleteProject, isDeleting } = useProjectDelete({
 *   onSuccess: (deletedProjectId) => {
 *     // Update UI or fetch new data
 *     refreshProjects();
 *   }
 * });
 *
 * return (
 *   <Button
 *     onClick={() => deleteProject(projectId)}
 *     disabled={isDeleting}
 *   >
 *     {isDeleting ? 'Deleting...' : 'Delete Project'}
 *   </Button>
 * );
 * ```
 */
export const useProjectDelete = (options: UseProjectDeleteOptions = {}): UseProjectDeleteReturn => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    onSuccess,
    showToasts = true,
    navigateToDashboard = true,
    showConfirmation = true,
    confirmationMessage,
    timeout = 10000,
    invalidateQueries = true
  } = options;

  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedProjectId, setDeletedProjectId] = useState<string | null>(null);

  const deleteProject = useCallback(async (projectId: string, projectName?: string): Promise<string | null> => {
    if (!projectId) {
      const errorMsg = t('projects.missingId') || 'Cannot delete project: missing project identifier';
      logger.error(errorMsg);
      if (showToasts) {
        toast.error(errorMsg);
      }
      setError(errorMsg);
      return null;
    }

    if (isDeleting) {
      logger.warn('Attempted to delete a project while another deletion is in progress');
      return null;
    }

    // Confirmation dialog is now handled by DeleteProjectDialog component
    // This block was intentionally removed to prevent double confirmation dialogs

    setIsDeleting(true);
    setError(null);

    try {
      logger.info('Deleting project', { projectId, projectName });

      // Create a loading toast with ID for later dismissal
      let toastId;
      if (showToasts) {
        toastId = toast.loading(t('projects.deleting') || 'Deleting project...');
      }

      try {
        // Make the API request with explicit timeout
        // Server responds with 204 No Content on successful deletion
        const response = await apiClient.delete(`/projects/${projectId}`, {
          timeout: timeout,
          validateStatus: (status) => {
            // Consider both 200 and 204 as valid responses for deletion
            return (status >= 200 && status < 300) || status === 204;
          }
        });

        // Log the response status for debugging
        logger.info('Project deletion API response', {
          projectId,
          status: response.status,
          statusText: response.statusText
        });

        logger.info('Project deleted successfully', { projectId, projectName });

        // Dismiss the loading toast if it exists
        if (showToasts && toastId) {
          toast.dismiss(toastId);
          toast.success(t('projects.deleteSuccess') || 'Project deleted successfully');
        }
      } catch (err) {
        // Dismiss the loading toast before showing error
        if (showToasts && toastId) {
          toast.dismiss(toastId);
        }
        // Re-throw the error to be caught by the outer catch block
        throw err;
      }

      // Invalidate relevant queries if enabled
      if (invalidateQueries) {
        try {
          // Forcefully invalidate ALL queries to ensure fresh data everywhere
          await Promise.all([
            // Project-specific queries
            queryClient.invalidateQueries({ queryKey: ['project', projectId], exact: true }),
            queryClient.invalidateQueries({ queryKey: ['queue-status', projectId], exact: true }),
            queryClient.invalidateQueries({ queryKey: ['project-images', projectId], exact: true }),

            // General project lists that would contain this project
            queryClient.invalidateQueries({ queryKey: ['projects'] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] }),
            queryClient.invalidateQueries({ queryKey: ['user-projects'] }),

            // Related resource queries
            queryClient.invalidateQueries({ queryKey: ['images'] }),
            queryClient.invalidateQueries({ queryKey: ['queue'] })
          ]);

          logger.info('Successfully invalidated queries after project deletion', { projectId });
        } catch (error) {
          // Non-fatal error - log but continue
          logger.warn('Error invalidating queries after project deletion', {
            error,
            projectId,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Trigger a custom event for components that might be listening
      window.dispatchEvent(new CustomEvent('project-deleted', { detail: { projectId, projectName } }));

      setDeletedProjectId(projectId);

      if (onSuccess) {
        onSuccess(projectId);
      }

      // Navigate to dashboard if enabled
      if (navigateToDashboard) {
        console.log("Project deletion successful, navigating to dashboard");

        // Cancel any pending requests to prevent stale data access
        queryClient.cancelQueries();

        // Clear cache and ensure we have fresh data after navigation
        queryClient.clear();

        // Immediate navigation with replace: true to prevent browser history issues
        navigate('/dashboard', { replace: true });
      }

      return projectId;
    } catch (err) {
      let message = t('projects.deleteFailed') || 'Failed to delete project';
      let shouldRefresh = false;

      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          message = t('projects.notFound') || `Project "${projectName || 'Untitled'}" not found. It may have been deleted already.`;
          shouldRefresh = true;

          // Invalidate queries even for 404 to ensure UI is in sync
          if (invalidateQueries) {
            // Invalidate all queries to ensure UI is in sync
            await queryClient.invalidateQueries({ queryKey: ['project', projectId], exact: true });
            await queryClient.invalidateQueries({ queryKey: ['queue-status', projectId], exact: true });
            await queryClient.invalidateQueries({ queryKey: ['project-images', projectId], exact: true });

            // Also clear broader queries
            await queryClient.invalidateQueries({ queryKey: ['projects'] });
            await queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] });
            await queryClient.invalidateQueries({ queryKey: ['user-projects'] });
            await queryClient.invalidateQueries({ queryKey: ['images'] });
            await queryClient.invalidateQueries({ queryKey: ['queue'] });
          }

          if (showToasts) {
            toast.info(message);
          }
        } else if (err.response?.status === 401) {
          message = t('common.unauthorized') || 'You are not authorized to delete this project.';
        } else if (err.response?.status === 403) {
          message = t('common.forbidden') || 'You do not have permission to delete this project.';
        } else {
          message = err.response?.data?.message || message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }

      logger.error('Failed to delete project', { projectId, projectName, error: err });

      setError(message);

      if (showToasts && !shouldRefresh) {
        toast.error(message);
      }

      return null;
    } finally {
      setIsDeleting(false);
    }
  }, [
    isDeleting,
    onSuccess,
    showToasts,
    navigateToDashboard,
    showConfirmation,
    confirmationMessage,
    timeout,
    invalidateQueries,
    t,
    navigate,
    queryClient
  ]);

  return {
    deleteProject,
    isDeleting,
    error,
    deletedProjectId
  };
};
