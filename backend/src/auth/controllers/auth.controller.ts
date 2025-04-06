import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  static async registerHandler(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const errors: string[] = [];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push('Invalid email format');
      }

      if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
      }

      if (errors.length > 0) {
        res.status(400).json({ error: errors });
        return;
      }

      const user = await AuthService.registerUser({ email, password, name });
      const token = AuthService.generateToken(user.id);

      res.status(201).json({ token, user });
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        res.status(409).json({ error: 'User already exists' });
      } else {
        res.status(400).json({ error: err.message });
      }
    }
  }

  static async loginHandler(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const { token, user } = await AuthService.loginUser(email, password);
      res.status(200).json({ token, user });
    } catch (err: any) {
      if (err.message === 'User not found' || err.message === 'Invalid credentials') {
        res.status(401).json({ error: 'Invalid email or password' });
      } else {
        res.status(400).json({ error: err.message });
      }
    }
  }

  static async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }
      await AuthService.requestPasswordReset(email);
      res.status(200).json({ message: 'Password reset email sent' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        res.status(400).json({ error: 'Token and new password are required' });
        return;
      }
      await AuthService.resetPassword(token, newPassword);
      res.status(200).json({ message: 'Password has been reset' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}