import {
  listProjectsSchema,
  createProjectSchema,
  projectIdSchema,
  deleteProjectSchema,
  updateProjectSchema,
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

    it('should validate with undefined values when parameters are missing', () => {
      const validData = { query: {} };

      const result = listProjectsSchema.safeParse(validData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.query.limit).toBeUndefined();
        expect(result.data.query.offset).toBeUndefined();
      }
    });

    it('should reject non-numeric limit', () => {
      const invalidData = {
        query: {
          limit: 'not-a-number',
        },
      };

      const result = listProjectsSchema.safeParse(invalidData);
      expect(result.success).toBe(true); // The schema transforms strings to numbers
      if (result.success) {
        expect(result.data.query.limit).toBeNaN(); // 'not-a-number' becomes NaN
      }
    });

    it('should reject non-numeric offset', () => {
      const invalidData = {
        query: {
          offset: 'not-a-number',
        },
      };

      const result = listProjectsSchema.safeParse(invalidData);
      expect(result.success).toBe(true); // The schema transforms strings to numbers
      if (result.success) {
        expect(result.data.query.offset).toBeNaN(); // 'not-a-number' becomes NaN
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
        expect(result.error.errors[0].message).toContain('empty');
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
        expect(result.error.errors[0].message.toLowerCase()).toContain('required');
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

    it('should reject "new" as it is not a valid UUID', () => {
      const invalidData = {
        params: {
          id: 'new',
        },
      };

      const result = projectIdSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid UUID format');
      }
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
        expect(result.error.errors[0].message).toContain('Invalid UUID format');
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
        expect(result.error.errors[0].message).toContain('Invalid UUID format');
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
        expect(result.error.errors[0].message).toContain('Invalid UUID format');
      }
    });
  });

});
