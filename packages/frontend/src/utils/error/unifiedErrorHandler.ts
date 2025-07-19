/**
 * Unified Error Handling System
 *
 * Consolidates all error handling approaches into a single, consistent system.
 * This module combines the best features from errorHandling.ts, enhancedErrorHandling.ts, and errorUtils.ts
 */

import { toast } from 'sonner';
import axios from 'axios';
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
  details?: unknown;
  statusCode?: number;
  originalError?: Error;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  message?: string;
  error?: string;
  code?: string;
  details?: unknown;
  statusCode?: number;
}

// ===========================
// Base Error Classes
// ===========================

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly statusCode?: number;
  public readonly timestamp: string;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    code?: string,
    details?: unknown,
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
  constructor(message = 'Network error. Please check your connection.', code?: string, details?: unknown) {
    super(message, ErrorType.NETWORK, ErrorSeverity.ERROR, code, details);
  }
}

export class ApiError extends AppError {
  constructor(message = 'API error. Please try again later.', statusCode?: number, code?: string, details?: unknown) {
    super(message, ErrorType.API, ErrorSeverity.ERROR, code, details, statusCode);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation error. Please check your input.', details?: unknown) {
    super(message, ErrorType.VALIDATION, ErrorSeverity.ERROR, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication error. Please sign in again.', code?: string) {
    super(message, ErrorType.AUTHENTICATION, ErrorSeverity.ERROR, code || 'AUTH_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You don't have permission to perform this action.", code?: string) {
    super(message, ErrorType.AUTHORIZATION, ErrorSeverity.ERROR, code || 'AUTHZ_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.', resource?: string) {
    super(message, ErrorType.NOT_FOUND, ErrorSeverity.ERROR, 'NOT_FOUND', { resource });
  }
}

export class ServerError extends AppError {
  constructor(message?: string | { severity?: ErrorSeverity; code?: string }, code?: string, details?: unknown) {
    // Handle both old and new constructor patterns
    if (typeof message === 'object' && message !== null) {
      const options = message;
      super(
        'Server error. Please try again later.',
        ErrorType.SERVER,
        options.severity || ErrorSeverity.ERROR,
        options.code || 'SERVER_ERROR',
        undefined,
        500,
      );
    } else {
      super(
        message || 'Server error. Please try again later.',
        ErrorType.SERVER,
        ErrorSeverity.ERROR,
        code || 'SERVER_ERROR',
        details,
        500,
      );
    }
  }
}

export class TimeoutError extends AppError {
  constructor(message = 'Request timed out. Please try again.', timeout?: number) {
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
      // Check for network-related error codes
      if (error.code === 'ECONNABORTED') return ErrorType.TIMEOUT;
      if (error.code === 'ERR_NETWORK' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return ErrorType.NETWORK;
      }
      // Default to NETWORK for axios errors without response
      return ErrorType.NETWORK;
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

  // Check for network errors in standard Error messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('timeout')) {
      return ErrorType.TIMEOUT;
    }
  }

  // Check for string errors that might indicate client errors
  if (typeof error === 'string') {
    const message = error.toLowerCase();
    if (message.includes('invalid') || message.includes('required') || message.includes('must')) {
      return ErrorType.CLIENT;
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
      return ErrorSeverity.ERROR; // Changed from CRITICAL to ERROR to match tests
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
export function getErrorMessage(
  error: unknown,
  defaultMessage = 'An unknown error occurred. Please try again.',
): string {
  // AppError instances
  if (error instanceof AppError) {
    return error.message;
  }

  // Axios errors
  if (axios.isAxiosError(error)) {
    const response = error.response?.data as ApiErrorResponse;
    const message = response?.message || response?.error || error.message;

    // Special handling for 404 errors to distinguish between "not found" and "access denied"
    if (error.response?.status === 404 && message) {
      // Check if the message indicates an access issue rather than true "not found"
      if (message.toLowerCase().includes('access denied') || message.toLowerCase().includes('permission')) {
        return message; // Return the actual message that clarifies it's an access issue
      }
    }

    // Provide default messages based on error type
    if (!message || message === 'Network Error') {
      const type = getErrorType(error);
      switch (type) {
        case ErrorType.NETWORK:
          return 'Network error. Please check your connection.';
        case ErrorType.TIMEOUT:
          return 'Request timed out. Please try again.';
        case ErrorType.AUTHENTICATION:
          return 'Authentication failed. Please sign in again.';
        case ErrorType.AUTHORIZATION:
          return "You don't have permission to perform this action.";
        case ErrorType.NOT_FOUND:
          return 'The requested resource was not found.';
        case ErrorType.SERVER:
          return 'Server error. Please try again later.';
        case ErrorType.VALIDATION:
          return 'Validation error. Please check your input.';
        default:
          return message || defaultMessage;
      }
    }

    return message;
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
export function createErrorInfo(error: unknown, context?: Record<string, unknown>): ErrorInfo {
  const type = getErrorType(error);
  const severity = getErrorSeverity(error);
  const message = getErrorMessage(error);

  let code: string | undefined;
  let details: unknown;
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
const accessDeniedTimestamps = new Map<string, number>();
const ACCESS_DENIED_SUPPRESSION_WINDOW = 30000; // 30 seconds

/**
 * Check if a notification should be suppressed based on recent access denied errors
 */
function shouldSuppressNotification(errorInfo: ErrorInfo): boolean {
  const now = Date.now();
  
  // Clean up old timestamps
  for (const [key, timestamp] of accessDeniedTimestamps.entries()) {
    if (now - timestamp > ACCESS_DENIED_SUPPRESSION_WINDOW) {
      accessDeniedTimestamps.delete(key);
    }
  }
  
  // Check if this is an access denied error that we should track
  const isAccessDenied = 
    errorInfo.type === ErrorType.AUTHORIZATION ||
    (errorInfo.type === ErrorType.SERVER && errorInfo.message.toLowerCase().includes('permission')) ||
    errorInfo.message.toLowerCase().includes('access denied') ||
    errorInfo.message.toLowerCase().includes('do not have permission');
  
  if (isAccessDenied) {
    // Extract a context key from the error (e.g., resource type from the message)
    const contextKey = extractContextKey(errorInfo);
    accessDeniedTimestamps.set(contextKey, now);
    logger.debug('Tracked access denied error', { contextKey, message: errorInfo.message });
    return false; // Don't suppress the access denied error itself
  }
  
  // Check if this is a secondary error that should be suppressed
  const isSecondaryError = 
    errorInfo.type === ErrorType.NOT_FOUND ||
    (errorInfo.severity === ErrorSeverity.WARNING && errorInfo.context?.context?.includes('segmentation'));
  
  logger.debug('Checking for secondary error', {
    isSecondaryError,
    errorType: errorInfo.type,
    expectedType: ErrorType.NOT_FOUND,
    typeMatch: errorInfo.type === ErrorType.NOT_FOUND,
    severity: errorInfo.severity,
    message: errorInfo.message,
  });
  
  if (isSecondaryError) {
    // Check if there was a recent access denied error for a similar context
    const contextKey = extractContextKey(errorInfo);
    logger.debug('Checking if secondary error should be suppressed', {
      contextKey,
      message: errorInfo.message,
      existingKeys: Array.from(accessDeniedTimestamps.keys()),
    });
    
    for (const [key, timestamp] of accessDeniedTimestamps.entries()) {
      if (now - timestamp <= ACCESS_DENIED_SUPPRESSION_WINDOW) {
        // Check if the contexts are related
        if (areContextsRelated(key, contextKey)) {
          logger.debug('Suppressing secondary notification due to recent access denied error', {
            suppressedError: errorInfo.message,
            relatedAccessDeniedKey: key,
            contextKey,
            errorType: errorInfo.type,
            errorSeverity: errorInfo.severity,
          });
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Extract a context key from error info for tracking related errors
 */
function extractContextKey(errorInfo: ErrorInfo): string {
  // Try to extract resource type or operation from the message or context
  const message = errorInfo.message.toLowerCase();
  const context = errorInfo.context?.context?.toLowerCase() || '';
  
  let key = errorInfo.type;
  
  if (message.includes('image') || context.includes('image')) {
    key = 'image-operation';
  } else if (message.includes('project') || context.includes('project')) {
    key = 'project-operation';
  } else if (message.includes('segmentation') || context.includes('segmentation')) {
    key = 'segmentation-operation';
  }
  
  logger.debug('Extracted context key', {
    message,
    context,
    extractedKey: key,
    errorType: errorInfo.type,
  });
  
  return key;
}

/**
 * Check if two context keys are related
 */
function areContextsRelated(key1: string, key2: string): boolean {
  // Consider contexts related if they're the same or if one is a subset of the other
  if (key1 === key2) return true;
  
  // Special cases for related operations
  const relatedContexts = [
    ['image-operation', 'segmentation-operation'],
    ['project-operation', 'image-operation'],
  ];
  
  for (const [a, b] of relatedContexts) {
    if ((key1 === a && key2 === b) || (key1 === b && key2 === a)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Show error toast with deduplication
 */
function showErrorToast(errorInfo: ErrorInfo): void {
  logger.debug('showErrorToast called', {
    type: errorInfo.type,
    severity: errorInfo.severity,
    message: errorInfo.message,
  });
  
  // Check if we should suppress this notification due to recent access denied error
  if (shouldSuppressNotification(errorInfo)) {
    logger.debug('Toast suppressed by shouldSuppressNotification');
    return;
  }

  const toastKey = `${errorInfo.type}-${errorInfo.message}`;

  // Check if similar toast is already shown
  if (toastIds.has(toastKey)) {
    logger.debug('Toast suppressed - already shown', { toastKey });
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
    context?: Record<string, unknown>;
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

/**
 * Clear access denied suppression cache
 * Useful when navigating to a new page or context
 */
export function clearAccessDeniedSuppression(): void {
  accessDeniedTimestamps.clear();
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
  clearAccessDeniedSuppression,

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
