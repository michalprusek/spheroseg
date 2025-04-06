import type { Response } from 'express';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function successResponse<T>(res: Response<ApiResponse<T>>, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function errorResponse(res: Response<ApiResponse>, message: string, status = 400): void {
  res.status(status).json({ success: false, error: message });
}