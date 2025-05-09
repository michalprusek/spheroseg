import { describe, it, expect } from 'vitest';
import { format, formatDistanceToNow } from 'date-fns';
import { enUS, cs } from 'date-fns/locale';

describe('Date Formatting Utilities', () => {
  // Test date: January 15, 2023, 10:30:45 AM
  const testDate = new Date(2023, 0, 15, 10, 30, 45);

  describe('format function', () => {
    it('formats dates correctly with different patterns', () => {
      // Test standard date format (yyyy-MM-dd)
      expect(format(testDate, 'yyyy-MM-dd')).toBe('2023-01-15');

      // Test date with time (yyyy-MM-dd HH:mm:ss)
      expect(format(testDate, 'yyyy-MM-dd HH:mm:ss')).toBe('2023-01-15 10:30:45');

      // Test month and day format (MMMM d, yyyy)
      expect(format(testDate, 'MMMM d, yyyy')).toBe('January 15, 2023');

      // Test time only format (HH:mm)
      expect(format(testDate, 'HH:mm')).toBe('10:30');

      // Test day of week format (EEEE)
      expect(format(testDate, 'EEEE')).toBe('Sunday');
    });

    it('formats dates correctly with different locales', () => {
      // Test English locale
      expect(format(testDate, 'MMMM d, yyyy', { locale: enUS })).toBe('January 15, 2023');

      // Test Czech locale
      expect(format(testDate, 'MMMM d, yyyy', { locale: cs })).toBe('ledna 15, 2023');

      // Test day of week with English locale
      expect(format(testDate, 'EEEE', { locale: enUS })).toBe('Sunday');

      // Test day of week with Czech locale
      expect(format(testDate, 'EEEE', { locale: cs })).toBe('neděle');
    });
  });

  describe('formatDistanceToNow function', () => {
    it('formats relative time correctly', () => {
      // Create a date in the past (1 day ago from now)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Test with English locale
      const result = formatDistanceToNow(oneDayAgo, { locale: enUS, addSuffix: true });
      expect(result).toContain('day ago');

      // Create a date in the past (2 hours ago from now)
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      // Test with English locale
      const hoursResult = formatDistanceToNow(twoHoursAgo, { locale: enUS, addSuffix: true });
      expect(hoursResult).toContain('hours ago');

      // Create a date in the future (1 day from now)
      const oneDayFromNow = new Date();
      oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

      // Test with English locale and future date
      const futureResult = formatDistanceToNow(oneDayFromNow, { locale: enUS, addSuffix: true });
      expect(futureResult).toContain('in');
    });

    it('formats relative time correctly with different locales', () => {
      // Create a date in the past (1 day ago from now)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Test with Czech locale
      const czechResult = formatDistanceToNow(oneDayAgo, { locale: cs, addSuffix: true });
      expect(czechResult).toContain('před');

      // Create a date in the future (1 day from now)
      const oneDayFromNow = new Date();
      oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

      // Test with Czech locale and future date
      const czechFutureResult = formatDistanceToNow(oneDayFromNow, { locale: cs, addSuffix: true });
      expect(czechFutureResult).toContain('za');
    });
  });
});
