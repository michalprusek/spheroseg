import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
// Use types from @/types
import { Project } from '@/types';
import apiClient from '@/lib/apiClient';
import axios, { AxiosError } from 'axios';

// Type for the API response from GET /api/projects
interface ProjectsApiResponse {
  projects: Project[];
  total: number;
}

// Updated return type
interface UseDashboardProjectsReturn {
  projects: Project[];
  totalProjects: number;
  loading: boolean;
  error: string | null;
  fetchProjects: (limit?: number, offset?: number, sortField?: string, sortDirection?: 'asc' | 'desc') => void; // Allow sorting
  // Remove fetchTotalProjects
}

export const useDashboardProjects = (): UseDashboardProjectsReturn => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalProjects, setTotalProjects] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Updated fetchProjects to handle pagination, sorting, and total count
  const fetchProjects = useCallback(
    async (limit: number = 10, offset: number = 0, sortField?: string, sortDirection?: 'asc' | 'desc') => {
      if (!user?.id) {
        setError('User not authenticated.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        console.log(`Fetching projects for user ${user.id}, limit: ${limit}, offset: ${offset}, sortField: ${sortField}, sortDirection: ${sortDirection}`);

        // Create the API request with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn('Projects API request timed out, aborting');
          controller.abort('timeout');
        }, 30000); // 30 second timeout - gives server more time to respond

        try {
          // Create the params object with sorting parameters if provided
          const params: Record<string, any> = { limit, offset };
          if (sortField) {
            params.sort_field = sortField;
          }
          if (sortDirection) {
            params.sort_direction = sortDirection;
          }

          // Make API request with abort signal and increased timeout
          const response = await apiClient.get<ProjectsApiResponse>('/api/projects', {
            params,
            signal: controller.signal,
            timeout: 30000,
            // Force refresh for every request to ensure we have the latest data
            headers: {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
              'If-None-Match': Math.random().toString(),
            },
          });

          // Clear the timeout since we got a response
          clearTimeout(timeoutId);

          // Log the full response for debugging
          console.log('Projects API response:', response.data);

          // Handle different response formats flexibly
          let fetchedProjects: Project[] = [];
          let total = 0;

          if (response.data) {
            // Check if the response has the expected structure
            if (response.data.projects && Array.isArray(response.data.projects)) {
              fetchedProjects = response.data.projects;
              total = response.data.total || 0;
            }
            // Fallback: if response is an array, assume it's the projects array
            else if (Array.isArray(response.data)) {
              fetchedProjects = response.data;
              total = response.data.length;
            }
            // Fallback: if response is an object with results property (alternative API format)
            else if (response.data.results && Array.isArray(response.data.results)) {
              fetchedProjects = response.data.results;
              total = response.data.count || response.data.results.length;
            }
          }

          // Process the projects regardless of source format
          if (fetchedProjects.length > 0) {
            // Process thumbnails intelligently
            const processedProjects = fetchedProjects.map((proj) => {
              // Handle both object formats and perform null checks
              const project = { ...proj };

              // Handle name/title mapping - frontend expects title but backend uses name
              if (project.name && !project.title) {
                project.title = project.name;
              } else if (project.title && !project.name) {
                project.name = project.title;
              }

              // Handle thumbnail URLs properly
              if (project.thumbnail_url) {
                // If it's already a full URL, don't modify
                if (project.thumbnail_url.startsWith('http')) {
                  // No changes needed
                }
                // If it's a relative path, make it absolute
                else {
                  project.thumbnail_url = `${window.location.origin}/${project.thumbnail_url.replace(/^\/+/, '')}`;
                }
              } else if (project.thumbnailUrl) {
                // Handle alternative property name
                project.thumbnail_url = project.thumbnailUrl;
                delete project.thumbnailUrl;
              }

              // Ensure required properties exist
              project.image_count = project.image_count ?? 0;
              project.description = project.description ?? '';

              return project;
            });

            console.log('Processed projects before sorting:', processedProjects);

            // Apply client-side sorting if sort parameters are provided
            if (sortField && sortDirection) {
              processedProjects.sort((a, b) => {
                let valueA = a[sortField]?.toString().toLowerCase() || '';
                let valueB = b[sortField]?.toString().toLowerCase() || '';

                // For date fields, convert to Date objects
                if (sortField === 'updated_at' || sortField === 'created_at') {
                  valueA = new Date(a[sortField] || 0).getTime();
                  valueB = new Date(b[sortField] || 0).getTime();
                }

                // Apply sort direction
                if (sortDirection === 'asc') {
                  return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
                } else {
                  return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
                }
              });

              console.log('Projects after client-side sorting:', {
                sortField,
                sortDirection,
                projects: processedProjects
              });
            }

            setProjects(processedProjects);
          } else {
            console.warn('No projects found in response:', response.data);
            setProjects([]);
          }

          setTotalProjects(total);
        } catch (error) {
          // Re-throw the error to be handled by the outer try/catch
          throw error;
        } finally {
          // Always clear the timeout to prevent memory leaks
          clearTimeout(timeoutId);
        }
      } catch (err: unknown) {
        let message = 'Failed to fetch projects';

        if (axios.isAxiosError(err)) {
          if (err.name === 'AbortError' || err.message.includes('aborted')) {
            message = 'Request timed out. Please try again later.';
          } else {
            message = err.response?.data?.message || message;
          }

          // Show more detailed error info in console for debugging
          console.error('Error details:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            message: err.message,
          });
        } else if (err instanceof Error) {
          message = err.message;
        }

        console.error('Error fetching projects:', err);
        setError(message);
        toast.error(message);

        // Don't use fallback data anymore - show the error state instead
        setProjects([]);
        setTotalProjects(0);
      } finally {
        setLoading(false);
      }
    },
    [user?.id, /* sortField and sortDirection are provided when the function is called */],
  );

  // Remove fetchTotalProjects function
  // const fetchTotalProjects = useCallback(async () => { ... }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    // Fetch initial set of projects (e.g., first 10)
    fetchProjects(10, 0);
    // No need to call fetchTotalProjects separately
  }, [fetchProjects]);

  // Return the updated interface
  return { projects, totalProjects, loading, error, fetchProjects };
};
