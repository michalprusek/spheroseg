import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExperiment, useFeatureFlag, useABTestingEvents } from '../useABTesting';
import { ABTestingService } from '@/services/abTesting/abTestingService';
import { ABTestingContext } from '../../services/abTesting/ABTestingContext';
import React from 'react';

// Mock the ABTestingService
vi.mock('@/services/abTesting/abTestingService');

describe('useABTesting hooks', () => {
  let mockService: jest.Mocked<ABTestingService>;

  beforeEach(() => {
    mockService = new ABTestingService() as jest.Mocked<ABTestingService>;
    mockService.getVariant = vi.fn().mockReturnValue('control');
    mockService.isFeatureEnabled = vi.fn().mockReturnValue(false);
    mockService.getFeatureFlagValue = vi.fn().mockReturnValue(undefined);
    mockService.trackEvent = vi.fn();
    mockService.getActiveExperiments = vi.fn().mockReturnValue({});
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(ABTestingContext.Provider, { value: mockService }, children);
  };

  describe('useExperiment', () => {
    it('should return variant for experiment', () => {
      mockService.getVariant.mockReturnValue('variant-a');

      const { result } = renderHook(() => useExperiment('test-experiment'), { wrapper });

      expect(result.current.variant).toBe('variant-a');
      expect(result.current.isControl).toBe(false);
      expect(result.current.isVariant('variant-a')).toBe(true);
      expect(result.current.isVariant('variant-b')).toBe(false);
    });

    it('should identify control variant', () => {
      mockService.getVariant.mockReturnValue('control');

      const { result } = renderHook(() => useExperiment('test-experiment'), { wrapper });

      expect(result.current.variant).toBe('control');
      expect(result.current.isControl).toBe(true);
    });

    it('should track events with experiment context', () => {
      mockService.getVariant.mockReturnValue('variant-a');

      const { result } = renderHook(() => useExperiment('test-experiment'), { wrapper });

      act(() => {
        result.current.trackEvent('button_click', { buttonId: 'cta' });
      });

      expect(mockService.trackEvent).toHaveBeenCalledWith('button_click', { buttonId: 'cta' });
    });

    it('should memoize variant result', () => {
      mockService.getVariant.mockReturnValue('variant-a');

      const { result, rerender } = renderHook(() => useExperiment('test-experiment'), { wrapper });

      const firstResult = result.current;

      rerender();

      expect(result.current).toBe(firstResult);
      expect(mockService.getVariant).toHaveBeenCalledTimes(1);
    });

    it('should handle missing service gracefully', () => {
      const { result } = renderHook(() => useExperiment('test-experiment'));

      expect(result.current.variant).toBe('control');
      expect(result.current.isControl).toBe(true);
    });
  });

  describe('useFeatureFlag', () => {
    it('should return boolean feature flag value', () => {
      mockService.isFeatureEnabled.mockReturnValue(true);

      const { result } = renderHook(() => useFeatureFlag('new-feature'), { wrapper });

      expect(result.current).toBe(true);
      expect(mockService.isFeatureEnabled).toHaveBeenCalledWith('new-feature');
    });

    it('should return feature flag with custom value', () => {
      mockService.getFeatureFlagValue.mockReturnValue('blue');

      const { result } = renderHook(() => useFeatureFlag('button-color', 'red'), { wrapper });

      expect(result.current).toBe('blue');
      expect(mockService.getFeatureFlagValue).toHaveBeenCalledWith('button-color', 'red');
    });

    it('should return default value when flag is not set', () => {
      mockService.getFeatureFlagValue.mockReturnValue(undefined);

      const { result } = renderHook(() => useFeatureFlag('missing-flag', 'default'), { wrapper });

      expect(result.current).toBe('default');
    });

    it('should handle missing service with defaults', () => {
      const { result } = renderHook(() => useFeatureFlag('test-flag', false));

      expect(result.current).toBe(false);
    });

    it('should update when feature flag changes', () => {
      mockService.isFeatureEnabled.mockReturnValue(false);

      const { result, rerender } = renderHook(() => useFeatureFlag('dynamic-flag'), { wrapper });

      expect(result.current).toBe(false);

      // Simulate feature flag change
      mockService.isFeatureEnabled.mockReturnValue(true);

      rerender();

      expect(result.current).toBe(true);
    });
  });

  describe('useABTestingEvents', () => {
    it('should provide event tracking functions', () => {
      const { result } = renderHook(() => useABTestingEvents(), { wrapper });

      expect(result.current).toHaveProperty('trackEvent');
      expect(result.current).toHaveProperty('trackConversion');
      expect(result.current).toHaveProperty('trackTiming');
    });

    it('should track standard events', () => {
      const { result } = renderHook(() => useABTestingEvents(), { wrapper });

      act(() => {
        result.current.trackEvent('page_view', { page: '/home' });
      });

      expect(mockService.trackEvent).toHaveBeenCalledWith('page_view', { page: '/home' });
    });

    it('should track conversion events', () => {
      mockService.trackConversion = vi.fn();

      const { result } = renderHook(() => useABTestingEvents(), { wrapper });

      act(() => {
        result.current.trackConversion('purchase', 99.99);
      });

      expect(mockService.trackConversion).toHaveBeenCalledWith('purchase', 99.99);
    });

    it('should track timing events', () => {
      mockService.trackTiming = vi.fn();

      const { result } = renderHook(() => useABTestingEvents(), { wrapper });

      act(() => {
        result.current.trackTiming('page_load', 1500, { page: '/dashboard' });
      });

      expect(mockService.trackTiming).toHaveBeenCalledWith('page_load', 1500, { page: '/dashboard' });
    });

    it('should handle missing service gracefully', () => {
      const { result } = renderHook(() => useABTestingEvents());

      // Should not throw when calling methods
      expect(() => {
        result.current.trackEvent('test', {});
        result.current.trackConversion('test', 100);
        result.current.trackTiming('test', 100);
      }).not.toThrow();
    });

    it('should include active experiments in event context', () => {
      mockService.getActiveExperiments.mockReturnValue({
        'exp-1': 'variant-a',
        'exp-2': 'control',
      });

      const { result } = renderHook(() => useABTestingEvents(), { wrapper });

      act(() => {
        result.current.trackEvent('button_click', { buttonId: 'cta' });
      });

      // Service should have access to active experiments when tracking
      expect(mockService.getActiveExperiments).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should work with multiple hooks together', () => {
      mockService.getVariant.mockReturnValue('variant-a');
      mockService.isFeatureEnabled.mockReturnValue(true);

      const { result } = renderHook(
        () => ({
          experiment: useExperiment('test-exp'),
          featureFlag: useFeatureFlag('new-ui'),
          events: useABTestingEvents(),
        }),
        { wrapper },
      );

      expect(result.current.experiment.variant).toBe('variant-a');
      expect(result.current.featureFlag).toBe(true);
      expect(result.current.events.trackEvent).toBeDefined();
    });

    it('should handle conditional feature rendering', () => {
      mockService.isFeatureEnabled.mockReturnValueOnce(false).mockReturnValueOnce(true);

      const { result, rerender } = renderHook(
        () => {
          const showNewFeature = useFeatureFlag('new-feature');
          const showBetaFeature = useFeatureFlag('beta-feature');

          return { showNewFeature, showBetaFeature };
        },
        { wrapper },
      );

      expect(result.current.showNewFeature).toBe(false);
      expect(result.current.showBetaFeature).toBe(true);
    });
  });
});
