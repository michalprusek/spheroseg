/**
 * Component Test Utilities
 */

import React from 'react';
import { vi } from 'vitest';

export const createMockRef = <T,>(current: T | null = null) => {
  const ref = { current };
  return ref as React.RefObject<T>;
};

export const mockResizeObserver = () => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
};

export const mockIntersectionObserver = () => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
};

export const createMockCanvas = () => {
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    globalAlpha: 1,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(), width: 0, height: 0 })),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(), width: 0, height: 0 })),
    putImageData: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
  };

  const canvas = {
    width: 800,
    height: 600,
    getContext: vi.fn(() => context),
    toDataURL: vi.fn(() => 'data:image/png;base64,test'),
    toBlob: vi.fn((callback) => callback(new Blob(['test'], { type: 'image/png' }))),
  };

  return { canvas, context };
};

export const waitForAsync = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

export const fireEventWithDelay = async (element: Element, event: Event, delay = 0) => {
  element.dispatchEvent(event);
  await waitForAsync(delay);
};