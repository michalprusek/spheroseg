import apiClient from '@/lib/apiClient';

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface DeleteAccountRequest {
  username: string;
  password: string;
}

export interface ApiResponse {
  message: string;
}

class AuthApiService {
  private baseUrl = '/api/auth';

  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/change-password`, data);
      return response.data;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  async deleteAccount(data: DeleteAccountRequest): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/account`, { data });
      return response.data;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }
}

export default new AuthApiService();