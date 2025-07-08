import apiClient from '@/lib/apiClient';

// Email verification
export const sendVerificationEmail = async (email: string) => {
  const response = await apiClient.post('/auth/send-verification-email', { email });
  return response.data;
};

export const verifyEmail = async (token: string) => {
  const response = await apiClient.get('/auth/verify-email', { params: { token } });
  return response.data;
};