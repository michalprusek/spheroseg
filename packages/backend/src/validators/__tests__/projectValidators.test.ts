import {
  listProjectsSchema,
  createProjectSchema,
  projectIdSchema,
  deleteProjectSchema,
  duplicateProjectSchema,
} from '../projectValidators';

describe('projectValidators', () => {
  describe('listProjectsSchema', () => {
    it('should validate a valid listing request', () => {
      const validData = {
        query: {
          limit: '20',
          offset: '10',
        },
      };

      const result = listProjectsSchema.safeParse(validData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.query.limit).toBe(20);
        expect(result.data.query.offset).toBe(10);
      }
    });

    it('should validate with default values when parameters are missing', () => {
      const validData = { query: {} };

      const result = listProjectsSchema.safeParse(validData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.query.limit).toBe(10); // Default value
        expect(result.data.query.offset).toBe(0); // Default value
      }
    });

    it('should reject non-numeric limit', () => {
      const invalidData = {
        query: {
          limit: 'not-a-number',
        },
      };

      const result = listProjectsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('limit');
        expect(result.error.errors[0].message).toContain('must be a positive integer');
      }
    });

    it('should reject non-numeric offset', () => {
      const invalidData = {
        query: {
          offset: 'not-a-number',
        },
      };

      const result = listProjectsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('offset');
        expect(result.error.errors[0].message).toContain('must be a positive integer');
      }
    });
  });

  describe('createProjectSchema', () => {
    it('should validate a valid project creation request', () => {
      const validData = {
        body: {
          title: 'Test Project',
          description: 'This is a test project',
        },
      };

      const result = createProjectSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate without optional description', () => {
      const validData = {
        body: {
          title: 'Test Project',
        },
      };

      const result = createProjectSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject an empty title', () => {
      const invalidData = {
        body: {
          title: '',
          description: 'This is a test project',
        },
      };

      const result = createProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('title');
        expect(result.error.errors[0].message).toContain('cannot be empty');
      }
    });

    it('should reject missing title', () => {
      const invalidData = {
        body: {
          description: 'This is a test project',
        },
      };

      const result = createProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('title');
        expect(result.error.errors[0].message).toContain('required');
      }
    });
  });

  describe('projectIdSchema', () => {
    it('should validate a valid UUID project ID', () => {
      const validData = {
        params: {
          id: '123e4567-e89b-12d3-a456-426614174000',
        },
      };

      const result = projectIdSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate "new" as a special ID', () => {
      const validData = {
        params: {
          id: 'new',
        },
      };

      const result = projectIdSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject an invalid UUID format', () => {
      const invalidData = {
        params: {
          id: 'not-a-uuid',
        },
      };

      const result = projectIdSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('id');
        expect(result.error.errors[0].message).toContain('Invalid project ID format');
      }
    });
  });

  describe('deleteProjectSchema', () => {
    it('should validate a valid UUID project ID', () => {
      const validData = {
        params: {
          id: '123e4567-e89b-12d3-a456-426614174000',
        },
      };

      const result = deleteProjectSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject "new" as an ID for delete operations', () => {
      const invalidData = {
        params: {
          id: 'new',
        },
      };

      const result = deleteProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('id');
        expect(result.error.errors[0].message).toContain('Invalid project ID format');
      }
    });

    it('should reject an invalid UUID format', () => {
      const invalidData = {
        params: {
          id: 'not-a-uuid',
        },
      };

      const result = deleteProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('id');
        expect(result.error.errors[0].message).toContain('Invalid project ID format');
      }
    });
  });

  describe('duplicateProjectSchema', () => {
    it('should validate a valid UUID project ID', () => {
      const validData = {
        params: {
          id: '123e4567-e89b-12d3-a456-426614174000',
        },
      };

      const result = duplicateProjectSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject an invalid UUID format', () => {
      const invalidData = {
        params: {
          id: 'not-a-uuid',
        },
      };

      const result = duplicateProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('id');
        expect(result.error.errors[0].message).toContain('Invalid original project ID format');
      }
    });
  });
});
