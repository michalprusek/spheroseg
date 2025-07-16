import { formatNumber } from '../metricCalculations';

describe('Metric Calculations', () => {
  describe('formatNumber', () => {
    it('formats numbers with 4 decimal places', () => {
      expect(formatNumber(123.45678)).toBe('123.4568');
      expect(formatNumber(0.12345)).toBe('0.1235');
      expect(formatNumber(100)).toBe('100.0000');
    });

    it('handles zero correctly', () => {
      expect(formatNumber(0)).toBe('0.0000');
    });

    it('handles negative numbers correctly', () => {
      expect(formatNumber(-123.45678)).toBe('-123.4568');
    });
  });
});
