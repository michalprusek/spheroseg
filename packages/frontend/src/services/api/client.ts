import { configService } from '@/config';
import { useStore } from '@/store';
import toastService from '@/services/toastService';
import logger from '@/utils/logger';

/**
 * Unified API Client for SpherosegV4
 * Provides a consistent interface for all API calls with built-in features:
 * - Automatic authentication
 * - Request/response interceptors
 * - Error handling
 * - Request cancellation
 * - Retry logic
 * - Loading state management
 */

// Types
export interface ApiRequestConfig extends RequestInit {
  // Custom options
  skipAuth?: boolean;
  showErrorToast?: boolean;
  retryCount?: number;
  timeout?: number;
  onUploadProgress?: (progress: number) => void;
  cancelToken?: AbortController;
  // Request data
  params?: Record<string, any>;
  data?: any;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
  config: ApiRequestConfig;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  data?: any;
  config?: ApiRequestConfig;
}

// Default configuration
const DEFAULT_CONFIG: Partial<ApiRequestConfig> = {
  showErrorToast: true,
  retryCount: 0,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// Retry configuration
const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const RETRY_DELAY = 1000; // Base delay in ms

class ApiClient {
  private baseURL: string;
  private requestInterceptors: Array<(config: ApiRequestConfig) => ApiRequestConfig | Promise<ApiRequestConfig>> = [];
  private responseInterceptors: Array<{
    onFulfilled?: (response: ApiResponse) => ApiResponse | Promise<ApiResponse>;
    onRejected?: (error: ApiError) => any;
  }> = [];
  private activeRequests = new Map<string, AbortController>();

  constructor() {
    this.baseURL = this.getBaseURL();
    this.setupDefaultInterceptors();
  }

  /**
   * Get base URL from configuration
   */
  private getBaseURL(): string {
    const apiUrl = configService.get<string>('api.baseUrl');
    const apiPrefix = configService.get<string>('api.prefix', '/api');
    return `${apiUrl}${apiPrefix}`;
  }

  /**
   * Setup default interceptors
   */
  private setupDefaultInterceptors() {
    // Request interceptor for authentication
    this.addRequestInterceptor((config) => {
      if (!config.skipAuth) {
        const token = useStore.getState().tokens?.accessToken;
        if (token) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token}`,
          };
        }
      }
      return config;
    });

    // Response interceptor for error handling
    this.addResponseInterceptor(undefined, async (error) => {
      // Handle 401 Unauthorized
      if (error.status === 401 && !error.config?.skipAuth) {
        // Try to refresh token
        try {
          await this.refreshToken();
          // Retry the original request
          return this.request(error.config!);
        } catch (refreshError) {
          // Refresh failed, logout user
          useStore.getState().logout();
          if (error.config?.showErrorToast) {
            toastService.error('Session expired. Please login again.');
          }
          throw error;
        }
      }

      // Handle other errors
      if (error.config?.showErrorToast) {
        const message = this.getErrorMessage(error);
        toastService.error(message);
      }

      throw error;
    });
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: (config: ApiRequestConfig) => ApiRequestConfig | Promise<ApiRequestConfig>) {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(
    onFulfilled?: (response: ApiResponse) => ApiResponse | Promise<ApiResponse>,
    onRejected?: (error: ApiError) => any,
  ) {
    this.responseInterceptors.push({ onFulfilled, onRejected });
  }

  /**
   * Make API request
   */
  async request<T = any>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    // Merge with default config
    let requestConfig: ApiRequestConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      headers: {
        ...DEFAULT_CONFIG.headers,
        ...config.headers,
      },
    };

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      requestConfig = await interceptor(requestConfig);
    }

    // Create abort controller for timeout and cancellation
    const abortController = config.cancelToken || new AbortController();
    const timeoutId = config.timeout ? setTimeout(() => abortController.abort(), config.timeout) : undefined;

    // Build URL with params
    const url = this.buildUrl(config.url || '', config.params);

    // Prepare request body
    const body = this.prepareBody(config.data, requestConfig.headers);

    // Track active request
    const requestKey = `${config.method || 'GET'} ${url}`;
    this.activeRequests.set(requestKey, abortController);

    try {
      // Make request
      const response = await fetch(url, {
        ...requestConfig,
        body,
        signal: abortController.signal,
      });

      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Parse response
      const responseData = await this.parseResponse<T>(response);

      // Create API response
      let apiResponse: ApiResponse<T> = {
        data: responseData,
        status: response.status,
        headers: response.headers,
        config: requestConfig,
      };

      // Apply response interceptors
      for (const { onFulfilled } of this.responseInterceptors) {
        if (onFulfilled) {
          apiResponse = await onFulfilled(apiResponse);
        }
      }

      // Handle non-2xx status codes
      if (!response.ok) {
        throw this.createError(response.status, responseData, requestConfig);
      }

      return apiResponse;
    } catch (error: any) {
      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Handle abort
      if (error.name === 'AbortError') {
        throw this.createError(0, 'Request cancelled', requestConfig);
      }

      // Create API error
      const apiError = this.normalizeError(error, requestConfig);

      // Apply error interceptors
      for (const { onRejected } of this.responseInterceptors) {
        if (onRejected) {
          try {
            return await onRejected(apiError);
          } catch (interceptorError) {
            // Continue with original error if interceptor fails
          }
        }
      }

      // Retry logic
      if (config.retryCount && config.retryCount > 0 && this.shouldRetry(apiError)) {
        const delay = RETRY_DELAY * (config.retryCount || 1);
        await new Promise((resolve) => setTimeout(resolve, delay));

        logger.info(`Retrying request: ${requestKey}`);
        return this.request({
          ...config,
          retryCount: (config.retryCount || 1) - 1,
        });
      }

      throw apiError;
    } finally {
      // Clean up active request
      this.activeRequests.delete(requestKey);
    }
  }

  /**
   * GET request
   */
  get<T = any>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'GET',
      url,
    });
  }

  /**
   * POST request
   */
  post<T = any>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'POST',
      url,
      data,
    });
  }

  /**
   * PUT request
   */
  put<T = any>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'PUT',
      url,
      data,
    });
  }

  /**
   * PATCH request
   */
  patch<T = any>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'PATCH',
      url,
      data,
    });
  }

  /**
   * DELETE request
   */
  delete<T = any>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...config,
      method: 'DELETE',
      url,
    });
  }

  /**
   * Upload file with progress
   */
  async upload<T = any>(url: string, file: File | FormData, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    const formData = file instanceof FormData ? file : new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    }

    // Remove Content-Type header to let browser set it with boundary
    const headers = { ...config?.headers };
    delete headers['Content-Type'];

    return this.request<T>({
      ...config,
      method: 'POST',
      url,
      data: formData,
      headers,
    });
  }

  /**
   * Cancel request
   */
  cancel(url: string, method = 'GET') {
    const requestKey = `${method} ${this.buildUrl(url)}`;
    const controller = this.activeRequests.get(requestKey);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestKey);
    }
  }

  /**
   * Cancel all active requests
   */
  cancelAll() {
    this.activeRequests.forEach((controller) => controller.abort());
    this.activeRequests.clear();
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return `${url}?${searchParams.toString()}`;
  }

  /**
   * Prepare request body
   */
  private prepareBody(data: any, headers: any): any {
    if (!data) return undefined;

    // FormData should be sent as-is
    if (data instanceof FormData) return data;

    // JSON stringify for JSON content type
    if (headers['Content-Type']?.includes('application/json')) {
      return JSON.stringify(data);
    }

    return data;
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return response.json();
    } else if (contentType?.includes('text/')) {
      return response.text() as any;
    } else if (response.status === 204) {
      return null as any;
    } else {
      return response.blob() as any;
    }
  }

  /**
   * Create API error
   */
  private createError(status: number, data: any, config: ApiRequestConfig): ApiError {
    return {
      message: this.getErrorMessage({ status, data }),
      status,
      data,
      config,
    };
  }

  /**
   * Normalize error to ApiError format
   */
  private normalizeError(error: any, config: ApiRequestConfig): ApiError {
    if (error.status !== undefined) {
      return error;
    }

    return {
      message: error.message || 'An error occurred',
      status: 0,
      data: error,
      config,
    };
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: ApiError | { status?: number; data?: any }): string {
    // Check for server error message
    if (typeof error.data === 'object' && error.data?.message) {
      return error.data.message;
    }

    if (typeof error.data === 'string') {
      return error.data;
    }

    // Status code messages
    switch (error.status) {
      case 400:
        return 'Bad request. Please check your input.';
      case 401:
        return 'Unauthorized. Please login again.';
      case 403:
        return "Access forbidden. You don't have permission.";
      case 404:
        return 'Resource not found.';
      case 409:
        return 'Conflict. The resource already exists.';
      case 422:
        return 'Validation failed. Please check your input.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Service unavailable. Please try again later.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  /**
   * Check if request should be retried
   */
  private shouldRetry(error: ApiError): boolean {
    return RETRY_STATUS_CODES.includes(error.status || 0);
  }

  /**
   * Refresh authentication token
   */
  private async refreshToken(): Promise<void> {
    const refreshToken = useStore.getState().tokens?.refreshToken;
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.post(
      '/auth/refresh',
      { refreshToken },
      {
        skipAuth: true,
        showErrorToast: false,
      },
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data;
    useStore.getState().setTokens({
      accessToken,
      refreshToken: newRefreshToken || refreshToken,
    });
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Export types
export type { ApiClient };
export default apiClient;
