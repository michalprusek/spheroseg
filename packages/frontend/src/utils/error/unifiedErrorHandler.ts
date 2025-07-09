/**
 * Unified Error Handling System
 *
 * Consolidates all error handling approaches into a single, consistent system.
 * This module combines the best features from errorHandling.ts, enhancedErrorHandling.ts, and errorUtils.ts
 */

import { toast } from 'sonner';
import axios, { AxiosError } from 'axios';
import logger from '@/utils/logger';

// ===========================
// Error Types and Enums
// ===========================

export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

// ===========================
// Error Interfaces
// ===========================

export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  details?: any;
  statusCode?: number;
  originalError?: Error;
  timestamp: string;
  context?: Record<string, any>;
}

export interface ApiErrorResponse {
  message?: string;
  error?: string;
  code?: string;
  details?: any;
  statusCode?: number;
}

// ===========================
// Base Error Classes
// ===========================

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly code?: string;
  public readonly details?: any;
  public readonly statusCode?: number;
  public readonly timestamp: string;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    code?: string,
    details?: any,
    statusCode?: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.severity = severity;
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error classes
export class NetworkError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, ErrorType.NETWORK, ErrorSeverity.ERROR, code, details);
  }
}

export class ApiError extends AppError {
  constructor(message: string, statusCode?: number, code?: string, details?: any) {
    super(message, ErrorType.API, ErrorSeverity.ERROR, code, details, statusCode);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.VALIDATION, ErrorSeverity.WARNING, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, code?: string) {
    super(message, ErrorType.AUTHENTICATION, ErrorSeverity.ERROR, code || 'AUTH_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, code?: string) {
    super(message, ErrorType.AUTHORIZATION, ErrorSeverity.ERROR, code || 'AUTHZ_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, resource?: string) {
    super(message, ErrorType.NOT_FOUND, ErrorSeverity.WARNING, 'NOT_FOUND', { resource });
  }
}

export class ServerError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, ErrorType.SERVER, ErrorSeverity.CRITICAL, code || 'SERVER_ERROR', details, 500);
  }
}

export class TimeoutError extends AppError {
  constructor(message: string, timeout?: number) {
    super(message, ErrorType.TIMEOUT, ErrorSeverity.ERROR, 'TIMEOUT', { timeout });
  }
}

// ===========================
// Error Detection Functions
// ===========================

/**
 * Determine the type of error
 */
export function getErrorType(error: unknown): ErrorType {
  if (error instanceof AppError) {
    return error.type;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (!error.response) {
      return error.code === 'ECONNABORTED' ? ErrorType.TIMEOUT : ErrorType.NETWORK;
    }

    switch (status) {
      case 400:
        return ErrorType.VALIDATION;
      case 401:
        return ErrorType.AUTHENTICATION;
      case 403:
        return ErrorType.AUTHORIZATION;
      case 404:
        return ErrorType.NOT_FOUND;
      case 408:
        return ErrorType.TIMEOUT;
      case 500:
      case 502:
      case 503:
      case 504:
        return ErrorType.SERVER;
      default:
        return status && status >= 400 && status < 500 ? ErrorType.CLIENT : ErrorType.API;
    }
  }

  return ErrorType.UNKNOWN;
}

/**
 * Determine error severity based on type and status
 */
export function getErrorSeverity(error: unknown): ErrorSeverity {
  if (error instanceof AppError) {
    return error.severity;
  }

  const type = getErrorType(error);

  switch (type) {
    case ErrorType.VALIDATION:
    case ErrorType.NOT_FOUND:
      return ErrorSeverity.WARNING;
    case ErrorType.SERVER:
      return ErrorSeverity.CRITICAL;
    case ErrorType.AUTHENTICATION:
    case ErrorType.AUTHORIZATION:
    case ErrorType.NETWORK:
    case ErrorType.TIMEOUT:
      return ErrorSeverity.ERROR;
    default:
      return ErrorSeverity.ERROR;
  }
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown, defaultMessage = 'An unexpected error occurred'): string {
  // AppError instances
  if (error instanceof AppError) {
    return error.message;
  }

  // Axios errors
  if (axios.isAxiosError(error)) {
    const response = error.response?.data as ApiErrorResponse;
    return response?.message || response?.error || error.message || defaultMessage;
  }

  // Standard Error
  if (error instanceof Error) {
    return error.message;
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  return defaultMessage;
}

/**
 * Create structured error information
 */
export function createErrorInfo(error: unknown, context?: Record<string, any>): ErrorInfo {
  const type = getErrorType(error);
  const severity = getErrorSeverity(error);
  const message = getErrorMessage(error);

  let code: string | undefined;
  let details: any;
  let statusCode: number | undefined;

  if (error instanceof AppError) {
    code = error.code;
    details = error.details;
    statusCode = error.statusCode;
  } else if (axios.isAxiosError(error)) {
    statusCode = error.response?.status;
    const responseData = error.response?.data as ApiErrorResponse;
    code = responseData?.code || error.code;
    details = responseData?.details || error.response?.data;
  }

  return {
    type,
    severity,
    message,
    code,
    details,
    statusCode,
    originalError: error instanceof Error ? error : new Error(String(error)),
    timestamp: new Date().toISOString(),
    context,
  };
}

// ===========================
// Toast Notification Functions
// ===========================

const toastIds = new Map<string, string>();

/**
 * Show error toast with deduplication
 */
function showErrorToast(errorInfo: ErrorInfo): void {
  const toastKey = `${errorInfo.type}-${errorInfo.message}`;

  // Check if similar toast is already shown
  if (toastIds.has(toastKey)) {
    return;
  }

  let duration = 4000; // Default duration

  // Adjust duration based on severity
  switch (errorInfo.severity) {
    case ErrorSeverity.INFO:
      duration = 3000;
      break;
    case ErrorSeverity.WARNING:
      duration = 3500;
      break;
    case ErrorSeverity.ERROR:
      duration = 4000;
      break;
    case ErrorSeverity.CRITICAL:
      duration = 5000;
      break;
  }

  // Show toast based on severity
  const toastFn =
    errorInfo.severity === ErrorSeverity.INFO
      ? toast.info
      : errorInfo.severity === ErrorSeverity.WARNING
        ? toast.warning
        : toast.error;

  const toastId = toastFn(errorInfo.message, {
    duration,
    id: toastKey,
  });

  // Track toast ID
  toastIds.set(toastKey, toastId as string);

  // Remove from tracking after duration
  setTimeout(() => {
    toastIds.delete(toastKey);
  }, duration);
}

// ===========================
// Main Error Handler
// ===========================

/**
 * Main unified error handler
 */
export function handleError(
  error: unknown,
  options: {
    showToast?: boolean;
    logError?: boolean;
    context?: Record<string, any>;
    customMessage?: string;
  } = {},
): ErrorInfo {
  const { showToast = true, logError = true, context, customMessage } = options;

  // Create structured error info
  const errorInfo = createErrorInfo(error, context);

  // Override message if custom message provided
  if (customMessage) {
    errorInfo.message = customMessage;
  }

  // Log error based on severity
  if (logError) {
    const logData = {
      type: errorInfo.type,
      code: errorInfo.code,
      message: errorInfo.message,
      statusCode: errorInfo.statusCode,
      details: errorInfo.details,
      context: errorInfo.context,
      stack: errorInfo.originalError?.stack,
    };

    switch (errorInfo.severity) {
      case ErrorSeverity.INFO:
        logger.info('Error handled', logData);
        break;
      case ErrorSeverity.WARNING:
        logger.warn('Warning handled', logData);
        break;
      case ErrorSeverity.ERROR:
        logger.error('Error handled', logData);
        break;
      case ErrorSeverity.CRITICAL:
        logger.error('Critical error handled', logData);
        break;
    }
  }

  // Show toast notification
  if (showToast) {
    showErrorToast(errorInfo);
  }

  // Dispatch custom event for global error handling
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:error', { detail: errorInfo }));
  }

  return errorInfo;
}

// ===========================
// Utility Functions
// ===========================

/**
 * Safe async function wrapper
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  options?: Parameters<typeof handleError>[1],
): Promise<{ data?: T; error?: ErrorInfo }> {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    const errorInfo = handleError(error, options);
    return { error: errorInfo };
  }
}

/**
 * Try-catch wrapper for async functions
 */
export async function tryCatch<T>(fn: () => Promise<T>, defaultValue?: T): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, { showToast: false });
    return defaultValue;
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: Record<string, string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .join('\n');
}

/**
 * Check if error is of specific type
 */
export function isErrorType(error: unknown, type: ErrorType): boolean {
  return getErrorType(error) === type;
}

/**
 * Check if error is authentication related
 */
export function isAuthError(error: unknown): boolean {
  const type = getErrorType(error);
  return type === ErrorType.AUTHENTICATION || type === ErrorType.AUTHORIZATION;
}

// ===========================
// Exports
// ===========================

export default {
  handleError,
  safeAsync,
  tryCatch,
  getErrorType,
  getErrorSeverity,
  getErrorMessage,
  createErrorInfo,
  formatValidationErrors,
  isErrorType,
  isAuthError,

  // Error classes
  AppError,
  NetworkError,
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ServerError,
  TimeoutError,

  // Enums
  ErrorType,
  ErrorSeverity,
};
