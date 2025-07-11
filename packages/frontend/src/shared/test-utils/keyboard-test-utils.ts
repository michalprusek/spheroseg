/**
 * Keyboard Test Utilities
 */

import { vi } from 'vitest';
import { fireEvent } from '@testing-library/react';

export const createKeyboardEvent = (key: string, options: Partial<KeyboardEventInit> = {}) => {
  return new KeyboardEvent('keydown', {
    key,
    code: `Key${key.toUpperCase()}`,
    bubbles: true,
    cancelable: true,
    ...options,
  });
};

export const pressKey = (element: Element | Document, key: string, options = {}) => {
  fireEvent.keyDown(element, {
    key,
    code: `Key${key.toUpperCase()}`,
    ...options,
  });
};

export const pressKeyCombo = (element: Element | Document, keys: string[], options = {}) => {
  const mainKey = keys[keys.length - 1];
  const modifiers = keys.slice(0, -1);
  
  const eventOptions = {
    ctrlKey: modifiers.includes('ctrl'),
    shiftKey: modifiers.includes('shift'),
    altKey: modifiers.includes('alt'),
    metaKey: modifiers.includes('meta'),
    ...options,
  };
  
  pressKey(element, mainKey, eventOptions);
};

export const mockKeyboardShortcuts = () => {
  const shortcuts = new Map<string, vi.Mock>();
  
  const registerShortcut = (key: string, handler: vi.Mock) => {
    shortcuts.set(key, handler);
  };
  
  const triggerShortcut = (key: string) => {
    const handler = shortcuts.get(key);
    if (handler) {
      handler();
    }
  };
  
  return { registerShortcut, triggerShortcut, shortcuts };
};

export const keyboardTestSequence = async (
  element: Element | Document,
  sequence: Array<{ key: string; delay?: number; options?: any }>
) => {
  for (const { key, delay = 0, options = {} } of sequence) {
    pressKey(element, key, options);
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};