import apiClient from './client';

/**
 * Type-safe API endpoints for SpherosegV4
 * Provides a clean interface for all API calls with proper typing
 */

// Types for API responses
export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  userId: string;
  public: boolean;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Image {
  id: string;
  projectId: string;
  filename: string;
  originalName: string;
  size: number;
  width: number;
  height: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Segment {
  id: string;
  imageId: string;
  polygon: Array<{ x: number; y: number }>;
  type: string;
  confidence?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
  public?: boolean;
}

export interface UpdateProjectRequest {
  title?: string;
  description?: string;
  public?: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  q?: string;
}

// API Endpoints
export const api = {
  // Authentication
  auth: {
    login: (data: LoginRequest) => apiClient.post<AuthTokens>('/auth/login', data),

    register: (data: RegisterRequest) => apiClient.post<AuthTokens>('/auth/register', data),

    logout: () => apiClient.post('/auth/logout'),

    refresh: (refreshToken: string) =>
      apiClient.post<AuthTokens>('/auth/refresh', { refreshToken }, { skipAuth: true }),

    forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),

    resetPassword: (token: string, password: string) => apiClient.post('/auth/reset-password', { token, password }),

    verifyEmail: (token: string) => apiClient.post('/auth/verify-email', { token }),
  },

  // Users
  users: {
    me: () => apiClient.get<User>('/users/me'),

    update: (data: Partial<User>) => apiClient.patch<User>('/users/me', data),

    updatePassword: (currentPassword: string, newPassword: string) =>
      apiClient.patch('/users/me/password', { currentPassword, newPassword }),

    updatePreferences: (preferences: Record<string, any>) => apiClient.patch('/users/preferences', preferences),

    delete: (password: string) => apiClient.delete('/users/me', { data: { password } }),

    uploadAvatar: (file: File) => apiClient.upload<{ url: string }>('/users/me/avatar', file),

    deleteAvatar: () => apiClient.delete('/users/me/avatar'),
  },

  // Projects
  projects: {
    list: (params?: SearchParams) => apiClient.get<{ data: Project[]; total: number }>('/projects', { params }),

    get: (id: string) => apiClient.get<Project>(`/projects/${id}`),

    create: (data: CreateProjectRequest) => apiClient.post<Project>('/projects', data),

    update: (id: string, data: UpdateProjectRequest) => apiClient.patch<Project>(`/projects/${id}`, data),

    delete: (id: string) => apiClient.delete(`/projects/${id}`),

    duplicate: (id: string, options?: { includeImages?: boolean; includeSegmentations?: boolean }) =>
      apiClient.post<{ taskId: string }>(`/projects/${id}/duplicate`, options),

    export: (id: string, format: 'json' | 'csv' | 'zip') =>
      apiClient.get(`/projects/${id}/export`, {
        params: { format },
        headers: { Accept: 'application/octet-stream' },
      }),

    share: (id: string, email: string, permission: 'view' | 'edit') =>
      apiClient.post(`/projects/${id}/share`, { email, permission }),

    unshare: (id: string, userId: string) => apiClient.delete(`/projects/${id}/share/${userId}`),
  },

  // Images
  images: {
    list: (projectId: string, params?: SearchParams) =>
      apiClient.get<{ data: Image[]; total: number }>(`/projects/${projectId}/images`, { params }),

    get: (id: string) => apiClient.get<Image>(`/images/${id}`),

    upload: (projectId: string, files: File[], options?: { autoSegment?: boolean }) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (options?.autoSegment) {
        formData.append('autoSegment', 'true');
      }
      return apiClient.upload<{ images: Image[] }>(`/projects/${projectId}/images`, formData);
    },

    update: (id: string, data: Partial<Image>) => apiClient.patch<Image>(`/images/${id}`, data),

    delete: (id: string) => apiClient.delete(`/images/${id}`),

    deleteMany: (ids: string[]) => apiClient.post('/images/delete-many', { ids }),

    segment: (id: string) => apiClient.post<{ taskId: string }>(`/images/${id}/segment`),

    segmentMany: (ids: string[]) => apiClient.post<{ taskId: string }>('/images/segment-many', { ids }),
  },

  // Segmentation
  segmentation: {
    getSegments: (imageId: string) => apiClient.get<Segment[]>(`/segmentation/segments/${imageId}`),

    createSegment: (imageId: string, polygon: Array<{ x: number; y: number }>, type?: string) =>
      apiClient.post<Segment>('/segmentation/segments', { imageId, polygon, type }),

    updateSegment: (id: string, data: Partial<Segment>) =>
      apiClient.patch<Segment>(`/segmentation/segments/${id}`, data),

    deleteSegment: (id: string) => apiClient.delete(`/segmentation/segments/${id}`),

    process: (imageId: string, options?: { model?: string; threshold?: number }) =>
      apiClient.post<{ taskId: string }>(`/segmentation/process/${imageId}`, options),

    export: (imageId: string, format: 'json' | 'mask' | 'coco' | 'yolo') =>
      apiClient.post('/segmentation/export', { imageId, format }),
  },

  // Metadata
  metadata: {
    update: (id: string, metadata: Record<string, any>) => apiClient.patch(`/metadata/${id}`, metadata),

    search: (query: string, type?: 'image' | 'project' | 'segment') =>
      apiClient.get<any[]>('/metadata/search', { params: { q: query, type } }),

    batchUpdate: (updates: Array<{ id: string; metadata: Record<string, any> }>) =>
      apiClient.patch('/metadata/batch', { updates }),

    enrich: (ids: string[], provider: 'openai' | 'custom') => apiClient.post('/metadata/enrich', { ids, provider }),

    statistics: (projectId?: string) =>
      apiClient.get<Record<string, any>>('/metadata/statistics', { params: { projectId } }),
  },

  // Notifications
  notifications: {
    sendEmail: (to: string, subject: string, body: string) =>
      apiClient.post('/notifications/email', { to, subject, body }),

    subscribe: (subscription: PushSubscription) => apiClient.post('/notifications/subscribe', subscription),

    unsubscribe: (endpoint: string) => apiClient.post('/notifications/unsubscribe', { endpoint }),

    getHistory: (params?: PaginationParams) =>
      apiClient.get<{ data: any[]; total: number }>('/notifications/history', { params }),
  },

  // Tasks (for async operations)
  tasks: {
    get: (taskId: string) =>
      apiClient.get<{
        id: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        progress?: number;
        result?: any;
        error?: string;
      }>(`/tasks/${taskId}`),

    cancel: (taskId: string) => apiClient.post(`/tasks/${taskId}/cancel`),
  },

  // Statistics
  stats: {
    overview: () =>
      apiClient.get<{
        totalProjects: number;
        totalImages: number;
        totalSegmentations: number;
        storageUsed: number;
      }>('/stats/overview'),

    project: (projectId: string) => apiClient.get<Record<string, any>>(`/stats/projects/${projectId}`),

    user: () => apiClient.get<Record<string, any>>('/stats/user'),
  },
};

// Export individual namespaces for convenience
export const authApi = api.auth;
export const usersApi = api.users;
export const projectsApi = api.projects;
export const imagesApi = api.images;
export const segmentationApi = api.segmentation;
export const metadataApi = api.metadata;
export const notificationsApi = api.notifications;
export const tasksApi = api.tasks;
export const statsApi = api.stats;

export default api;
