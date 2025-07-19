import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useIsMounted,
  useSafeAsync,
  useAbortController,
  useTimer,
  useEventListener,
  useBlobUrl,
  useResizeObserver,
  useIntersectionObserver,
  useWebSocket,
  useSubscriptionManager,
  SubscriptionManager
} from '../memoryLeakFixes';

describe('Memory Leak Prevention Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('useIsMounted', () => {
    it('should track mounted state', () => {
      const { result, unmount } = renderHook(() => useIsMounted());
      
      expect(result.current.current).toBe(true);
      
      unmount();
      
      expect(result.current.current).toBe(false);
    });
  });

  describe('useSafeAsync', () => {
    it('should not execute callback after unmount', async () => {
      const { result, unmount } = renderHook(() => useSafeAsync());
      const mockCallback = vi.fn().mockResolvedValue('test');
      
      let promiseResult: any;
      
      act(() => {
        result.current(mockCallback).then(res => {
          promiseResult = res;
        });
      });
      
      unmount();
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      expect(mockCallback).toHaveBeenCalled();
      expect(promiseResult).toBeUndefined();
    });

    it('should execute callback when mounted', async () => {
      const { result } = renderHook(() => useSafeAsync());
      const mockCallback = vi.fn().mockResolvedValue('test');
      
      let promiseResult: any;
      
      await act(async () => {
        promiseResult = await result.current(mockCallback);
      });
      
      expect(mockCallback).toHaveBeenCalled();
      expect(promiseResult).toBe('test');
    });
  });

  describe('useAbortController', () => {
    it('should provide abort controller signal', () => {
      const { result } = renderHook(() => useAbortController());
      
      const signal = result.current.getSignal();
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });

    it('should abort on unmount', () => {
      const { result, unmount } = renderHook(() => useAbortController());
      
      const signal = result.current.getSignal();
      expect(signal.aborted).toBe(false);
      
      unmount();
      
      expect(signal.aborted).toBe(true);
    });

    it('should create new controller after abort', () => {
      const { result } = renderHook(() => useAbortController());
      
      const signal1 = result.current.getSignal();
      
      act(() => {
        result.current.abort();
      });
      
      const signal2 = result.current.getSignal();
      
      expect(signal1).not.toBe(signal2);
      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(false);
    });
  });

  describe('useTimer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clear timeouts on unmount', () => {
      const { result, unmount } = renderHook(() => useTimer());
      const callback = jest.fn();
      
      act(() => {
        result.current.setTimeout(callback, 1000);
      });
      
      unmount();
      
      jest.advanceTimersByTime(1500);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should execute timeout when mounted', () => {
      const { result } = renderHook(() => useTimer());
      const callback = jest.fn();
      
      act(() => {
        result.current.setTimeout(callback, 1000);
      });
      
      jest.advanceTimersByTime(1500);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should clear intervals on unmount', () => {
      const { result, unmount } = renderHook(() => useTimer());
      const callback = jest.fn();
      
      act(() => {
        result.current.setInterval(callback, 100);
      });
      
      jest.advanceTimersByTime(250);
      expect(callback).toHaveBeenCalledTimes(2);
      
      unmount();
      
      jest.advanceTimersByTime(250);
      expect(callback).toHaveBeenCalledTimes(2); // No additional calls
    });

    it('should manually clear timers', () => {
      const { result } = renderHook(() => useTimer());
      const callback = jest.fn();
      
      let timerId: NodeJS.Timeout;
      act(() => {
        timerId = result.current.setTimeout(callback, 1000);
      });
      
      act(() => {
        result.current.clearTimeout(timerId);
      });
      
      jest.advanceTimersByTime(1500);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('useEventListener', () => {
    it('should add and remove event listeners', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const handler = jest.fn();
      
      const { unmount } = renderHook(() => 
        useEventListener('click', handler)
      );
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), undefined);
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), undefined);
    });

    it('should handle events', () => {
      const handler = jest.fn();
      
      renderHook(() => useEventListener('click', handler));
      
      const event = new MouseEvent('click');
      window.dispatchEvent(event);
      
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should work with custom elements', () => {
      const element = document.createElement('div');
      const handler = jest.fn();
      const addEventListenerSpy = jest.spyOn(element, 'addEventListener');
      
      renderHook(() => useEventListener('click', handler, element));
      
      expect(addEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('useBlobUrl', () => {
    const mockCreateObjectURL = jest.fn();
    const mockRevokeObjectURL = jest.fn();
    
    beforeEach(() => {
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;
      mockCreateObjectURL.mockImplementation(() => 'blob:test');
    });

    it('should create and track blob URLs', () => {
      const { result } = renderHook(() => useBlobUrl());
      const blob = new Blob(['test']);
      
      let url: string;
      act(() => {
        url = result.current.createObjectURL(blob);
      });
      
      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
      expect(url!).toBe('blob:test');
    });

    it('should revoke all URLs on unmount', () => {
      const { result, unmount } = renderHook(() => useBlobUrl());
      const blob1 = new Blob(['test1']);
      const blob2 = new Blob(['test2']);
      
      act(() => {
        result.current.createObjectURL(blob1);
        result.current.createObjectURL(blob2);
      });
      
      unmount();
      
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
    });

    it('should manually revoke URLs', () => {
      const { result } = renderHook(() => useBlobUrl());
      const blob = new Blob(['test']);
      
      let url: string;
      act(() => {
        url = result.current.createObjectURL(blob);
        result.current.revokeObjectURL(url);
      });
      
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test');
    });
  });

  describe('useResizeObserver', () => {
    let mockObserve: jest.Mock;
    let mockDisconnect: jest.Mock;
    
    beforeEach(() => {
      mockObserve = jest.fn();
      mockDisconnect = jest.fn();
      
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: mockObserve,
        disconnect: mockDisconnect,
        unobserve: jest.fn(),
      }));
    });

    it('should observe element and disconnect on unmount', () => {
      const ref = { current: document.createElement('div') };
      const callback = jest.fn();
      
      const { unmount } = renderHook(() => 
        useResizeObserver(ref, callback)
      );
      
      expect(mockObserve).toHaveBeenCalledWith(ref.current);
      
      unmount();
      
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should not observe if ref is null', () => {
      const ref = { current: null };
      const callback = jest.fn();
      
      renderHook(() => useResizeObserver(ref, callback));
      
      expect(mockObserve).not.toHaveBeenCalled();
    });
  });

  describe('SubscriptionManager', () => {
    it('should manage multiple subscriptions', () => {
      const manager = new SubscriptionManager();
      const cleanup1 = jest.fn();
      const cleanup2 = jest.fn();
      
      manager.add(cleanup1);
      manager.add(cleanup2);
      
      manager.cleanup();
      
      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const manager = new SubscriptionManager();
      const cleanup = jest.fn();
      
      const unsubscribe = manager.add(cleanup);
      
      unsubscribe();
      manager.cleanup();
      
      expect(cleanup).toHaveBeenCalledTimes(1); // Only called by unsubscribe
    });
  });

  describe('useSubscriptionManager', () => {
    it('should cleanup on unmount', () => {
      const { result, unmount } = renderHook(() => useSubscriptionManager());
      const cleanup = jest.fn();
      
      act(() => {
        result.current.add(cleanup);
      });
      
      unmount();
      
      expect(cleanup).toHaveBeenCalled();
    });
  });
});