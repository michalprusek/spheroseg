// API Configuration

// Use environment variable or dynamically determine API URL based on current host/port
export const API_BASE_URL = (() => {
  // Server-side: use environment variable or default to localhost:8000
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }
  
  // Client-side: use localhost:8000 to ensure consistent access
  // Avoid using dynamic hostname which may vary based on docker networking
  return 'http://localhost:8000';
})();

// Authentication endpoints
export const AUTH_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/token`,
  register: `${API_BASE_URL}/auth/register`,
  refresh: `${API_BASE_URL}/auth/refresh`,
  logout: `${API_BASE_URL}/auth/logout`,
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
export const getValidToken = async (): Promise<string | null> => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    // For now, simply return the token
    // Later we can add token validation (checking expiry via JWT decode)
    return token;
  } catch (error) {
    // Handle cases where localStorage isn't available
    console.error("Error accessing localStorage:", error);
    return null;
  }
};

// Helper function to handle relogin when session expires
export const handleSessionExpired = () => {
  try {
    // Clear tokens
    localStorage.removeItem('token');
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Redirect to login if we're in a browser context
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  } catch (error) {
    console.error("Error handling session expiration:", error);
  }
};

// Helper function to check if we're in offline mode
export const isOfflineMode = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    
    const token = localStorage.getItem('token');
    return token === "offline_mode_dummy_token";
  } catch {
    return false;
  }
};

// Helper function to fetch with authentication
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  try {
    // Check if we're in offline mode
    if (isOfflineMode()) {
      // In offline mode, we'll simulate a failed request without logging errors
      return new Response(JSON.stringify({ detail: "Offline mode active" }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get a valid token
    const token = await getValidToken();
    if (!token) {
      // No token available, redirect to login
      handleSessionExpired();
      throw new Error('No authentication token available');
    }
    
    // Set up headers with authentication
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    
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
    // Provide more descriptive error for network issues but don't log in offline mode
    if (!isOfflineMode()) {
      console.error('Error in fetchWithAuth:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error: Could not connect to the API server');
        throw new Error('Network error: Could not connect to the API server');
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Request timeout: The server took too long to respond');
        throw new Error('Request timeout: The server took too long to respond');
      }
    }
    throw error;
  }
};

// Helper function to handle API errors
export const handleApiError = async (response: Response) => {
  if (!response.ok) {
    try {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'An error occurred');
    } catch (e) {
      // If we can't parse the JSON, throw a generic error with the status
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
  }
  return response;
};