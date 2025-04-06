import { Request, Response } from 'express';
import { registerHandler, loginHandler } from '../routes';
import { AuthService } from '../services/auth.service'; // import the AuthService class


describe('Auth Controller Layer', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock })) as any;
    req = {};
    res = { status: statusMock, json: jsonMock };
  });

  describe('registerHandler', () => {
    it('should return 201 and user data on success', async () => {
      jest.spyOn(AuthService, 'registerUser').mockResolvedValue({ id: 'user123', email: 'test@example.com' });
      req.body = { email: 'test@example.com', password: 'password123' };

      await registerHandler(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        token: expect.any(String),
        user: { id: 'user123', email: 'test@example.com' }
      });
    });

    it('should return 409 on duplicate email error', async () => {
      jest.spyOn(AuthService, 'registerUser').mockRejectedValue(new Error('User already exists'));
      req.body = { email: 'test@example.com', password: 'password123' };

      await registerHandler(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'User already exists' });
    });
  });

  describe('loginHandler', () => {
    it('should return 200 and JWT token on success', async () => {
      jest.spyOn(AuthService, 'loginUser').mockResolvedValue({ token: 'mock.jwt.token', user: { id: 'user123', email: 'test@example.com' } });
      req.body = { email: 'test@example.com', password: 'password123' };

      await loginHandler(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        token: 'mock.jwt.token',
        user: { id: 'user123', email: 'test@example.com' }
      });
    });

    it('should return 401 on invalid credentials', async () => {
      jest.spyOn(AuthService, 'loginUser').mockRejectedValue(new Error('Invalid credentials'));
      req.body = { email: 'test@example.com', password: 'wrongpass' };

      await loginHandler(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    });

  describe('requestPasswordReset', () => {
    it('should return 400 if email missing', async () => {
      const req = { body: {} } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

      await (await import('../controllers/auth.controller')).AuthController.requestPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email is required' });
    });

    it('should return 200 on success', async () => {
      const req = { body: { email: 'test@example.com' } } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      jest.spyOn(AuthService, 'requestPasswordReset').mockResolvedValue();

      await (await import('../controllers/auth.controller')).AuthController.requestPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Password reset email sent' });
    });

    it('should return 400 on service error', async () => {
      const req = { body: { email: 'test@example.com' } } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      jest.spyOn(AuthService, 'requestPasswordReset').mockRejectedValue(new Error('fail'));

      await (await import('../controllers/auth.controller')).AuthController.requestPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'fail' });
    });
  });

  describe('resetPassword', () => {
    it('should return 400 if token or password missing', async () => {
      const req = { body: {} } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

      await (await import('../controllers/auth.controller')).AuthController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token and new password are required' });
    });

    it('should return 200 on success', async () => {
      const req = { body: { token: 'token', newPassword: 'newpass' } } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      jest.spyOn(AuthService, 'resetPassword').mockResolvedValue();

      await (await import('../controllers/auth.controller')).AuthController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Password has been reset' });
    });

    it('should return 400 on service error', async () => {
      const req = { body: { token: 'token', newPassword: 'newpass' } } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      jest.spyOn(AuthService, 'resetPassword').mockRejectedValue(new Error('fail'));

      await (await import('../controllers/auth.controller')).AuthController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'fail' });
    });
  });
  });
});