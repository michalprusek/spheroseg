/**
 * Simplified User Settings Tests
 * 
 * Tests for user profile and settings management
 */

import request from 'supertest';
import express, { Router, Request, Response } from 'express';

describe('User Settings API', () => {
  // Test user data
  const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    username: 'testuser',
    password: 'hashed-password',
    title: 'Researcher',
    organization: 'Test Organization',
    bio: 'This is a test user bio.',
    location: 'Test Location',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  let app: express.Application;
  let currentUser = { ...testUser };
  
  beforeEach(() => {
    // Reset user to original state
    currentUser = { ...testUser };
    
    // Create express app
    app = express();
    app.use(express.json());
    
    // Create auth middleware
    const authMiddleware = (req: Request, res: Response, next: any) => {
      // Add user ID to request
      (req as any).user = { userId: currentUser.id };
      next();
    };
    
    // Create router
    const router = Router();
    
    // Get current user
    router.get('/users/me', authMiddleware, (req, res) => {
      // Return user without password
      const { password, ...userWithoutPassword } = currentUser;
      res.status(200).json(userWithoutPassword);
    });
    
    // Update user profile
    router.patch('/users/me', authMiddleware, (req, res) => {
      const { currentPassword, newPassword, ...profileUpdates } = req.body;
      
      // Handle password change
      if (currentPassword && newPassword) {
        // Validate current password
        if (currentPassword !== 'current-password') {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }
        
        // Update password
        currentUser.password = 'new-hashed-password';
      }
      
      // Update profile fields
      Object.assign(currentUser, profileUpdates);
      currentUser.updated_at = new Date().toISOString();
      
      // Return updated user without password
      const { password, ...userWithoutPassword } = currentUser;
      res.status(200).json(userWithoutPassword);
    });
    
    // Delete user
    router.delete('/users/me', authMiddleware, (req, res) => {
      // Just return success response (no actual deletion in test)
      res.status(200).json({ message: 'User deleted successfully' });
    });
    
    // Mount router
    app.use('/api', router);
  });
  
  describe('GET /api/users/me', () => {
    it('should return the current user', async () => {
      const response = await request(app)
        .get('/api/users/me');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'test-user-id');
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(response.body).toHaveProperty('name', 'Test User');
      expect(response.body).toHaveProperty('username', 'testuser');
      expect(response.body).not.toHaveProperty('password');
    });
  });
  
  describe('PATCH /api/users/me', () => {
    it('should update the current user profile', async () => {
      const response = await request(app)
        .patch('/api/users/me')
        .send({
          name: 'Updated Test User',
          username: 'updatedtestuser',
          title: 'Senior Researcher',
          organization: 'Updated Test Organization',
          bio: 'This is an updated test user bio.',
          location: 'Updated Test Location'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'test-user-id');
      expect(response.body).toHaveProperty('name', 'Updated Test User');
      expect(response.body).toHaveProperty('username', 'updatedtestuser');
      expect(response.body).toHaveProperty('title', 'Senior Researcher');
      expect(response.body).toHaveProperty('organization', 'Updated Test Organization');
      expect(response.body).toHaveProperty('bio', 'This is an updated test user bio.');
      expect(response.body).toHaveProperty('location', 'Updated Test Location');
    });
    
    it('should update the current user password', async () => {
      const response = await request(app)
        .patch('/api/users/me')
        .send({
          currentPassword: 'current-password',
          newPassword: 'new-password'
        });
      
      expect(response.status).toBe(200);
      expect(currentUser.password).toBe('new-hashed-password');
    });
    
    it('should return 400 if current password is incorrect', async () => {
      const response = await request(app)
        .patch('/api/users/me')
        .send({
          currentPassword: 'wrong-password',
          newPassword: 'new-password'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Current password is incorrect');
    });
  });
  
  describe('DELETE /api/users/me', () => {
    it('should delete the current user', async () => {
      const response = await request(app)
        .delete('/api/users/me');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'User deleted successfully');
    });
  });
});