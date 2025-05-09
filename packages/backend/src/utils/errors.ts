// packages/backend/src/utils/errors.ts

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true, stack = '') {
    super(message);
    this.name = this.constructor.name; // Set the error name to the class name
    this.statusCode = statusCode;
    this.isOperational = isOperational; // To distinguish from unexpected programming errors
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Common HTTP status codes for errors
export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Example of more specific error classes
export class BadRequestError extends ApiError {
  constructor(message = 'Bad Request') {
    super(HTTP_STATUS_CODES.BAD_REQUEST, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource Not Found') {
    super(HTTP_STATUS_CODES.NOT_FOUND, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(HTTP_STATUS_CODES.UNAUTHORIZED, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(HTTP_STATUS_CODES.FORBIDDEN, message);
  }
}

export class UnprocessableEntityError extends ApiError {
  constructor(message = 'Unprocessable Entity') {
    super(HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY, message);
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'Internal Server Error') {
    super(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, message);
  }
}
