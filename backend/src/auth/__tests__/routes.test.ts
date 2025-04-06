// Mock DB connection
jest.mock('../../db/connection', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  return {
    __esModule: true,
    default: { query: mockQuery },
    query: mockQuery,
  };
});

jest.mock('../services/auth.service', () => {
  const actual = jest.requireActual('../services/auth.service');
  return {
    __esModule: true,
    ...actual,
    AuthService: {
      ...actual.AuthService,
      registerUser: jest.fn(),
      loginUser: jest.fn(),
      generateToken: jest.fn(),  // add mock for static method
    },
  };
});

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../../db/connection';
import { loginHandler, registerHandler, authRouter } from '../routes';
import request from 'supertest';
import express from 'express';

// Mock dependencies
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('authRouter', () => {
  it('should be an instance of express.Router', () => {
    expect(authRouter).toBeDefined();
    expect(authRouter).toBeInstanceOf(express.Router);
  });
});

// Unit tests for handlers
describe('Auth Routes', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: any;

  beforeEach(() => {
    jest.resetAllMocks();
    mockRequest = { body: {} };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('login', () => {
    it('should return 400 if email or password is missing', async () => {
      mockRequest.body = {};  // explicitly empty
      const { AuthService } = require('../services/auth.service');
      (AuthService.loginUser as jest.Mock).mockResolvedValueOnce({}); // won't be called
    
      await loginHandler(mockRequest, mockResponse);
    
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Email and password are required' });
    });

    it('should return 401 if user is not found', async () => {
      mockRequest.body = { email: 'test@example.com', password: 'password' };
      const { AuthService } = require('../services/auth.service');
      (AuthService.loginUser as jest.Mock).mockRejectedValueOnce(new Error('User not found'));

      await loginHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    });

    it('should return 401 if password is incorrect', async () => {
      mockRequest.body = { email: 'test@example.com', password: 'password' };
      const { AuthService } = require('../services/auth.service');
      (AuthService.loginUser as jest.Mock).mockRejectedValueOnce(new Error('Invalid credentials'));

      await loginHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    });

    it('should return 200 and token with user data if login is successful', async () => {
      mockRequest.body = { email: 'test@example.com', password: 'password' };
      const { AuthService } = require('../services/auth.service');
      (AuthService.loginUser as jest.Mock).mockResolvedValueOnce({
        token: 'mock_token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
      });

      await loginHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        token: 'mock_token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
      });
    });

    it('should allow login attempt even if email format is invalid (no validation)', async () => {
      mockRequest.body = { email: 'invalid-email', password: 'password' };
      const { AuthService } = require('../services/auth.service');
      (AuthService.loginUser as jest.Mock).mockResolvedValueOnce({
        token: 'mock_token',
        user: { id: 1, email: 'invalid-email', name: 'Test User' },
      });
    
      await loginHandler(mockRequest, mockResponse);
    
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        token: 'mock_token',
        user: { id: 1, email: 'invalid-email', name: 'Test User' },
      });
    });

    it('should return 400 if password is empty', async () => {
      mockRequest.body = { email: 'test@example.com', password: '' };
      const { AuthService } = require('../services/auth.service');
      (AuthService.loginUser as jest.Mock).mockResolvedValueOnce({}); // won't be called
    
      await loginHandler(mockRequest, mockResponse);
    
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: expect.any(String) });
    });

    it('should return 400 if AuthService.loginUser throws unexpected error', async () => {
      mockRequest.body = { email: 'test@example.com', password: 'password' };
      const { AuthService } = require('../services/auth.service');
      (AuthService.loginUser as jest.Mock).mockRejectedValueOnce(new Error('Some unexpected error'));

      await loginHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Some unexpected error' });
    });
  });

  describe('register', () => {
    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = {};  // explicitly empty
      const { AuthService } = require('../services/auth.service');
      (AuthService.registerUser as jest.Mock).mockResolvedValueOnce({}); // won't be called
    
      await registerHandler(mockRequest, mockResponse);
    
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Email and password are required' });
    });

    it('should return 409 if user already exists', async () => {
      mockRequest.body = { name: 'Test User', email: 'test@example.com', password: 'password' };
      const { AuthService } = require('../services/auth.service');
      (AuthService.registerUser as jest.Mock).mockRejectedValueOnce(new Error('User already exists'));

      await registerHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User already exists' });
    });

    it('should return 400 if email format is invalid', async () => {
      mockRequest.body = { name: 'Test User', email: 'invalid-email', password: 'password' };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const { AuthService } = require('../services/auth.service');
      (AuthService.registerUser as jest.Mock).mockResolvedValueOnce({}); // won't be called
    
      await registerHandler(mockRequest, mockResponse);
    
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: expect.any(Array) });
    });

    it('should return 400 if password is too weak', async () => {
      mockRequest.body = { name: 'Test User', email: 'test@example.com', password: '123' };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const { AuthService } = require('../services/auth.service');
      (AuthService.registerUser as jest.Mock).mockResolvedValueOnce({}); // won't be called
    
      await registerHandler(mockRequest, mockResponse);
    
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: expect.any(Array) });
    });

    it('should create user and return token if registration is successful', async () => {
      mockRequest.body = { name: 'Test User', email: 'test@example.com', password: 'password' };

      // Ensure bcrypt.hash returns a dummy hash to avoid real hashing issues
      const bcrypt = require('bcrypt');
      bcrypt.hash.mockResolvedValueOnce('hashed_password');

      const { AuthService } = require('../services/auth.service');
      (AuthService.registerUser as jest.Mock).mockResolvedValueOnce({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
      });
      // Patch the mock to include generateToken returning a dummy token
      (AuthService.generateToken as jest.Mock).mockReturnValue('mock_token');

      await registerHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        token: 'mock_token',
        user: { id: 1, name: 'Test User', email: 'test@example.com' }
      });
    });

    it('should return 400 if AuthService.registerUser throws unexpected error', async () => {
      mockRequest.body = { name: 'Test User', email: 'test@example.com', password: 'password' };
      const { AuthService } = require('../services/auth.service');
      (AuthService.registerUser as jest.Mock).mockRejectedValueOnce(new Error('Some unexpected error'));

      await registerHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Some unexpected error' });
    });
  });
});

// Integration tests

 
