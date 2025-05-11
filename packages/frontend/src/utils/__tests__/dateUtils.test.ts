import { describe, it, expect } from 'vitest';
import { safeFormatDate } from '../dateUtils';

describe('dateUtils', () => {
  describe('safeFormatDate', () => {
    it('should handle valid Date objects', () => {
      const testDate = new Date('2023-05-15T12:00:00Z');
      const result = safeFormatDate(testDate, 'yyyy-MM-dd');

      // Just check that we get a non-empty string result for valid dates
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe('Unknown date');
    });

    it('should handle valid date strings', () => {
      const result = safeFormatDate('2023-05-15T12:00:00Z', 'yyyy-MM-dd');

      // Just check that we get a non-empty string result for valid dates
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe('Unknown date');
    });

    it('should return fallback for null dates', () => {
      const result = safeFormatDate(null, 'yyyy-MM-dd', 'No date');
      expect(result).toBe('No date');
    });

    it('should return fallback for undefined dates', () => {
      const result = safeFormatDate(undefined, 'yyyy-MM-dd', 'No date');
      expect(result).toBe('No date');
    });

    it('should return fallback for invalid Date objects', () => {
      const invalidDate = new Date('invalid-date');
      const result = safeFormatDate(invalidDate, 'yyyy-MM-dd', 'Invalid date');
      expect(result).toBe('Invalid date');
    });

    it('should return fallback for invalid date strings', () => {
      const result = safeFormatDate('not-a-date', 'yyyy-MM-dd', 'Invalid date');
      expect(result).toBe('Invalid date');
    });

    it('should use empty string as default fallback if not provided', () => {
      const result = safeFormatDate(null);
      expect(result).toBe('');
    });

    // Test for error handling by creating a scenario that would cause an error
    it('should handle errors gracefully', () => {
      // Create a Date object that will cause JSON.stringify to throw
      const circularObj: any = {};
      circularObj.circular = circularObj;

      // This should return the fallback without throwing
      const result = safeFormatDate(circularObj as any, 'yyyy-MM-dd', 'Error occurred');
      expect(result).toBe('Error occurred');
    });
  });
});
