import { toast } from "sonner";
import logger from "./logger";
import { AxiosError } from "axios";

/**
 * Error types for better categorization
 */
export enum ErrorType {
  NETWORK = "network",
  API = "api",
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  NOT_FOUND = "not_found",
  SERVER = "server",
  CLIENT = "client",
  UNKNOWN = "unknown",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

/**
 * Interface for structured error information
 */
export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string | number;
  details?: Record<string, any>;
  originalError?: Error | unknown;
  handled?: boolean;
}

/**
 * Default error messages by error type
 */
const DEFAULT_ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NETWORK]: "Network error. Please check your connection.",
  [ErrorType.API]: "API error. Please try again later.",
  [ErrorType.VALIDATION]: "Validation error. Please check your input.",
  [ErrorType.AUTHENTICATION]: "Authentication error. Please sign in again.",
  [ErrorType.AUTHORIZATION]: "You don't have permission to perform this action.",
  [ErrorType.NOT_FOUND]: "The requested resource was not found.",
  [ErrorType.SERVER]: "Server error. Please try again later.",
  [ErrorType.CLIENT]: "An error occurred in the application.",
  [ErrorType.UNKNOWN]: "An unknown error occurred. Please try again.",
};

/**
 * Map HTTP status codes to error types
 */
const HTTP_STATUS_TO_ERROR_TYPE: Record<number, ErrorType> = {
  400: ErrorType.VALIDATION,
  401: ErrorType.AUTHENTICATION,
  403: ErrorType.AUTHORIZATION,
  404: ErrorType.NOT_FOUND,
  500: ErrorType.SERVER,
  502: ErrorType.SERVER,
  503: ErrorType.SERVER,
  504: ErrorType.SERVER,
};

/**
 * Map HTTP status codes to error severity
 */
const HTTP_STATUS_TO_SEVERITY: Record<number, ErrorSeverity> = {
  400: ErrorSeverity.WARNING,
  401: ErrorSeverity.WARNING,
  403: ErrorSeverity.WARNING,
  404: ErrorSeverity.WARNING,
  500: ErrorSeverity.ERROR,
  502: ErrorSeverity.ERROR,
  503: ErrorSeverity.ERROR,
  504: ErrorSeverity.ERROR,
};

/**
 * Determine error type from an error object
 */
export function getErrorType(error: unknown): ErrorType {
  if (error instanceof AxiosError) {
    if (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") {
      return ErrorType.NETWORK;
    }

    const status = error.response?.status;
    if (status && HTTP_STATUS_TO_ERROR_TYPE[status]) {
      return HTTP_STATUS_TO_ERROR_TYPE[status];
    }

    return ErrorType.API;
  }

  if (error instanceof TypeError || error instanceof SyntaxError) {
    return ErrorType.CLIENT;
  }

  if (error instanceof Error) {
    if (error.message.includes("network") || error.message.includes("connection")) {
      return ErrorType.NETWORK;
    }
  }

  return ErrorType.UNKNOWN;
}

/**
 * Determine error severity from an error object
 */
export function getErrorSeverity(error: unknown): ErrorSeverity {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status && HTTP_STATUS_TO_SEVERITY[status]) {
      return HTTP_STATUS_TO_SEVERITY[status];
    }

    return ErrorSeverity.ERROR;
  }

  if (error instanceof TypeError || error instanceof SyntaxError) {
    return ErrorSeverity.ERROR;
  }

  return ErrorSeverity.ERROR;
}

/**
 * Extract error message from an error object
 */
export function getErrorMessage(error: unknown, fallbackMessage?: string): string {
  if (error instanceof AxiosError) {
    // Try to get message from response data
    const responseData = error.response?.data;
    if (responseData) {
      if (typeof responseData === "string") {
        return responseData;
      }
      if (responseData.message) {
        return responseData.message;
      }
      if (responseData.error) {
        return typeof responseData.error === "string"
          ? responseData.error
          : responseData.error.message || JSON.stringify(responseData.error);
      }
    }

    // Use status text if available
    if (error.response?.statusText) {
      return error.response.statusText;
    }

    // Use error message
    if (error.message && error.message !== "Network Error") {
      return error.message;
    }

    // Use default message based on error type
    const errorType = getErrorType(error);
    return DEFAULT_ERROR_MESSAGES[errorType];
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallbackMessage || DEFAULT_ERROR_MESSAGES[ErrorType.UNKNOWN];
}

/**
 * Extract error code from an error object
 */
export function getErrorCode(error: unknown): string | number | undefined {
  if (error instanceof AxiosError) {
    return error.response?.status || error.code;
  }

  if (error instanceof Error && 'code' in error) {
    return (error as any).code;
  }

  return undefined;
}

/**
 * Extract error details from an error object
 */
export function getErrorDetails(error: unknown): Record<string, any> | undefined {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data;
    if (responseData && typeof responseData === "object") {
      if (responseData.details || responseData.errors) {
        return responseData.details || responseData.errors;
      }

      // Exclude some fields to avoid circular references
      const { request, config, ...rest } = responseData;
      return rest;
    }

    return { url: error.config?.url, method: error.config?.method };
  }

  return undefined;
}

/**
 * Create a structured error info object from an error
 */
export function createErrorInfo(error: unknown, options?: Partial<ErrorInfo>): ErrorInfo {
  const errorType = options?.type || getErrorType(error);
  const severity = options?.severity || getErrorSeverity(error);
  const message = options?.message || getErrorMessage(error);
  const code = options?.code || getErrorCode(error);
  const details = options?.details || getErrorDetails(error);

  return {
    type: errorType,
    severity,
    message,
    code,
    details,
    originalError: error,
    handled: options?.handled || false,
  };
}

/**
 * Handle an error by logging it and optionally showing a toast notification
 */
export function handleError(
  error: unknown,
  options?: {
    showToast?: boolean;
    logError?: boolean;
    context?: string;
    fallbackMessage?: string;
    errorInfo?: Partial<ErrorInfo>;
  }
): ErrorInfo {
  const {
    showToast = true,
    logError = true,
    context = "",
    fallbackMessage,
    errorInfo = {},
  } = options || {};

  // Create structured error info
  const info = createErrorInfo(error, {
    message: errorInfo.message || getErrorMessage(error, fallbackMessage),
    ...errorInfo,
    handled: true,
  });

  // Log the error
  if (logError) {
    const logContext = {
      errorType: info.type,
      errorCode: info.code,
      errorDetails: info.details,
      context,
    };

    switch (info.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(`Critical error: ${info.message}`, logContext);
        break;
      case ErrorSeverity.ERROR:
        logger.error(`Error: ${info.message}`, logContext);
        break;
      case ErrorSeverity.WARNING:
        logger.warn(`Warning: ${info.message}`, logContext);
        break;
      case ErrorSeverity.INFO:
        logger.info(`Info: ${info.message}`, logContext);
        break;
    }
  }

  // Show toast notification
  if (showToast) {
    switch (info.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        toast.error(info.message);
        break;
      case ErrorSeverity.WARNING:
        toast.warning(info.message);
        break;
      case ErrorSeverity.INFO:
        toast.info(info.message);
        break;
    }
  }

  return info;
}

/**
 * Create a custom error class
 */
export class AppError extends Error {
  type: ErrorType;
  severity: ErrorSeverity;
  code?: string | number;
  details?: Record<string, any>;

  constructor(message: string, options?: Partial<ErrorInfo>) {
    super(message);
    this.name = "AppError";
    this.type = options?.type || ErrorType.UNKNOWN;
    this.severity = options?.severity || ErrorSeverity.ERROR;
    this.code = options?.code;
    this.details = options?.details;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Create specific error classes for different error types
 */
export class NetworkError extends AppError {
  constructor(message = DEFAULT_ERROR_MESSAGES[ErrorType.NETWORK], options?: Partial<ErrorInfo>) {
    super(message, { type: ErrorType.NETWORK, ...options });
    this.name = "NetworkError";
  }
}

export class ApiError extends AppError {
  constructor(message = DEFAULT_ERROR_MESSAGES[ErrorType.API], options?: Partial<ErrorInfo>) {
    super(message, { type: ErrorType.API, ...options });
    this.name = "ApiError";
  }
}

export class ValidationError extends AppError {
  constructor(message = DEFAULT_ERROR_MESSAGES[ErrorType.VALIDATION], options?: Partial<ErrorInfo>) {
    super(message, { type: ErrorType.VALIDATION, ...options });
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = DEFAULT_ERROR_MESSAGES[ErrorType.AUTHENTICATION], options?: Partial<ErrorInfo>) {
    super(message, { type: ErrorType.AUTHENTICATION, ...options });
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = DEFAULT_ERROR_MESSAGES[ErrorType.AUTHORIZATION], options?: Partial<ErrorInfo>) {
    super(message, { type: ErrorType.AUTHORIZATION, ...options });
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = DEFAULT_ERROR_MESSAGES[ErrorType.NOT_FOUND], options?: Partial<ErrorInfo>) {
    super(message, { type: ErrorType.NOT_FOUND, ...options });
    this.name = "NotFoundError";
  }
}

export class ServerError extends AppError {
  constructor(message = DEFAULT_ERROR_MESSAGES[ErrorType.SERVER], options?: Partial<ErrorInfo>) {
    super(message, { type: ErrorType.SERVER, ...options });
    this.name = "ServerError";
  }
}
