/**
 * Comprehensive Error Code System
 * 
 * Structured error codes for the entire application with proper categorization
 * and standardized error responses.
 */

// Error categories with numeric ranges
export const ERROR_CATEGORIES = {
  AUTH: 1000,        // Authentication errors (1000-1099)
  VALIDATION: 2000,  // Validation errors (2000-2099)
  RESOURCE: 3000,    // Resource errors (3000-3099)
  PERMISSION: 4000,  // Permission errors (4000-4099)
  BUSINESS: 5000,    // Business logic errors (5000-5099)
  EXTERNAL: 6000,    // External service errors (6000-6099)
  SYSTEM: 9000,      // System errors (9000-9099)
} as const;

// Detailed error codes with descriptions
export const ERROR_CODES = {
  // Authentication Errors (1000-1099)
  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_1001',
    message: 'Invalid email or password',
    statusCode: 401,
  },
  AUTH_TOKEN_EXPIRED: {
    code: 'AUTH_1002',
    message: 'Authentication token has expired',
    statusCode: 401,
  },
  AUTH_TOKEN_INVALID: {
    code: 'AUTH_1003',
    message: 'Invalid authentication token',
    statusCode: 401,
  },
  AUTH_REFRESH_TOKEN_INVALID: {
    code: 'AUTH_1004',
    message: 'Invalid refresh token',
    statusCode: 401,
  },
  AUTH_SESSION_EXPIRED: {
    code: 'AUTH_1005',
    message: 'Session has expired',
    statusCode: 401,
  },
  AUTH_ACCOUNT_DISABLED: {
    code: 'AUTH_1006',
    message: 'Account has been disabled',
    statusCode: 403,
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    code: 'AUTH_1007',
    message: 'Email address not verified',
    statusCode: 403,
  },
  AUTH_TOO_MANY_ATTEMPTS: {
    code: 'AUTH_1008',
    message: 'Too many authentication attempts',
    statusCode: 429,
  },

  // Validation Errors (2000-2099)
  VALIDATION_REQUIRED_FIELD: {
    code: 'VAL_2001',
    message: 'Required field missing',
    statusCode: 400,
  },
  VALIDATION_INVALID_FORMAT: {
    code: 'VAL_2002',
    message: 'Invalid data format',
    statusCode: 400,
  },
  VALIDATION_OUT_OF_RANGE: {
    code: 'VAL_2003',
    message: 'Value out of acceptable range',
    statusCode: 400,
  },
  VALIDATION_DUPLICATE_VALUE: {
    code: 'VAL_2004',
    message: 'Duplicate value not allowed',
    statusCode: 409,
  },
  VALIDATION_FILE_TOO_LARGE: {
    code: 'VAL_2005',
    message: 'File size exceeds limit',
    statusCode: 413,
  },
  VALIDATION_INVALID_FILE_TYPE: {
    code: 'VAL_2006',
    message: 'Invalid file type',
    statusCode: 400,
  },
  VALIDATION_PASSWORD_WEAK: {
    code: 'VAL_2007',
    message: 'Password does not meet security requirements',
    statusCode: 400,
  },

  // Resource Errors (3000-3099)
  RESOURCE_NOT_FOUND: {
    code: 'RES_3001',
    message: 'Resource not found',
    statusCode: 404,
  },
  RESOURCE_ALREADY_EXISTS: {
    code: 'RES_3002',
    message: 'Resource already exists',
    statusCode: 409,
  },
  RESOURCE_DELETED: {
    code: 'RES_3003',
    message: 'Resource has been deleted',
    statusCode: 410,
  },
  RESOURCE_LOCKED: {
    code: 'RES_3004',
    message: 'Resource is locked for editing',
    statusCode: 423,
  },
  RESOURCE_QUOTA_EXCEEDED: {
    code: 'RES_3005',
    message: 'Resource quota exceeded',
    statusCode: 403,
  },

  // Permission Errors (4000-4099)
  PERMISSION_DENIED: {
    code: 'PERM_4001',
    message: 'Permission denied',
    statusCode: 403,
  },
  PERMISSION_INSUFFICIENT_ROLE: {
    code: 'PERM_4002',
    message: 'Insufficient role privileges',
    statusCode: 403,
  },
  PERMISSION_RESOURCE_ACCESS_DENIED: {
    code: 'PERM_4003',
    message: 'Access to this resource is denied',
    statusCode: 403,
  },
  PERMISSION_OPERATION_NOT_ALLOWED: {
    code: 'PERM_4004',
    message: 'Operation not allowed',
    statusCode: 403,
  },

  // Business Logic Errors (5000-5099)
  BUSINESS_INVALID_STATE: {
    code: 'BUS_5001',
    message: 'Invalid operation for current state',
    statusCode: 400,
  },
  BUSINESS_PREREQUISITE_FAILED: {
    code: 'BUS_5002',
    message: 'Prerequisites not met',
    statusCode: 428,
  },
  BUSINESS_PROCESSING_ERROR: {
    code: 'BUS_5003',
    message: 'Error processing request',
    statusCode: 422,
  },
  BUSINESS_SEGMENTATION_FAILED: {
    code: 'BUS_5004',
    message: 'Segmentation processing failed',
    statusCode: 422,
  },
  BUSINESS_PROJECT_LIMIT_REACHED: {
    code: 'BUS_5005',
    message: 'Project limit reached for account',
    statusCode: 403,
  },

  // External Service Errors (6000-6099)
  EXTERNAL_SERVICE_UNAVAILABLE: {
    code: 'EXT_6001',
    message: 'External service unavailable',
    statusCode: 503,
  },
  EXTERNAL_ML_SERVICE_ERROR: {
    code: 'EXT_6002',
    message: 'Machine learning service error',
    statusCode: 502,
  },
  EXTERNAL_STORAGE_ERROR: {
    code: 'EXT_6003',
    message: 'Storage service error',
    statusCode: 502,
  },
  EXTERNAL_DATABASE_ERROR: {
    code: 'EXT_6004',
    message: 'Database operation failed',
    statusCode: 500,
  },
  EXTERNAL_EMAIL_SERVICE_ERROR: {
    code: 'EXT_6005',
    message: 'Email service error',
    statusCode: 502,
  },

  // System Errors (9000-9099)
  SYSTEM_INTERNAL_ERROR: {
    code: 'SYS_9001',
    message: 'Internal server error',
    statusCode: 500,
  },
  SYSTEM_CONFIGURATION_ERROR: {
    code: 'SYS_9002',
    message: 'System configuration error',
    statusCode: 500,
  },
  SYSTEM_RATE_LIMIT_EXCEEDED: {
    code: 'SYS_9003',
    message: 'Rate limit exceeded',
    statusCode: 429,
  },
  SYSTEM_MAINTENANCE_MODE: {
    code: 'SYS_9004',
    message: 'System under maintenance',
    statusCode: 503,
  },
  SYSTEM_MEMORY_LIMIT_EXCEEDED: {
    code: 'SYS_9005',
    message: 'Memory limit exceeded',
    statusCode: 507,
  },
} as const;

// Type definitions
export type ErrorCodeKey = keyof typeof ERROR_CODES;
export type ErrorCodeDefinition = typeof ERROR_CODES[ErrorCodeKey];

// Helper function to get error definition
export function getErrorDefinition(key: ErrorCodeKey): ErrorCodeDefinition {
  return ERROR_CODES[key];
}

// Helper function to check if error code exists
export function isValidErrorCode(code: string): boolean {
  return Object.values(ERROR_CODES).some(error => error.code === code);
}

// Export error code values for easy access
export const ErrorCodeValues = Object.entries(ERROR_CODES).reduce(
  (acc, [key, value]) => ({
    ...acc,
    [key]: value.code,
  }),
  {} as Record<ErrorCodeKey, string>
);