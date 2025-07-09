import { validate } from '../validationMiddleware';
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

describe('validationMiddleware', () => {
  // Mock Express request, response, and next function
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnValue({});
    statusMock = jest.fn().mockReturnThis();

    mockRequest = {
      body: {},
      query: {},
      params: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();

    // Mock console.error to prevent logs during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call next() when validation passes', async () => {
    // Create a simple schema for testing
    const testSchema = z.object({
      body: z.object({
        name: z.string().min(1),
      }),
    });

    // Set up valid request data
    mockRequest.body = { name: 'Test User' };

    // Create middleware instance with the schema
    const middleware = validate(testSchema);

    // Call the middleware
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    // Assertions
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
  });

  it('should return 400 with error details when body validation fails', async () => {
    // Create a simple schema for testing
    const testSchema = z.object({
      body: z.object({
        name: z.string().min(3, 'Name must be at least 3 characters'),
        email: z.string().email('Invalid email format'),
      }),
    });

    // Set up invalid request data
    mockRequest.body = { name: 'A', email: 'not-an-email' };

    // Create middleware instance with the schema
    const middleware = validate(testSchema);

    // Call the middleware
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    // Assertions
    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: expect.any(String),
            message: expect.any(String),
          }),
        ]),
      })
    );
  });

  it('should return 400 with error details when query validation fails', async () => {
    // Create a schema that validates query parameters
    const testSchema = z.object({
      query: z.object({
        page: z.string().refine((val) => !isNaN(Number(val)), 'Page must be a number'),
      }),
    });

    // Set up invalid request data
    mockRequest.query = { page: 'not-a-number' };

    // Create middleware instance with the schema
    const middleware = validate(testSchema);

    // Call the middleware
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    // Assertions
    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining('query'),
            message: 'Page must be a number',
          }),
        ]),
      })
    );
  });

  it('should return 400 with error details when params validation fails', async () => {
    // Create a schema that validates route parameters
    const testSchema = z.object({
      params: z.object({
        id: z.string().uuid('Invalid UUID format'),
      }),
    });

    // Set up invalid request data
    mockRequest.params = { id: 'not-a-uuid' };

    // Create middleware instance with the schema
    const middleware = validate(testSchema);

    // Call the middleware
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    // Assertions
    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining('params'),
            message: 'Invalid UUID format',
          }),
        ]),
      })
    );
  });

  it('should return 500 when an unexpected error occurs', async () => {
    // Create a schema that will throw an unexpected error
    const testSchema = z.object({
      body: z.object({
        data: z.unknown(),
      }),
    });

    // Mock the parseAsync method to throw a non-ZodError
    jest.spyOn(testSchema, 'parseAsync').mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    // Create middleware instance with the schema
    const middleware = validate(testSchema);

    // Call the middleware
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    // Assertions
    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: 'Internal server error during validation',
    });
  });

  it('should handle complex validation scenarios with refinements', async () => {
    // Create a schema with refinements
    const testSchema = z.object({
      body: z
        .object({
          password: z.string().min(8, 'Password must be at least 8 characters'),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'Passwords do not match',
          path: ['confirmPassword'],
        }),
    });

    // Set up invalid request data
    mockRequest.body = {
      password: 'password123',
      confirmPassword: 'password456',
    };

    // Create middleware instance with the schema
    const middleware = validate(testSchema);

    // Call the middleware
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    // Assertions
    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining('confirmPassword'),
            message: 'Passwords do not match',
          }),
        ]),
      })
    );
  });

  it('should validate request with multiple properties (body, query, params)', async () => {
    // Create a schema that validates body, query, and params
    const testSchema = z.object({
      body: z.object({
        name: z.string().min(1, 'Name is required'),
      }),
      query: z.object({
        sort: z.enum(['asc', 'desc']).optional(),
      }),
      params: z.object({
        id: z.string().uuid('Invalid ID format'),
      }),
    });

    // Set up valid request data
    mockRequest.body = { name: 'Test User' };
    mockRequest.query = { sort: 'asc' };
    mockRequest.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

    // Create middleware instance with the schema
    const middleware = validate(testSchema);

    // Call the middleware
    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    // Assertions
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
  });
});
