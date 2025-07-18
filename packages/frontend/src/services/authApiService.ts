import apiClient, { isApiSuccess, isApiError, type ApiError } from '@/services/api/client';
import logger from '@/utils/logger';

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface DeleteAccountRequest {
  username: string;
  password: string;
}

export interface AuthApiResponse {
  message: string;
}

class AuthApiService {
  private baseUrl = '/auth';

  async changePassword(data: ChangePasswordRequest): Promise<AuthApiResponse> {
    try {
      const response = await apiClient.put<AuthApiResponse>(`${this.baseUrl}/change-password`, data);
      
      // The new API client already handles standardized responses
      // and throws on error, so if we get here, it's successful
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      logger.error('Error changing password:', {
        message: apiError.message,
        code: apiError.code,
        status: apiError.status,
      });
      throw error;
    }
  }

  async deleteAccount(data: DeleteAccountRequest): Promise<AuthApiResponse> {
    try {
      const response = await apiClient.delete<AuthApiResponse>(`${this.baseUrl}/account`, { data });
      
      // The new API client already handles standardized responses
      // and throws on error, so if we get here, it's successful
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      logger.error('Error deleting account:', {
        message: apiError.message,
        code: apiError.code,
        status: apiError.status,
      });
      throw error;
    }
  }
}

export default new AuthApiService();
