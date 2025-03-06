// API Configuration

// V prohlížeči musíme vždy použít localhost:8000, protože prohlížeč nemůže přeložit názvy Docker kontejnerů
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Authentication endpoints
export const AUTH_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/token`,
  register: `${API_BASE_URL}/auth/register`,
};

// User endpoints
export const USER_ENDPOINTS = {
  me: `${API_BASE_URL}/users/me`,
  myProjects: `${API_BASE_URL}/users/me/projects`,
  update: `${API_BASE_URL}/users/me`,
  uploadProfilePicture: `${API_BASE_URL}/users/me/profile-picture`,
  profilePictureUrl: `${API_BASE_URL}/users/me/profile-picture-url`,
};

// Project endpoints
export const PROJECT_ENDPOINTS = {
  list: `${API_BASE_URL}/projects`,
  detail: (id: number) => `${API_BASE_URL}/projects/${id}`,
  create: `${API_BASE_URL}/projects`,
  update: (id: number) => `${API_BASE_URL}/projects/${id}`,
  delete: (id: number) => `${API_BASE_URL}/projects/${id}`,
};

// Image endpoints
export const IMAGE_ENDPOINTS = {
  upload: `${API_BASE_URL}/images/upload`,
  list: (projectId: number) => `${API_BASE_URL}/images/${projectId}`,
  url: (imageId: number) => `${API_BASE_URL}/images/${imageId}/url`,
  segmentationUrl: (imageId: number) => `${API_BASE_URL}/images/${imageId}/segmentation/url`,
  delete: (imageId: number) => `${API_BASE_URL}/images/${imageId}`,
  status: (imageId: number) => `${API_BASE_URL}/images/${imageId}/status`,
};

// Segmentation endpoints
export const SEGMENTATION_ENDPOINTS = {
  status: (imageId: number) => `${API_BASE_URL}/segmentation/${imageId}`,
  update: (segmentationId: number) => `${API_BASE_URL}/segmentation/${segmentationId}/update`,
};

// Token management

// Function to get a valid token
const getValidToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  // For now, simply return the token
  // Later we can add token validation (checking expiry via JWT decode)
  return token;
};

// Helper function to handle relogin when session expires
const handleSessionExpired = () => {
  // Clear tokens
  localStorage.removeItem('token');
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  
  // Redirect to login
  window.location.href = '/login';
};

// Helper function to fetch with authentication
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  try {
    // Get a valid token
    const token = await getValidToken();
    if (!token) {
      // No token available, redirect to login
      handleSessionExpired();
      throw new Error('No authentication token available');
    }
    
    // Set up headers
    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
    };
    
    // Make the request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // If unauthorized, likely token expired
    if (response.status === 401) {
      console.log('Unauthorized request, session likely expired');
      handleSessionExpired();
      throw new Error('Unauthorized: Session expired');
    }
    
    return response;
  } catch (error) {
    console.error('Error in fetchWithAuth:', error);
    // Provide more descriptive error for network issues
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error: Could not connect to the API server');
      throw new Error('Network error: Could not connect to the API server');
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('Request timeout: The server took too long to respond');
      throw new Error('Request timeout: The server took too long to respond');
    }
    throw error;
  }
};

// Helper function to handle API errors
export const handleApiError = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'An error occurred');
  }
  return response;
}; 