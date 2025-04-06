import { errorHandler } from '../errorHandler';
import { ZodError } from 'zod';
import { JsonWebTokenError } from 'jsonwebtoken';
import type { Response } from 'express';

const mockReq = {} as any;
const mockNext = jest.fn();

let mockRes: Response;

beforeEach(() => {
  mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  } as unknown as Response;
});

describe('errorHandler middleware', () => {
  it('handles generic errors with default 500', () => {
    const err = new Error('Something failed');
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        code: 500,
        message: 'Something failed'
      })
    }));
  });

  it('handles ZodError with 400 status', () => {
    const err = new ZodError([]);
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 400,
        message: 'Validation Error'
      })
    }));
  });

  it('handles JsonWebTokenError with 401 status', () => {
    const err = new JsonWebTokenError('jwt malformed');
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 401,
        message: 'Invalid Token'
      })
    }));
  });

  it('handles Postgres unique violation error with 409 status', () => {
    const err = new Error('duplicate key') as any;
    err.code = '23505';
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 409,
        message: 'Duplicate Entry'
      })
    }));
  });

  it('includes stack trace in development mode', () => {
    const originalEnv = require('../../config/app').config.server.env;
    require('../../config/app').config.server.env = 'development';
    const err = new Error('dev error');
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        details: expect.any(String)
      })
    }));
    require('../../config/app').config.server.env = originalEnv;
  });

  it('hides stack trace in production mode', () => {
    const originalEnv = require('../../config/app').config.server.env;
    require('../../config/app').config.server.env = 'production';
    const err = new Error('prod error');
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        details: undefined
      })
    }));
    require('../../config/app').config.server.env = originalEnv;
  });
  it('defaults message to \"Internal Server Error\" if error message is empty', () => {
    const err = new Error('') as any;
    err.message = '';
    delete err.statusCode;
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Internal Server Error'
      })
    }));
  });
});