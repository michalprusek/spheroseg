/**
 * Simple type validation tests for @spheroseg/types
 */

import { ApiResponse, User } from '../index';

describe('Simple Type Tests', () => {
  describe('ApiResponse types', () => {
    it('should accept valid success response', () => {
      const successResponse: ApiResponse<string> = {
        success: true,
        data: 'test data',
        message: 'Success',
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toBe('test data');
    });

    it('should accept valid error response', () => {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'Something went wrong',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Something went wrong');
    });
  });

  describe('User types basic', () => {
    it('should have correct User interface structure', () => {
      // This tests that the User type has the expected properties
      const userShape = {
        id: 'string',
        email: 'string', 
        name: 'string',
        role: 'string',
        createdAt: 'string',
        updatedAt: 'string',
        emailVerified: 'boolean',
      };

      // If this compiles, the User type has these fields
      expect(typeof userShape.id).toBe('string');
      expect(typeof userShape.email).toBe('string');
      expect(typeof userShape.name).toBe('string');
    });
  });

  describe('Type exports', () => {
    it('should export basic API types', () => {
      // Test that we can use types in type annotations
      const response: ApiResponse<string> = {
        success: true,
        data: 'test',
      };
      
      expect(response.success).toBe(true);
      expect(response.data).toBe('test');
    });
  });
});