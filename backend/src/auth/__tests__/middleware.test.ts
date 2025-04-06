import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateJWT } from '../middleware';

// Mock jwt
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should return 401 if no authorization header is present', () => {
    authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized - No token provided' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if token format is invalid', () => {
    mockRequest.headers = { authorization: 'Invalid-token-format' };

    authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized - No token provided' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if token verification fails', () => {
    mockRequest.headers = { authorization: 'Bearer invalid-token' };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized - Invalid token' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should call next() if token is valid', () => {
    mockRequest.headers = { authorization: 'Bearer valid-token' };
    const decodedUser = { id: undefined };
    (jwt.verify as jest.Mock).mockReturnValue(decodedUser);

    authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.user).toEqual(decodedUser);
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });
});
