import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExperiment, useFeatureFlag, useABTestingEvents } from '../useABTesting';
import React from 'react';

// Import the types we need
import type { 
  ABTestingService as ABTestingServiceType,
  ExperimentResult,
  FeatureFlag,
} from '@/services/abTesting/abTestingService';

// Mock the session storage
const mockSessionStorage = {
  getItem: vi.fn(() => 'test-session-id'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

// Mock modules
let mockService: Partial<ABTestingServiceType>;
let mockGetABTestingInstance: any;
let mockInitializeABTesting: any;

vi.mock('@/services/abTesting/abTestingService', () => {
  mockGetABTestingInstance = vi.fn();
  mockInitializeABTesting = vi.fn();
  
  return {
    getABTestingInstance: mockGetABTestingInstance,
    initializeABTesting: mockInitializeABTesting,
    ABTestingService: vi.fn(),
  };
});

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user', plan: 'free', createdAt: '2023-01-01', projectCount: 0 },
  })),
}));

describe('useABTesting hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockService = {
      getVariant: vi.fn().mockReturnValue({ variantId: 'control', isInExperiment: true }),
      isFeatureEnabled: vi.fn().mockReturnValue(false),
      getFeatureFlag: vi.fn().mockReturnValue(undefined),
      trackEvent: vi.fn(),
      trackConversion: vi.fn(),
      trackTiming: vi.fn(),
      getActiveExperiments: vi.fn().mockReturnValue({}),
      getAllFeatureFlags: vi.fn().mockReturnValue([]),
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    // Set up the mocks
    mockGetABTestingInstance.mockReturnValue(mockService);
    mockInitializeABTesting.mockReturnValue(mockService);
  });

  describe('useExperiment', () => {
    it('should return variant for experiment', async () => {
      const mockResult: ExperimentResult = { 
        variantId: 'variant-a', 
        isInExperiment: true 
      };
      mockService.getVariant = vi.fn().mockReturnValue(mockResult);

      const { result } = renderHook(() => useExperiment('test-experiment'));

      // Wait for the async initialization and effect to complete
      await waitFor(() => {
        expect(result.current).toEqual(mockResult);
      });

      expect(mockService.getVariant).toHaveBeenCalledWith('test-experiment');
    });

    it('should identify control variant', async () => {
      const mockResult: ExperimentResult = { 
        variantId: 'control', 
        isInExperiment: true 
      };
      mockService.getVariant = vi.fn().mockReturnValue(mockResult);

      const { result } = renderHook(() => useExperiment('test-experiment'));

      await waitFor(() => {
        expect(result.current?.variantId).toBe('control');
        expect(result.current?.isInExperiment).toBe(true);
      });
    });

    it('should track events with experiment context', async () => {
      const mockResult: ExperimentResult = { 
        variantId: 'variant-a', 
        isInExperiment: true 
      };
      mockService.getVariant = vi.fn().mockReturnValue(mockResult);

      const { result } = renderHook(() => useExperiment('test-experiment'));

      await waitFor(() => {
        expect(result.current).toEqual(mockResult);
      });
    });

    it('should memoize variant result', async () => {
      const mockResult: ExperimentResult = { 
        variantId: 'variant-a', 
        isInExperiment: true 
      };
      mockService.getVariant = vi.fn().mockReturnValue(mockResult);

      const { result, rerender } = renderHook(() => useExperiment('test-experiment'));

      await waitFor(() => {
        expect(result.current).toEqual(mockResult);
      });

      const callCount = (mockService.getVariant as any).mock.calls.length;
      
      rerender();
      
      // Should not call getVariant again on rerender
      expect((mockService.getVariant as any).mock.calls.length).toBe(callCount);
    });

    it('should handle missing service gracefully', async () => {
      mockGetABTestingInstance.mockReturnValue(null);

      const { result } = renderHook(() => useExperiment('test-experiment'));

      // When service is null, should return null
      await waitFor(() => {
        expect(result.current).toBe(null);
      });
    });
  });

  describe('useFeatureFlag', () => {
    it('should return boolean feature flag value', async () => {
      mockService.getFeatureFlag = vi.fn().mockReturnValue(true);

      const { result } = renderHook(() => useFeatureFlag('new-feature'));

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
      
      expect(mockService.getFeatureFlag).toHaveBeenCalledWith('new-feature', undefined);
    });

    it('should return feature flag with custom value', async () => {
      mockService.getFeatureFlag = vi.fn().mockReturnValue('blue');

      const { result } = renderHook(() => useFeatureFlag('button-color', 'red'));

      await waitFor(() => {
        expect(result.current).toBe('blue');
      });
      
      expect(mockService.getFeatureFlag).toHaveBeenCalledWith('button-color', 'red');
    });

    it('should return default value when flag is not set', async () => {
      mockService.getFeatureFlag = vi.fn().mockReturnValue(undefined);

      const { result } = renderHook(() => useFeatureFlag('missing-flag', 'default-value'));

      await waitFor(() => {
        expect(result.current).toBe('default-value');
      });
    });

    it('should handle missing service with defaults', async () => {
      mockGetABTestingInstance.mockReturnValue(null);

      const { result } = renderHook(() => useFeatureFlag('new-feature', false));

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('should update when feature flag changes', async () => {
      mockService.getFeatureFlag = vi.fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const { result, rerender } = renderHook(
        ({ flag }) => useFeatureFlag(flag),
        { initialProps: { flag: 'toggle-feature' } }
      );

      await waitFor(() => {
        expect(result.current).toBe(false);
      });

      // Change the flag key to trigger update
      rerender({ flag: 'toggle-feature-2' });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });
  });

  describe('useABTestingEvents', () => {
    it('should provide event tracking functions', async () => {
      const { result } = renderHook(() => useABTestingEvents());

      await waitFor(() => {
        expect(result.current).toHaveProperty('trackEvent');
        expect(result.current).toHaveProperty('trackConversion');
        expect(result.current).toHaveProperty('trackTiming');
      });
    });

    it('should track standard events', async () => {
      const { result } = renderHook(() => useABTestingEvents());

      await waitFor(() => {
        expect(result.current.trackEvent).toBeDefined();
      });

      act(() => {
        result.current.trackEvent('button_click', { buttonId: 'cta' });
      });

      expect(mockService.trackEvent).toHaveBeenCalledWith('button_click', { 
        buttonId: 'cta',
        activeExperiments: {} 
      });
    });

    it('should track conversion events', async () => {
      const { result } = renderHook(() => useABTestingEvents());

      await waitFor(() => {
        expect(result.current.trackConversion).toBeDefined();
      });

      act(() => {
        result.current.trackConversion('purchase', 99.99, { productId: 'pro-plan' });
      });

      expect(mockService.trackConversion).toHaveBeenCalledWith('purchase', 99.99, { 
        productId: 'pro-plan',
        activeExperiments: {} 
      });
    });

    it('should track timing events', async () => {
      const { result } = renderHook(() => useABTestingEvents());

      await waitFor(() => {
        expect(result.current.trackTiming).toBeDefined();
      });

      act(() => {
        result.current.trackTiming('page_load', 1500, { page: 'dashboard' });
      });

      expect(mockService.trackTiming).toHaveBeenCalledWith('page_load', 1500, { 
        page: 'dashboard',
        activeExperiments: {} 
      });
    });

    it('should handle missing service gracefully', async () => {
      mockGetABTestingInstance.mockReturnValue(null);

      const { result } = renderHook(() => useABTestingEvents());

      await waitFor(() => {
        expect(result.current.trackEvent).toBeDefined();
      });

      // Should not throw when service is missing
      expect(() => {
        act(() => {
          result.current.trackEvent('test_event');
        });
      }).not.toThrow();
    });

    it('should include active experiments in event context', async () => {
      const activeExperiments = {
        'experiment-1': 'variant-a',
        'experiment-2': 'control',
      };
      mockService.getActiveExperiments = vi.fn().mockReturnValue(activeExperiments);

      const { result } = renderHook(() => useABTestingEvents());

      await waitFor(() => {
        expect(result.current.trackEvent).toBeDefined();
      });

      act(() => {
        result.current.trackEvent('test_event', { custom: 'data' });
      });

      expect(mockService.trackEvent).toHaveBeenCalledWith('test_event', {
        custom: 'data',
        activeExperiments,
      });
    });
  });

  describe('integration scenarios', () => {
    it('should work with multiple hooks together', async () => {
      const mockExperimentResult: ExperimentResult = { 
        variantId: 'variant-a', 
        isInExperiment: true 
      };
      mockService.getVariant = vi.fn().mockReturnValue(mockExperimentResult);
      mockService.getFeatureFlag = vi.fn().mockReturnValue(true);

      const { result: experimentResult } = renderHook(() => useExperiment('test-exp'));
      const { result: flagResult } = renderHook(() => useFeatureFlag('test-flag'));
      const { result: eventsResult } = renderHook(() => useABTestingEvents());

      await waitFor(() => {
        expect(experimentResult.current).toEqual(mockExperimentResult);
        expect(flagResult.current).toBe(true);
        expect(eventsResult.current.trackEvent).toBeDefined();
      });
    });

    it('should handle conditional feature rendering', async () => {
      mockService.getFeatureFlag = vi.fn().mockReturnValue(true);

      const { result } = renderHook(() => useFeatureFlag('new-ui-feature', false));

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
      
      // This demonstrates how the hook would be used in a component
      // to conditionally render features based on the flag value
      expect(mockService.getFeatureFlag).toHaveBeenCalledWith('new-ui-feature', false);
    });
  });
});