import apiClient from './client';

// Interface pro projekt
export interface Project {
  id: string;
  title: string;
  description: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    images: number;
  };
}

export interface ProjectsResponse {
  status: string;
  data: Project[];
}

export interface ProjectResponse {
  status: string;
  data: Project;
}

/**
 * Získání seznamu projektů
 */
export const getProjects = async (
  sortField: string = 'updatedAt',
  sortDirection: 'asc' | 'desc' = 'desc'
): Promise<ProjectsResponse> => {
  try {
    const response = await apiClient.get('/projects', {
      params: {
        sortField,
        sortDirection
      }
    });
    return response;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
};

/**
 * Získání detailu projektu
 */
export const getProject = async (id: string): Promise<ProjectResponse> => {
  try {
    const response = await apiClient.get(`/projects/${id}`);
    return response;
  } catch (error) {
    console.error(`Error fetching project ${id}:`, error);
    throw error;
  }
};

/**
 * Vytvoření nového projektu
 */
export const createProject = async (
  data: { title: string; description: string }
): Promise<ProjectResponse> => {
  try {
    const response = await apiClient.post('/projects', data);
    return response;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

/**
 * Aktualizace projektu
 */
export const updateProject = async (
  id: string,
  data: { title?: string; description?: string }
): Promise<ProjectResponse> => {
  try {
    const response = await apiClient.put(`/projects/${id}`, data);
    return response;
  } catch (error) {
    console.error(`Error updating project ${id}:`, error);
    throw error;
  }
};

/**
 * Smazání projektu
 */
export const deleteProject = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/projects/${id}`);
  } catch (error) {
    console.error(`Error deleting project ${id}:`, error);
    throw error;
  }
}; 