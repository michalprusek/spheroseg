import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { validateSegmentationParams, checkMLServiceAvailability, validateMLCallbackToken } from '../middleware';

jest.mock('axios');
jest.mock('../../config/app', () => ({
  config: {
    ml: {
      serviceUrl: 'http://test-ml-service:8000'
    }
  }
}));

describe('ML Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    req = { body: {}, headers: {}, query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('validateSegmentationParams', () => {
    it('should call next if no parameters are provided', () => {
      validateSegmentationParams(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next if parameters are valid', () => {
      req.body = {
        parameters: {
          threshold: 0.5,
          minSize: 100
        }
      };
      validateSegmentationParams(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 if threshold is not a number', () => {
      req.body = {
        parameters: {
          threshold: 'invalid'
        }
      };
      validateSegmentationParams(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid parameters: threshold must be a number' });
    });

    it('should return 400 if threshold is out of range', () => {
      req.body = {
        parameters: {
          threshold: 1.5
        }
      };
      validateSegmentationParams(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid parameters: threshold must be between 0 and 1' });
    });

    it('should return 400 if minSize is not a number', () => {
      req.body = {
        parameters: {
          minSize: 'invalid'
        }
      };
      validateSegmentationParams(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid parameters: minSize must be a number' });
    });

    it('should return 400 if minSize is negative', () => {
      req.body = {
        parameters: {
          minSize: -10
        }
      };
      validateSegmentationParams(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid parameters: minSize must be a positive number' });
    });
  });

  describe('checkMLServiceAvailability', () => {
    it('should call next if ML service is available', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({ status: 200 });
      await checkMLServiceAvailability(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(axios.get).toHaveBeenCalledWith('http://test-ml-service:8000/health');
    });

    it('should return 503 if ML service is not available', async () => {
      (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));
      await checkMLServiceAvailability(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ML service is not available',
        details: 'The machine learning service is currently unavailable. Please try again later.'
      });
    });
  });

  describe('validateMLCallbackToken', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should call next if no token is configured', () => {
      delete process.env.ML_CALLBACK_TOKEN;
      validateMLCallbackToken(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next if token in header matches', () => {
      process.env.ML_CALLBACK_TOKEN = 'test-token';
      req.headers = { 'x-callback-token': 'test-token' };
      validateMLCallbackToken(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next if token in query matches', () => {
      process.env.ML_CALLBACK_TOKEN = 'test-token';
      req.query = { token: 'test-token' };
      validateMLCallbackToken(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if token does not match', () => {
      process.env.ML_CALLBACK_TOKEN = 'test-token';
      req.headers = { 'x-callback-token': 'wrong-token' };
      validateMLCallbackToken(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid callback token' });
    });

    it('should return 401 if no token is provided but one is required', () => {
      process.env.ML_CALLBACK_TOKEN = 'test-token';
      validateMLCallbackToken(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid callback token' });
    });
  });
});