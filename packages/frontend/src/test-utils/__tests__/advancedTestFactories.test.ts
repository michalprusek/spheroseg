/**
 * Unit tests for Advanced Test Data Factory
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdvancedTestDataFactory } from '../advancedTestFactories';

describe('AdvancedTestDataFactory', () => {
  beforeEach(() => {
    AdvancedTestDataFactory.resetSequence();
  });

  describe('sequence management', () => {
    it('should generate sequential IDs', () => {
      const seq1 = AdvancedTestDataFactory.sequence('test');
      const seq2 = AdvancedTestDataFactory.sequence('test');
      const seq3 = AdvancedTestDataFactory.sequence('test');

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
      expect(seq3).toBe(3);
    });

    it('should maintain separate sequences for different types', () => {
      const userSeq1 = AdvancedTestDataFactory.sequence('user');
      const projectSeq1 = AdvancedTestDataFactory.sequence('project');
      const userSeq2 = AdvancedTestDataFactory.sequence('user');
      const projectSeq2 = AdvancedTestDataFactory.sequence('project');

      expect(userSeq1).toBe(1);
      expect(projectSeq1).toBe(1);
      expect(userSeq2).toBe(2);
      expect(projectSeq2).toBe(2);
    });

    it('should reset sequences correctly', () => {
      AdvancedTestDataFactory.sequence('test');
      AdvancedTestDataFactory.sequence('test');
      
      AdvancedTestDataFactory.resetSequence('test');
      const newSeq = AdvancedTestDataFactory.sequence('test');
      
      expect(newSeq).toBe(1);
    });
  });

  describe('user factory', () => {
    it('should create user with default values', () => {
      const user = AdvancedTestDataFactory.createUser();

      expect(user).toHaveProperty('id', 'user-1');
      expect(user).toHaveProperty('username', 'testuser1');
      expect(user).toHaveProperty('email', 'user1@test.com');
      expect(user).toHaveProperty('full_name', 'Test User 1');
      expect(user).toHaveProperty('created_at');
      expect(user).toHaveProperty('updated_at');
    });

    it('should accept overrides', () => {
      const user = AdvancedTestDataFactory.createUser({
        username: 'custom-user',
        email: 'custom@example.com',
      });

      expect(user.username).toBe('custom-user');
      expect(user.email).toBe('custom@example.com');
      expect(user.id).toBe('user-1'); // Still gets sequential ID
    });

    it('should create unique users', () => {
      const user1 = AdvancedTestDataFactory.createUser();
      const user2 = AdvancedTestDataFactory.createUser();

      expect(user1.id).toBe('user-1');
      expect(user2.id).toBe('user-2');
      expect(user1.username).toBe('testuser1');
      expect(user2.username).toBe('testuser2');
    });
  });

  describe('project factory', () => {
    it('should create project with default values', () => {
      const project = AdvancedTestDataFactory.createProject();

      expect(project).toHaveProperty('id', 'project-1');
      expect(project).toHaveProperty('name', 'Test Project 1');
      expect(project).toHaveProperty('description', 'Test project description 1');
      expect(project).toHaveProperty('user_id', 'user-1');
      expect(project).toHaveProperty('created_at');
      expect(project).toHaveProperty('updated_at');
    });

    it('should create project with relationships', () => {
      const user = AdvancedTestDataFactory.createUser();
      const project = AdvancedTestDataFactory.createProject({
        user_id: user.id,
        name: 'User Project',
      });

      expect(project.user_id).toBe(user.id);
      expect(project.name).toBe('User Project');
    });
  });

  describe('image factory', () => {
    it('should create image with default values', () => {
      const image = AdvancedTestDataFactory.createImage();

      expect(image).toHaveProperty('id', 'image-1');
      expect(image).toHaveProperty('filename', 'test-image-1.jpg');
      expect(image).toHaveProperty('segmentation_status', 'without_segmentation');
      expect(image).toHaveProperty('project_id', 'project-1');
      expect(image).toHaveProperty('uploaded_at');
    });
  });

  describe('cell factory', () => {
    it('should create cell with default values', () => {
      const cell = AdvancedTestDataFactory.createCell();

      expect(cell).toHaveProperty('id', 'cell-1');
      expect(cell).toHaveProperty('image_id', 'image-1');
      expect(cell).toHaveProperty('polygon_data');
      expect(cell).toHaveProperty('area', 10000);
      expect(cell).toHaveProperty('perimeter', 400);
      expect(cell).toHaveProperty('circularity', 0.8);
    });
  });

  describe('API response factory', () => {
    it('should create successful API response', () => {
      const data = { id: 1, name: 'Test' };
      const response = AdvancedTestDataFactory.createApiResponse(data);

      expect(response.data).toEqual(data);
      expect(response.status).toBe(200);
      expect(response.message).toBe('Success');
      expect(response.timestamp).toBeTruthy();
    });

    it('should create error API response', () => {
      const response = AdvancedTestDataFactory.createApiResponse({}, 500);

      expect(response.status).toBe(500);
      expect(response.message).toBe('Error');
    });
  });

  describe('API error factory', () => {
    it('should create API error with defaults', () => {
      const error = AdvancedTestDataFactory.createApiError();

      expect(error.message).toBe('Test error');
      expect(error.status).toBe(500);
      expect(error.code).toBe('ERROR_500');
      expect(error.timestamp).toBeTruthy();
    });

    it('should create custom API error', () => {
      const error = AdvancedTestDataFactory.createApiError('Not found', 404);

      expect(error.message).toBe('Not found');
      expect(error.status).toBe(404);
      expect(error.code).toBe('ERROR_404');
    });
  });

  describe('form data factory', () => {
    it('should create FormData with string fields', () => {
      const formData = AdvancedTestDataFactory.createFormData({
        name: 'Test Name',
        description: 'Test Description',
      });

      expect(formData.get('name')).toBe('Test Name');
      expect(formData.get('description')).toBe('Test Description');
    });

    it('should create FormData with file fields', () => {
      const file = AdvancedTestDataFactory.createMockFile();
      const formData = AdvancedTestDataFactory.createFormData({
        name: 'Test',
        file: file,
      });

      expect(formData.get('name')).toBe('Test');
      expect(formData.get('file')).toBeInstanceOf(File);
    });
  });

  describe('mock file factory', () => {
    it('should create mock file with defaults', () => {
      const file = AdvancedTestDataFactory.createMockFile();

      expect(file.name).toBe('test-file.jpg');
      expect(file.type).toBe('image/jpeg');
      expect(file.size).toBe(1024);
    });

    it('should create custom mock file', () => {
      const file = AdvancedTestDataFactory.createMockFile('custom.png', 'image/png', 2048);

      expect(file.name).toBe('custom.png');
      expect(file.type).toBe('image/png');
      expect(file.size).toBe(2048);
    });
  });
});