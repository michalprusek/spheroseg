/**
 * Timer utilities that work in both browser and test environments
 * These wrappers ensure timer functions are available in jsdom environment
 */

/**
 * Wrapper for setTimeout that works in jsdom
 */
export const setTimeoutSafe = (callback: (...args: any[]) => void, delay?: number): NodeJS.Timeout => {
  if (typeof window !== 'undefined' && window.setTimeout) {
    return window.setTimeout(callback, delay) as unknown as NodeJS.Timeout;
  }
  return setTimeout(callback, delay);
};

/**
 * Wrapper for clearTimeout that works in jsdom
 */
export const clearTimeoutSafe = (timeoutId: NodeJS.Timeout | null | undefined): void => {
  if (!timeoutId) return;
  
  if (typeof window !== 'undefined' && window.clearTimeout) {
    window.clearTimeout(timeoutId as unknown as number);
  } else if (typeof clearTimeout === 'function') {
    clearTimeout(timeoutId);
  }
};

/**
 * Wrapper for setInterval that works in jsdom
 */
export const setIntervalSafe = (callback: (...args: any[]) => void, delay?: number): NodeJS.Timeout => {
  if (typeof window !== 'undefined' && window.setInterval) {
    return window.setInterval(callback, delay) as unknown as NodeJS.Timeout;
  }
  return setInterval(callback, delay);
};

/**
 * Wrapper for clearInterval that works in jsdom
 */
export const clearIntervalSafe = (intervalId: NodeJS.Timeout | null | undefined): void => {
  if (!intervalId) return;
  
  if (typeof window !== 'undefined' && window.clearInterval) {
    window.clearInterval(intervalId as unknown as number);
  } else if (typeof clearInterval === 'function') {
    clearInterval(intervalId);
  }
};