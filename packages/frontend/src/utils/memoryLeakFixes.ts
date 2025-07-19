/**
 * Memory Leak Prevention Utilities
 * 
 * Common patterns to prevent memory leaks in React components:
 * 1. Clean up event listeners
 * 2. Cancel timers and intervals
 * 3. Abort fetch requests
 * 4. Revoke object URLs
 * 5. Disconnect observers
 * 6. Close WebSocket connections
 * 7. Clear subscriptions
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to track if component is mounted
 * Prevents setState calls after unmount
 */
export function useIsMounted() {
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

/**
 * Hook for safe async operations
 * Prevents setState after component unmount
 */
export function useSafeAsync<T>() {
  const isMounted = useIsMounted();

  const safeAsync = useCallback(
    async (asyncFn: () => Promise<T>): Promise<T | undefined> => {
      try {
        const result = await asyncFn();
        if (isMounted.current) {
          return result;
        }
      } catch (error) {
        if (isMounted.current) {
          throw error;
        }
      }
    },
    [isMounted]
  );

  return safeAsync;
}

/**
 * Hook for managing abort controllers
 * Automatically aborts on unmount
 */
export function useAbortController() {
  const abortController = useRef<AbortController>();

  useEffect(() => {
    abortController.current = new AbortController();

    return () => {
      abortController.current?.abort();
    };
  }, []);

  const getSignal = useCallback(() => {
    if (!abortController.current) {
      abortController.current = new AbortController();
    }
    return abortController.current.signal;
  }, []);

  const abort = useCallback(() => {
    abortController.current?.abort();
    abortController.current = new AbortController();
  }, []);

  return { getSignal, abort };
}

/**
 * Hook for managing timers
 * Automatically clears on unmount
 */
export function useTimer() {
  const timers = useRef<Set<NodeJS.Timeout>>(new Set());

  useEffect(() => {
    return () => {
      timers.current.forEach(timer => clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  const setTimeout = useCallback((callback: () => void, delay: number) => {
    const timer = globalThis.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
    return timer;
  }, []);

  const clearTimeout = useCallback((timer: NodeJS.Timeout) => {
    globalThis.clearTimeout(timer);
    timers.current.delete(timer);
  }, []);

  const setInterval = useCallback((callback: () => void, delay: number) => {
    const timer = globalThis.setInterval(callback, delay);
    timers.current.add(timer);
    return timer;
  }, []);

  const clearInterval = useCallback((timer: NodeJS.Timeout) => {
    globalThis.clearInterval(timer);
    timers.current.delete(timer);
  }, []);

  return { setTimeout, clearTimeout, setInterval, clearInterval };
}

/**
 * Hook for managing event listeners
 * Automatically removes on unmount
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | HTMLElement | null = window,
  options?: boolean | AddEventListenerOptions
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!element) return;

    const eventListener = (event: Event) => savedHandler.current(event as WindowEventMap[K]);

    element.addEventListener(eventName, eventListener, options);

    return () => {
      element.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options]);
}

/**
 * Hook for managing blob URLs
 * Automatically revokes on unmount
 */
export function useBlobUrl() {
  const urls = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      urls.current.forEach(url => URL.revokeObjectURL(url));
      urls.current.clear();
    };
  }, []);

  const createObjectURL = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  }, []);

  const revokeObjectURL = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }, []);

  return { createObjectURL, revokeObjectURL };
}

/**
 * Hook for managing ResizeObserver
 * Automatically disconnects on unmount
 */
export function useResizeObserver(
  ref: React.RefObject<HTMLElement>,
  callback: ResizeObserverCallback
) {
  const observer = useRef<ResizeObserver>();

  useEffect(() => {
    if (!ref.current) return;

    observer.current = new ResizeObserver(callback);
    observer.current.observe(ref.current);

    return () => {
      observer.current?.disconnect();
    };
  }, [ref, callback]);
}

/**
 * Hook for managing IntersectionObserver
 * Automatically disconnects on unmount
 */
export function useIntersectionObserver(
  ref: React.RefObject<HTMLElement>,
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) {
  const observer = useRef<IntersectionObserver>();

  useEffect(() => {
    if (!ref.current) return;

    observer.current = new IntersectionObserver(callback, options);
    observer.current.observe(ref.current);

    return () => {
      observer.current?.disconnect();
    };
  }, [ref, callback, options]);
}

/**
 * Hook for managing WebSocket connections
 * Automatically closes on unmount
 */
export function useWebSocket(
  url: string | null,
  options?: {
    onOpen?: (event: Event) => void;
    onMessage?: (event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
    reconnect?: boolean;
    reconnectInterval?: number;
    reconnectAttempts?: number;
  }
) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<NodeJS.Timeout>();
  const isMounted = useIsMounted();

  const connect = useCallback(() => {
    if (!url || !isMounted.current) return;

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = (event) => {
        reconnectCount.current = 0;
        options?.onOpen?.(event);
      };

      ws.current.onmessage = (event) => {
        if (isMounted.current) {
          options?.onMessage?.(event);
        }
      };

      ws.current.onerror = (event) => {
        if (isMounted.current) {
          options?.onError?.(event);
        }
      };

      ws.current.onclose = (event) => {
        if (isMounted.current) {
          options?.onClose?.(event);

          if (
            options?.reconnect &&
            reconnectCount.current < (options.reconnectAttempts || 5)
          ) {
            reconnectCount.current++;
            reconnectTimer.current = setTimeout(
              connect,
              options.reconnectInterval || 5000
            );
          }
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }, [url, options, isMounted]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(data);
    }
  }, []);

  const close = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
    }
  }, []);

  return { send, close, ws: ws.current };
}

/**
 * Utility to clean up multiple subscriptions
 */
export class SubscriptionManager {
  private subscriptions: Set<() => void> = new Set();

  add(cleanup: () => void) {
    this.subscriptions.add(cleanup);
    return () => {
      this.subscriptions.delete(cleanup);
      cleanup();
    };
  }

  cleanup() {
    this.subscriptions.forEach(cleanup => cleanup());
    this.subscriptions.clear();
  }
}

/**
 * Hook for managing subscriptions
 * Automatically cleans up on unmount
 */
export function useSubscriptionManager() {
  const manager = useRef(new SubscriptionManager());

  useEffect(() => {
    return () => {
      manager.current.cleanup();
    };
  }, []);

  return manager.current;
}