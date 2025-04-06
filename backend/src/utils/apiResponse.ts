import { Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export function apiResponse<T>(
  res: Response<ApiResponse<T>>,
  data: T | string,
  statusCode = 200
): void {
  if (typeof data === 'string') {
    res.status(statusCode).json({
      success: statusCode < 400,
      message: data
    });
  } else {
    res.status(statusCode).json({
      success: true,
      data
    });
  }
}