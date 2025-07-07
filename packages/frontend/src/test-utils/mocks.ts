import { vi, MockedFunction } from 'vitest';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { 
  generateUser, 
  generateProject, 
  generateImage, 
  generateSegmentation,
  generateApiResponse,
  generatePaginatedResponse 
} from './generators';

/**
 * Mock Utilities
 * Mocking helpers for tests
 */

// API base URL
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

// MSW handlers
export const handlers = [
  // Auth endpoints
  rest.post(`${API_URL}/auth/login`, (req, res, ctx) => {
    return res(
      ctx.json(generateApiResponse({
        user: generateUser(),
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
      }))
    );
  }),

  rest.post(`${API_URL}/auth/register`, (req, res, ctx) => {
    return res(
      ctx.json(generateApiResponse({
        user: generateUser(),
        token: 'mock-jwt-token',
      }))
    );
  }),

  rest.post(`${API_URL}/auth/logout`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse({ message: 'Logged out' })));
  }),

  rest.post(`${API_URL}/auth/refresh`, (req, res, ctx) => {
    return res(
      ctx.json(generateApiResponse({
        token: 'new-mock-jwt-token',
        refreshToken: 'new-mock-refresh-token',
      }))
    );
  }),

  // User endpoints
  rest.get(`${API_URL}/users/me`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateUser())));
  }),

  rest.patch(`${API_URL}/users/:id`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateUser())));
  }),

  // Project endpoints
  rest.get(`${API_URL}/projects`, (req, res, ctx) => {
    const projects = Array.from({ length: 10 }, () => generateProject());
    return res(ctx.json(generateApiResponse(generatePaginatedResponse(projects))));
  }),

  rest.get(`${API_URL}/projects/:id`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateProject())));
  }),

  rest.post(`${API_URL}/projects`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateProject())));
  }),

  rest.patch(`${API_URL}/projects/:id`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateProject())));
  }),

  rest.delete(`${API_URL}/projects/:id`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse({ message: 'Project deleted' })));
  }),

  // Image endpoints
  rest.get(`${API_URL}/projects/:projectId/images`, (req, res, ctx) => {
    const images = Array.from({ length: 10 }, () => generateImage());
    return res(ctx.json(generateApiResponse(generatePaginatedResponse(images))));
  }),

  rest.get(`${API_URL}/images/:id`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateImage())));
  }),

  rest.post(`${API_URL}/projects/:projectId/images`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateImage())));
  }),

  rest.delete(`${API_URL}/images/:id`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse({ message: 'Image deleted' })));
  }),

  // Segmentation endpoints
  rest.post(`${API_URL}/images/:imageId/segment`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateSegmentation())));
  }),

  rest.get(`${API_URL}/segmentations/:id`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateSegmentation())));
  }),

  rest.patch(`${API_URL}/segmentations/:id`, (req, res, ctx) => {
    return res(ctx.json(generateApiResponse(generateSegmentation())));
  }),
];

// MSW server
export const server = setupServer(...handlers);

// Mock service functions
export function mockApiCall<T>(implementation?: () => T): MockedFunction<any> {
  return vi.fn(implementation || (() => Promise.resolve()));
}

// Local storage mock
export class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value.toString();
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// Session storage mock
export class SessionStorageMock extends LocalStorageMock {}

// IndexedDB mock
export class IndexedDBMock {
  private databases: Map<string, any> = new Map();

  open(name: string, version?: number) {
    return {
      result: {
        objectStoreNames: [],
        createObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn(),
            getAll: vi.fn(),
          })),
        })),
      },
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
    };
  }

  deleteDatabase(name: string) {
    this.databases.delete(name);
    return { onsuccess: null, onerror: null };
  }
}

// Canvas mock
export class CanvasMock {
  getContext = vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
    })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
    })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  }));
  
  toDataURL = vi.fn(() => 'data:image/png;base64,mock');
  toBlob = vi.fn((callback) => {
    callback(new Blob(['mock'], { type: 'image/png' }));
  });
}

// File mock
export function createFileMock(
  name: string = 'test.png',
  size: number = 1024,
  type: string = 'image/png'
): File {
  const blob = new Blob(['mock file content'], { type });
  const file = new File([blob], name, { type, lastModified: Date.now() });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// Image mock
export function createImageMock(width: number = 1024, height: number = 768): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'width', { value: width, writable: true });
  Object.defineProperty(img, 'height', { value: height, writable: true });
  Object.defineProperty(img, 'naturalWidth', { value: width });
  Object.defineProperty(img, 'naturalHeight', { value: height });
  
  // Mock load event
  setTimeout(() => {
    if (img.onload) {
      img.onload(new Event('load'));
    }
  }, 0);
  
  return img;
}

// WebSocket mock
export class WebSocketMock {
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send = vi.fn((data: string | ArrayBuffer | Blob) => {
    // Simulate echo
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data }));
      }
    }, 10);
  });

  close = vi.fn(() => {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });
}

// Intersection Observer mock
export class IntersectionObserverMock {
  callback: IntersectionObserverCallback;
  elements: Set<Element> = new Set();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe = vi.fn((element: Element) => {
    this.elements.add(element);
    // Simulate immediate intersection
    this.callback(
      [
        {
          target: element,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: element.getBoundingClientRect(),
          intersectionRect: element.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        },
      ],
      this
    );
  });

  unobserve = vi.fn((element: Element) => {
    this.elements.delete(element);
  });

  disconnect = vi.fn(() => {
    this.elements.clear();
  });
}

// Resize Observer mock
export class ResizeObserverMock {
  callback: ResizeObserverCallback;
  elements: Set<Element> = new Set();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe = vi.fn((element: Element) => {
    this.elements.add(element);
    // Simulate immediate resize
    this.callback(
      [
        {
          target: element,
          contentRect: element.getBoundingClientRect(),
          borderBoxSize: [{ blockSize: 100, inlineSize: 100 }],
          contentBoxSize: [{ blockSize: 100, inlineSize: 100 }],
          devicePixelContentBoxSize: [{ blockSize: 100, inlineSize: 100 }],
        },
      ],
      this
    );
  });

  unobserve = vi.fn((element: Element) => {
    this.elements.delete(element);
  });

  disconnect = vi.fn(() => {
    this.elements.clear();
  });
}

// Mock fetch with custom responses
export function mockFetch(responses: Record<string, any>) {
  return vi.fn((url: string, options?: RequestInit) => {
    const method = options?.method || 'GET';
    const key = `${method} ${url}`;
    
    if (responses[key]) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[key]),
        text: () => Promise.resolve(JSON.stringify(responses[key])),
        blob: () => Promise.resolve(new Blob([JSON.stringify(responses[key])])),
      });
    }
    
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
      text: () => Promise.resolve('Not found'),
    });
  });
}

// Mock timers
export function mockTimers() {
  vi.useFakeTimers();
  
  return {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    runAll: () => vi.runAllTimers(),
    runPending: () => vi.runOnlyPendingTimers(),
    clear: () => vi.clearAllTimers(),
    restore: () => vi.useRealTimers(),
  };
}

// Mock date
export function mockDate(date: Date | string | number) {
  const mockedDate = new Date(date);
  vi.setSystemTime(mockedDate);
  
  return {
    restore: () => vi.useRealTimers(),
    advance: (ms: number) => vi.setSystemTime(mockedDate.getTime() + ms),
  };
}

// Mock console
export function mockConsole() {
  const originalConsole = { ...console };
  
  return {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    restore: () => {
      Object.assign(console, originalConsole);
    },
  };
}

// Mock window methods
export function mockWindow() {
  return {
    alert: vi.fn(),
    confirm: vi.fn(() => true),
    prompt: vi.fn(() => 'mock input'),
    open: vi.fn(() => ({ close: vi.fn() })),
    scrollTo: vi.fn(),
    matchMedia: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  };
}