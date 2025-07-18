/**
 * Enhanced Validation Tests
 * 
 * Tests for the comprehensive validation and sanitization system
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  createTextSchema,
  emailSchema,
  createUrlSchema,
  filenameSchema,
  phoneSchema,
  passwordSchema,
  createHtmlSchema,
  userRegistrationSchema,
  projectCreationSchema,
  validateBody,
  validateQuery,
} from '../enhancedValidation';

describe('Enhanced Validation', () => {
  describe('createTextSchema', () => {
    it('should sanitize and validate text input', async () => {
      const schema = createTextSchema({ minLength: 3, maxLength: 20 });
      
      // Valid input
      const result1 = await schema.parseAsync('Hello World');
      expect(result1).toBe('Hello World');
      
      // Input with HTML (should be stripped)
      const result2 = await schema.parseAsync('<script>alert("xss")</script>Hello');
      expect(result2).toBe('Hello');
      
      // Too short
      await expect(schema.parseAsync('Hi')).rejects.toThrow();
      
      // Too long
      await expect(schema.parseAsync('This is a very long text that exceeds the limit')).rejects.toThrow();
    });

    it('should handle HTML when allowed', async () => {
      const schema = createTextSchema({ allowHtml: true, maxLength: 100 });
      
      const result = await schema.parseAsync('<p>Hello <strong>World</strong></p>');
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).not.toContain('<script>');
    });
  });

  describe('emailSchema', () => {
    it('should validate and sanitize email addresses', async () => {
      // Valid email
      const result1 = await emailSchema.parseAsync('USER@EXAMPLE.COM');
      expect(result1).toBe('user@example.com');
      
      // Email with spaces
      const result2 = await emailSchema.parseAsync('  user@example.com  ');
      expect(result2).toBe('user@example.com');
      
      // Invalid email
      await expect(emailSchema.parseAsync('invalid-email')).rejects.toThrow();
      await expect(emailSchema.parseAsync('user@')).rejects.toThrow();
    });
  });

  describe('createUrlSchema', () => {
    it('should validate and sanitize URLs', async () => {
      const schema = createUrlSchema();
      
      // Valid HTTPS URL
      const result1 = await schema.parseAsync('https://example.com');
      expect(result1).toBe('https://example.com/');
      
      // Valid HTTP URL
      const result2 = await schema.parseAsync('http://example.com/path');
      expect(result2).toBe('http://example.com/path');
      
      // Invalid protocol
      await expect(schema.parseAsync('javascript:alert("xss")')).rejects.toThrow();
      await expect(schema.parseAsync('ftp://example.com')).rejects.toThrow();
    });

    it('should handle relative URLs when allowed', async () => {
      const schema = createUrlSchema({ allowRelative: true });
      
      const result = await schema.parseAsync('/path/to/resource');
      expect(result).toBe('/path/to/resource');
    });
  });

  describe('filenameSchema', () => {
    it('should sanitize filenames', async () => {
      // Valid filename
      const result1 = await filenameSchema.parseAsync('document.pdf');
      expect(result1).toBe('document.pdf');
      
      // Filename with dangerous characters
      const result2 = await filenameSchema.parseAsync('my<file>name.txt');
      expect(result2).toBe('my_file_name.txt');
      
      // Filename with path separators
      const result3 = await filenameSchema.parseAsync('../../../etc/passwd');
      expect(result3).toBe('_.._.._.._etc_passwd');
      
      // Reserved filename
      const result4 = await filenameSchema.parseAsync('CON');
      expect(result4).toBe('file');
    });

    it('should reject empty filenames', async () => {
      await expect(filenameSchema.parseAsync('')).rejects.toThrow();
      await expect(filenameSchema.parseAsync('...')).rejects.toThrow();
    });
  });

  describe('phoneSchema', () => {
    it('should validate phone numbers', async () => {
      // Valid phone numbers
      const result1 = await phoneSchema.parseAsync('+1234567890');
      expect(result1).toBe('+1234567890');
      
      const result2 = await phoneSchema.parseAsync('(555) 123-4567');
      expect(result2).toBe('(555) 123-4567');
      
      // Remove invalid characters
      const result3 = await phoneSchema.parseAsync('+1-555-123-4567#ext123');
      expect(result3).toBe('+1-555-123-4567');
      
      // Invalid phone
      await expect(phoneSchema.parseAsync('123')).rejects.toThrow();
    });
  });

  describe('passwordSchema', () => {
    it('should validate password strength', async () => {
      // Valid strong password
      const result = await passwordSchema.parseAsync('MyStr0ng!Pass');
      expect(result).toBe('MyStr0ng!Pass');
      
      // Too short
      await expect(passwordSchema.parseAsync('Sh0rt!')).rejects.toThrow();
      
      // No uppercase
      await expect(passwordSchema.parseAsync('mystr0ng!pass')).rejects.toThrow();
      
      // No lowercase
      await expect(passwordSchema.parseAsync('MYSTR0NG!PASS')).rejects.toThrow();
      
      // No number
      await expect(passwordSchema.parseAsync('MyStrong!Pass')).rejects.toThrow();
      
      // No special character
      await expect(passwordSchema.parseAsync('MyStr0ngPass')).rejects.toThrow();
    });
  });

  describe('createHtmlSchema', () => {
    it('should sanitize HTML content', async () => {
      const schema = createHtmlSchema();
      
      // Safe HTML
      const result1 = await schema.parseAsync('<p>Hello <strong>World</strong></p>');
      expect(result1).toContain('<p>');
      expect(result1).toContain('<strong>');
      
      // Dangerous HTML (should be removed)
      const result2 = await schema.parseAsync('<script>alert("xss")</script><p>Safe content</p>');
      expect(result2).not.toContain('<script>');
      expect(result2).toContain('<p>Safe content</p>');
      
      // Event handlers (should be removed)
      const result3 = await schema.parseAsync('<p onclick="alert()">Click me</p>');
      expect(result3).not.toContain('onclick');
      expect(result3).toContain('<p>Click me</p>');
    });
  });

  describe('userRegistrationSchema', () => {
    it('should validate user registration data', async () => {
      const validData = {
        email: 'user@example.com',
        password: 'MyStr0ng!Pass',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        organization: 'Test Corp'
      };
      
      const result = await userRegistrationSchema.parseAsync(validData);
      expect(result.email).toBe('user@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('should reject mismatched passwords', async () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'MyStr0ng!Pass',
        confirmPassword: 'DifferentPass',
        name: 'John Doe',
        terms: true,
      };
      
      await expect(userRegistrationSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject without terms acceptance', async () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'MyStr0ng!Pass',
        confirmPassword: 'MyStr0ng!Pass',
        name: 'John Doe',
        terms: false,
      };
      
      await expect(userRegistrationSchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });

  describe('projectCreationSchema', () => {
    it('should validate project creation data', async () => {
      const validData = {
        name: 'My Project',
        description: '<p>This is a <strong>great</strong> project!</p>',
        isPublic: false,
        tags: ['research', 'biology'],
      };
      
      const result = await projectCreationSchema.parseAsync(validData);
      expect(result.name).toBe('My Project');
      expect(result.description).toContain('<p>');
      expect(result.tags).toEqual(['research', 'biology']);
    });

    it('should sanitize dangerous content in description', async () => {
      const dataWithDangerousHtml = {
        name: 'My Project',
        description: '<script>alert("xss")</script><p>Safe description</p>',
        isPublic: false,
      };
      
      const result = await projectCreationSchema.parseAsync(dataWithDangerousHtml);
      expect(result.description).not.toContain('<script>');
      expect(result.description).toContain('<p>Safe description</p>');
    });
  });

  describe('validateBody', () => {
    it('should return validation results', async () => {
      const schema = createTextSchema({ minLength: 3 });
      
      // Valid data
      const result1 = await validateBody(schema, 'Hello', 'test');
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data).toBe('Hello');
      }
      
      // Invalid data
      const result2 = await validateBody(schema, 'Hi', 'test');
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.issues).toBeDefined();
      }
    });
  });

  describe('validateQuery', () => {
    it('should process and validate query parameters', async () => {
      const _schema = createTextSchema().and(z.number());
      
      // String number should be converted
      const result = await validateQuery(z.number(), { page: '5' }, 'pagination');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data).toBe('number');
        expect(result.data).toBe(5);
      }
    });
  });
});

describe('Security Tests', () => {
  describe('XSS Prevention', () => {
    it('should prevent XSS in text fields', async () => {
      const schema = createTextSchema();
      
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '"><script>alert(1)</script>',
      ];
      
      for (const payload of xssPayloads) {
        const result = await schema.parseAsync(payload);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('onload');
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should sanitize SQL-prone inputs', async () => {
      const { sanitizeSqlInput } = await import('../../utils/sanitization');
      
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "UNION SELECT * FROM users",
        "'; EXEC xp_cmdshell('cmd'); --",
      ];
      
      for (const payload of sqlPayloads) {
        const result = sanitizeSqlInput(payload);
        expect(result).not.toContain("'");
        expect(result).not.toContain(';');
        expect(result).not.toContain('--');
        expect(result).not.toContain('UNION');
        expect(result).not.toContain('DROP');
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent path traversal in filenames', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\SAM',
      ];
      
      for (const payload of pathTraversalPayloads) {
        const result = await filenameSchema.parseAsync(payload);
        expect(result).not.toContain('../');
        expect(result).not.toContain('..\\');
        expect(result).not.toContain('/etc/');
        expect(result).not.toContain('C:\\');
      }
    });
  });
});