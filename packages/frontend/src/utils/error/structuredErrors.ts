/**
 * Frontend Structured Error System
 * 
 * Mirrors backend error codes for consistent error handling
 * across the entire application.
 */

// Error code definitions matching backend
export const ERROR_CODES = {
  // Authentication Errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'AUTH_1002',
  AUTH_TOKEN_INVALID: 'AUTH_1003',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_1004',
  AUTH_SESSION_EXPIRED: 'AUTH_1005',
  AUTH_ACCOUNT_DISABLED: 'AUTH_1006',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_1007',
  AUTH_TOO_MANY_ATTEMPTS: 'AUTH_1008',

  // Validation Errors
  VALIDATION_REQUIRED_FIELD: 'VAL_2001',
  VALIDATION_INVALID_FORMAT: 'VAL_2002',
  VALIDATION_OUT_OF_RANGE: 'VAL_2003',
  VALIDATION_DUPLICATE_VALUE: 'VAL_2004',
  VALIDATION_FILE_TOO_LARGE: 'VAL_2005',
  VALIDATION_INVALID_FILE_TYPE: 'VAL_2006',
  VALIDATION_PASSWORD_WEAK: 'VAL_2007',

  // Resource Errors
  RESOURCE_NOT_FOUND: 'RES_3001',
  RESOURCE_ALREADY_EXISTS: 'RES_3002',
  RESOURCE_DELETED: 'RES_3003',
  RESOURCE_LOCKED: 'RES_3004',
  RESOURCE_QUOTA_EXCEEDED: 'RES_3005',

  // Permission Errors
  PERMISSION_DENIED: 'PERM_4001',
  PERMISSION_INSUFFICIENT_ROLE: 'PERM_4002',
  PERMISSION_RESOURCE_ACCESS_DENIED: 'PERM_4003',
  PERMISSION_OPERATION_NOT_ALLOWED: 'PERM_4004',

  // Business Logic Errors
  BUSINESS_INVALID_STATE: 'BUS_5001',
  BUSINESS_PREREQUISITE_FAILED: 'BUS_5002',
  BUSINESS_PROCESSING_ERROR: 'BUS_5003',
  BUSINESS_SEGMENTATION_FAILED: 'BUS_5004',
  BUSINESS_PROJECT_LIMIT_REACHED: 'BUS_5005',

  // External Service Errors
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXT_6001',
  EXTERNAL_ML_SERVICE_ERROR: 'EXT_6002',
  EXTERNAL_STORAGE_ERROR: 'EXT_6003',
  EXTERNAL_DATABASE_ERROR: 'EXT_6004',
  EXTERNAL_EMAIL_SERVICE_ERROR: 'EXT_6005',

  // System Errors
  SYSTEM_INTERNAL_ERROR: 'SYS_9001',
  SYSTEM_CONFIGURATION_ERROR: 'SYS_9002',
  SYSTEM_RATE_LIMIT_EXCEEDED: 'SYS_9003',
  SYSTEM_MAINTENANCE_MODE: 'SYS_9004',
  SYSTEM_MEMORY_LIMIT_EXCEEDED: 'SYS_9005',

  // Frontend-specific errors
  NETWORK_OFFLINE: 'NET_7001',
  NETWORK_TIMEOUT: 'NET_7002',
  NETWORK_CONNECTION_LOST: 'NET_7003',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Error response interface matching backend
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId?: string;
    details?: ValidationError[];
    context?: Record<string, any>;
    help?: string;
  };
}

export interface ValidationError {
  field: string;
  value?: any;
  constraint: string;
  message: string;
}

// User-friendly error messages with i18n keys
export const ERROR_MESSAGES: Record<ErrorCode, { message: string; i18nKey: string }> = {
  // Authentication
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: {
    message: 'Invalid email or password',
    i18nKey: 'errors.auth.invalidCredentials',
  },
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: {
    message: 'Your session has expired. Please sign in again.',
    i18nKey: 'errors.auth.tokenExpired',
  },
  [ERROR_CODES.AUTH_TOKEN_INVALID]: {
    message: 'Invalid authentication. Please sign in again.',
    i18nKey: 'errors.auth.tokenInvalid',
  },
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: {
    message: 'Your session has expired. Please sign in again.',
    i18nKey: 'errors.auth.sessionExpired',
  },
  [ERROR_CODES.AUTH_ACCOUNT_DISABLED]: {
    message: 'Your account has been disabled. Please contact support.',
    i18nKey: 'errors.auth.accountDisabled',
  },
  [ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED]: {
    message: 'Please verify your email address to continue.',
    i18nKey: 'errors.auth.emailNotVerified',
  },
  [ERROR_CODES.AUTH_TOO_MANY_ATTEMPTS]: {
    message: 'Too many attempts. Please try again later.',
    i18nKey: 'errors.auth.tooManyAttempts',
  },

  // Validation
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: {
    message: 'Please fill in all required fields',
    i18nKey: 'errors.validation.requiredField',
  },
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: {
    message: 'Invalid format. Please check your input.',
    i18nKey: 'errors.validation.invalidFormat',
  },
  [ERROR_CODES.VALIDATION_FILE_TOO_LARGE]: {
    message: 'File size exceeds the maximum allowed limit',
    i18nKey: 'errors.validation.fileTooLarge',
  },
  [ERROR_CODES.VALIDATION_INVALID_FILE_TYPE]: {
    message: 'Invalid file type. Please upload a supported format.',
    i18nKey: 'errors.validation.invalidFileType',
  },
  [ERROR_CODES.VALIDATION_PASSWORD_WEAK]: {
    message: 'Password does not meet security requirements',
    i18nKey: 'errors.validation.passwordWeak',
  },

  // Resources
  [ERROR_CODES.RESOURCE_NOT_FOUND]: {
    message: 'The requested resource was not found',
    i18nKey: 'errors.resource.notFound',
  },
  [ERROR_CODES.RESOURCE_ALREADY_EXISTS]: {
    message: 'This resource already exists',
    i18nKey: 'errors.resource.alreadyExists',
  },
  [ERROR_CODES.RESOURCE_QUOTA_EXCEEDED]: {
    message: 'You have reached your resource limit',
    i18nKey: 'errors.resource.quotaExceeded',
  },

  // Permissions
  [ERROR_CODES.PERMISSION_DENIED]: {
    message: 'You do not have permission to perform this action',
    i18nKey: 'errors.permission.denied',
  },
  [ERROR_CODES.PERMISSION_INSUFFICIENT_ROLE]: {
    message: 'Your role does not have sufficient privileges',
    i18nKey: 'errors.permission.insufficientRole',
  },

  // Business Logic
  [ERROR_CODES.BUSINESS_INVALID_STATE]: {
    message: 'This operation cannot be performed in the current state',
    i18nKey: 'errors.business.invalidState',
  },
  [ERROR_CODES.BUSINESS_SEGMENTATION_FAILED]: {
    message: 'Image segmentation failed. Please try again.',
    i18nKey: 'errors.business.segmentationFailed',
  },
  [ERROR_CODES.BUSINESS_PROJECT_LIMIT_REACHED]: {
    message: 'You have reached your project limit',
    i18nKey: 'errors.business.projectLimitReached',
  },

  // External Services
  [ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE]: {
    message: 'Service temporarily unavailable. Please try again later.',
    i18nKey: 'errors.external.serviceUnavailable',
  },
  [ERROR_CODES.EXTERNAL_ML_SERVICE_ERROR]: {
    message: 'Processing service error. Please try again.',
    i18nKey: 'errors.external.mlServiceError',
  },

  // System
  [ERROR_CODES.SYSTEM_INTERNAL_ERROR]: {
    message: 'An unexpected error occurred. Please try again.',
    i18nKey: 'errors.system.internalError',
  },
  [ERROR_CODES.SYSTEM_RATE_LIMIT_EXCEEDED]: {
    message: 'Too many requests. Please slow down.',
    i18nKey: 'errors.system.rateLimitExceeded',
  },
  [ERROR_CODES.SYSTEM_MAINTENANCE_MODE]: {
    message: 'System is under maintenance. Please check back later.',
    i18nKey: 'errors.system.maintenanceMode',
  },

  // Network
  [ERROR_CODES.NETWORK_OFFLINE]: {
    message: 'No internet connection. Please check your network.',
    i18nKey: 'errors.network.offline',
  },
  [ERROR_CODES.NETWORK_TIMEOUT]: {
    message: 'Request timed out. Please try again.',
    i18nKey: 'errors.network.timeout',
  },
  [ERROR_CODES.NETWORK_CONNECTION_LOST]: {
    message: 'Connection lost. Please refresh the page.',
    i18nKey: 'errors.network.connectionLost',
  },
};

// Default messages for unknown errors
export const DEFAULT_ERROR_MESSAGES = {
  GENERIC: {
    message: 'An error occurred. Please try again.',
    i18nKey: 'errors.generic',
  },
  NETWORK: {
    message: 'Network error. Please check your connection.',
    i18nKey: 'errors.network.generic',
  },
  VALIDATION: {
    message: 'Please check your input and try again.',
    i18nKey: 'errors.validation.generic',
  },
} as const;

/**
 * Get user-friendly error message from error code
 */
export function getErrorMessage(code: string): { message: string; i18nKey: string } {
  const errorMessage = ERROR_MESSAGES[code as ErrorCode];
  
  if (errorMessage) {
    return errorMessage;
  }

  // Fallback based on error category
  if (code.startsWith('AUTH_')) {
    return {
      message: 'Authentication error. Please sign in again.',
      i18nKey: 'errors.auth.generic',
    };
  }
  
  if (code.startsWith('VAL_')) {
    return DEFAULT_ERROR_MESSAGES.VALIDATION;
  }
  
  if (code.startsWith('NET_')) {
    return DEFAULT_ERROR_MESSAGES.NETWORK;
  }

  return DEFAULT_ERROR_MESSAGES.GENERIC;
}

/**
 * Check if error is a specific type
 */
export function isErrorCode(error: any, code: ErrorCode): boolean {
  return error?.error?.code === code;
}

/**
 * Check if error is authentication related
 */
export function isAuthError(error: any): boolean {
  const code = error?.error?.code;
  return code && code.startsWith('AUTH_');
}

/**
 * Check if error requires user re-authentication
 */
export function requiresReauth(error: any): boolean {
  const code = error?.error?.code;
  return [
    ERROR_CODES.AUTH_TOKEN_EXPIRED,
    ERROR_CODES.AUTH_TOKEN_INVALID,
    ERROR_CODES.AUTH_SESSION_EXPIRED,
  ].includes(code);
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: any): boolean {
  const code = error?.error?.code;
  return code && code.startsWith('NET_');
}

/**
 * Extract validation errors from error response
 */
export function getValidationErrors(error: any): Record<string, string> {
  const details = error?.error?.details;
  if (!Array.isArray(details)) {
    return {};
  }

  return details.reduce((acc, detail) => {
    if (detail.field) {
      acc[detail.field] = detail.message;
    }
    return acc;
  }, {} as Record<string, string>);
}