import { 
  registerSchema, 
  loginSchema, 
  changePasswordSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema 
} from '../authValidators';

describe('authValidators', () => {
  describe('registerSchema', () => {
    it('should validate a valid registration request', () => {
      const validData = { 
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          preferred_language: 'en'
        }
      };
      
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should validate without optional fields', () => {
      const validData = { 
        body: {
          email: 'test@example.com',
          password: 'password123'
        }
      };
      
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject an invalid email', () => {
      const invalidData = { 
        body: {
          email: 'not-an-email',
          password: 'password123'
        }
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('email');
      }
    });
    
    it('should reject a short password', () => {
      const invalidData = { 
        body: {
          email: 'test@example.com',
          password: 'short'
        }
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('password');
        expect(result.error.errors[0].message).toContain('at least 8 characters');
      }
    });
    
    it('should reject a short name', () => {
      const invalidData = { 
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'A'
        }
      };
      
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('name');
        expect(result.error.errors[0].message).toContain('at least 2 characters');
      }
    });
  });

  describe('loginSchema', () => {
    it('should validate a valid login request', () => {
      const validData = { 
        body: {
          email: 'test@example.com',
          password: 'password123',
          remember_me: true
        }
      };
      
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should validate without optional fields', () => {
      const validData = { 
        body: {
          email: 'test@example.com',
          password: 'password123'
        }
      };
      
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject an invalid email', () => {
      const invalidData = { 
        body: {
          email: 'not-an-email',
          password: 'password123'
        }
      };
      
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('email');
      }
    });
    
    it('should reject an empty password', () => {
      const invalidData = { 
        body: {
          email: 'test@example.com',
          password: ''
        }
      };
      
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('password');
        expect(result.error.errors[0].message).toContain('Password is required');
      }
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate a valid password change request', () => {
      const validData = { 
        body: {
          current_password: 'oldpassword',
          new_password: 'newpassword123',
          confirm_password: 'newpassword123'
        }
      };
      
      const result = changePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject when passwords do not match', () => {
      const invalidData = { 
        body: {
          current_password: 'oldpassword',
          new_password: 'newpassword123',
          confirm_password: 'differentpassword'
        }
      };
      
      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('confirm_password');
        expect(result.error.errors[0].message).toContain('Passwords do not match');
      }
    });
    
    it('should reject a short new password', () => {
      const invalidData = { 
        body: {
          current_password: 'oldpassword',
          new_password: 'short',
          confirm_password: 'short'
        }
      };
      
      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('new_password');
        expect(result.error.errors[0].message).toContain('at least 8 characters');
      }
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate a valid forgot password request', () => {
      const validData = { 
        body: {
          email: 'test@example.com'
        }
      };
      
      const result = forgotPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject an invalid email', () => {
      const invalidData = { 
        body: {
          email: 'not-an-email'
        }
      };
      
      const result = forgotPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('email');
        expect(result.error.errors[0].message).toContain('Invalid email format');
      }
    });
  });

  describe('resetPasswordSchema', () => {
    it('should validate a valid password reset request', () => {
      const validData = { 
        body: {
          token: 'valid-reset-token',
          password: 'newpassword123',
          confirm_password: 'newpassword123'
        }
      };
      
      const result = resetPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should reject when passwords do not match', () => {
      const invalidData = { 
        body: {
          token: 'valid-reset-token',
          password: 'newpassword123',
          confirm_password: 'differentpassword'
        }
      };
      
      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('confirm_password');
        expect(result.error.errors[0].message).toContain('Passwords do not match');
      }
    });
    
    it('should reject a missing token', () => {
      const invalidData = { 
        body: {
          token: '',
          password: 'newpassword123',
          confirm_password: 'newpassword123'
        }
      };
      
      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('token');
        expect(result.error.errors[0].message).toContain('Reset token is required');
      }
    });
    
    it('should reject a short password', () => {
      const invalidData = { 
        body: {
          token: 'valid-reset-token',
          password: 'short',
          confirm_password: 'short'
        }
      };
      
      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('password');
        expect(result.error.errors[0].message).toContain('at least 8 characters');
      }
    });
  });
});