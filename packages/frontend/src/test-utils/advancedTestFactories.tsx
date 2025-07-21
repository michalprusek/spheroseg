/**
 * Advanced test factories for consistent test data generation
 */

import { vi } from 'vitest';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import React from 'react';
import type { User, Project, Image, Cell, ApiResponse, ApiError } from './types';

// Enhanced test data factory
export class AdvancedTestDataFactory {
  private static sequences = new Map<string, number>();

  static sequence(name: string): number {
    const current = this.sequences.get(name) || 0;
    const next = current + 1;
    this.sequences.set(name, next);
    return next;
  }

  static resetSequence(name?: string): void {
    if (name) {
      this.sequences.delete(name);
    } else {
      this.sequences.clear();
    }
  }

  static createUser(overrides: Partial<User> = {}): User {
    const seq = this.sequence('user');
    return {
      id: `user-${seq}`,
      username: `testuser${seq}`,
      email: `user${seq}@test.com`,
      full_name: `Test User ${seq}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  static createProject(overrides: Partial<Project> = {}): Project {
    const seq = this.sequence('project');
    return {
      id: `project-${seq}`,
      name: `Test Project ${seq}`,
      description: `Test project description ${seq}`,
      user_id: `user-1`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  static createImage(overrides: Partial<Image> = {}): Image {
    const seq = this.sequence('image');
    return {
      id: `image-${seq}`,
      filename: `test-image-${seq}.jpg`,
      original_filename: `test-image-${seq}.jpg`,
      file_path: `/uploads/test-image-${seq}.jpg`,
      thumbnail_path: `/uploads/thumbs/test-image-${seq}.jpg`,
      segmentation_status: 'without_segmentation',
      project_id: `project-1`,
      uploaded_at: new Date().toISOString(),
      ...overrides,
    };
  }

  static createCell(overrides: Partial<Cell> = {}): Cell {
    const seq = this.sequence('cell');
    return {
      id: `cell-${seq}`,
      image_id: `image-1`,
      polygon_data: `[[100,100],[200,100],[200,200],[100,200]]`,
      area: 10000,
      perimeter: 400,
      circularity: 0.8,
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  static createApiResponse<T>(data: T, status = 200): ApiResponse<T> {
    return {
      data,
      status,
      message: status >= 200 && status < 300 ? 'Success' : 'Error',
      timestamp: new Date().toISOString(),
    };
  }

  static createApiError(message = 'Test error', status = 500): ApiError {
    return {
      message,
      status,
      code: `ERROR_${status}`,
      timestamp: new Date().toISOString(),
    };
  }

  static createFormData(fields: Record<string, string | File>): FormData {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    return formData;
  }

  static createMockFile(
    name = 'test-file.jpg',
    type = 'image/jpeg',
    size = 1024
  ): File {
    const content = 'a'.repeat(size);
    return new File([content], name, { type });
  }
}

// Enhanced render utilities with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps;
  withAuth?: boolean;
  authUser?: User | null;
  withTheme?: boolean;
  theme?: 'light' | 'dark';
  withLanguage?: boolean;
  language?: string;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult => {
  const {
    routerProps = {},
    withAuth = false,
    authUser = null,
    withTheme = false,
    theme = 'light',
    withLanguage = false,
    language = 'en',
    ...renderOptions
  } = options;

  // Create wrapper with providers
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    let content = children;

    // Wrap with Router if needed
    if (routerProps || Object.keys(routerProps).length > 0) {
      content = (
        <MemoryRouter {...routerProps}>
          {content}
        </MemoryRouter>
      );
    }

    // Mock Auth Provider if needed
    if (withAuth) {
      content = (
        <div data-testid="mock-auth-provider" data-user={JSON.stringify(authUser)}>
          {content}
        </div>
      );
    }

    // Mock Theme Provider if needed
    if (withTheme) {
      content = (
        <div data-testid="mock-theme-provider" data-theme={theme}>
          {content}
        </div>
      );
    }

    // Mock Language Provider if needed
    if (withLanguage) {
      content = (
        <div data-testid="mock-language-provider" data-language={language}>
          {content}
        </div>
      );
    }

    return <>{content}</>;
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Advanced mock builders
export class AdvancedMockBuilder {
  static createApiClientMock() {
    return {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      put: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: {} }),
    };
  }

  static createAuthServiceMock(user: User | null = null) {
    return {
      login: vi.fn().mockResolvedValue(user ? { user, token: 'mock-token' } : null),
      logout: vi.fn().mockResolvedValue(undefined),
      register: vi.fn().mockResolvedValue({ user: user || AdvancedTestDataFactory.createUser() }),
      refreshToken: vi.fn().mockResolvedValue('new-mock-token'),
      getCurrentUser: vi.fn().mockResolvedValue(user),
      isAuthenticated: vi.fn().mockReturnValue(!!user),
    };
  }

  static createWebSocketMock() {
    const listeners = new Map<string, Function[]>();
    
    return {
      on: vi.fn((event: string, callback: Function) => {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)!.push(callback);
      }),
      off: vi.fn((event: string, callback: Function) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          const index = eventListeners.indexOf(callback);
          if (index > -1) {
            eventListeners.splice(index, 1);
          }
        }
      }),
      emit: vi.fn((event: string, data: any) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach(callback => callback(data));
        }
      }),
      connect: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
      // Utility for testing
      _triggerEvent: (event: string, data: any) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach(callback => callback(data));
        }
      }
    };
  }

  static createIntersectionObserverMock() {
    const mockIntersectionObserver = vi.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    });
    return mockIntersectionObserver;
  }

  static createResizeObserverMock() {
    const mockResizeObserver = vi.fn();
    mockResizeObserver.mockReturnValue({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    });
    return mockResizeObserver;
  }
}

// Test scenario builders
export class TestScenarioBuilder {
  private scenarios: TestScenario[] = [];

  scenario(name: string): TestScenarioBuilder {
    this.scenarios.push({
      name,
      setup: [],
      actions: [],
      assertions: [],
    });
    return this;
  }

  setup(setupFn: () => void | Promise<void>): TestScenarioBuilder {
    const currentScenario = this.scenarios[this.scenarios.length - 1];
    if (currentScenario) {
      currentScenario.setup.push(setupFn);
    }
    return this;
  }

  action(actionFn: () => void | Promise<void>): TestScenarioBuilder {
    const currentScenario = this.scenarios[this.scenarios.length - 1];
    if (currentScenario) {
      currentScenario.actions.push(actionFn);
    }
    return this;
  }

  assert(assertionFn: () => void | Promise<void>): TestScenarioBuilder {
    const currentScenario = this.scenarios[this.scenarios.length - 1];
    if (currentScenario) {
      currentScenario.assertions.push(assertionFn);
    }
    return this;
  }

  async execute(): Promise<void> {
    for (const scenario of this.scenarios) {
      // Setup
      for (const setupFn of scenario.setup) {
        await setupFn();
      }

      // Actions
      for (const actionFn of scenario.actions) {
        await actionFn();
      }

      // Assertions
      for (const assertionFn of scenario.assertions) {
        await assertionFn();
      }
    }
  }

  build(): TestScenario[] {
    return this.scenarios;
  }
}

// Test timing utilities
export class TestTimingUtils {
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static async waitForElement(
    selector: string,
    timeout = 5000
  ): Promise<HTMLElement> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        return element;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Element with selector "${selector}" not found within ${timeout}ms`);
  }

  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }
}

// Advanced assertion helpers
export class AdvancedAssertions {
  static expectElementToBeVisible(element: HTMLElement): void {
    expect(element).toBeInTheDocument();
    expect(element).toBeVisible();
  }

  static expectElementToHaveCorrectAccessibility(element: HTMLElement): void {
    // Check for ARIA labels
    const hasAriaLabel = element.getAttribute('aria-label') || 
                        element.getAttribute('aria-labelledby');
    
    if (element.tagName.toLowerCase() === 'button' || 
        element.tagName.toLowerCase() === 'input') {
      expect(hasAriaLabel).toBeTruthy();
    }

    // Check for proper role
    const interactiveElements = ['button', 'input', 'select', 'textarea', 'a'];
    if (interactiveElements.includes(element.tagName.toLowerCase())) {
      const tabIndex = element.getAttribute('tabindex');
      expect(tabIndex === null || parseInt(tabIndex) >= 0).toBeTruthy();
    }
  }

  static expectApiCallToMatchPattern(
    mockFn: any,
    expectedPattern: {
      method?: string;
      url?: string | RegExp;
      data?: any;
      headers?: Record<string, string>;
    }
  ): void {
    expect(mockFn).toHaveBeenCalled();
    
    const lastCall = mockFn.mock.calls[mockFn.mock.calls.length - 1];
    
    if (expectedPattern.url) {
      if (typeof expectedPattern.url === 'string') {
        expect(lastCall[0]).toBe(expectedPattern.url);
      } else {
        expect(lastCall[0]).toMatch(expectedPattern.url);
      }
    }

    if (expectedPattern.data) {
      expect(lastCall[1]).toMatchObject(expectedPattern.data);
    }
  }

  static expectPerformanceWithinThreshold(
    operation: () => Promise<void> | void,
    maxTimeMs: number
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const start = performance.now();
      
      try {
        await operation();
        const duration = performance.now() - start;
        
        if (duration > maxTimeMs) {
          reject(new Error(`Operation took ${duration.toFixed(2)}ms, exceeding threshold of ${maxTimeMs}ms`));
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Types
interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface Image {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  thumbnail_path: string;
  segmentation_status: string;
  project_id: string;
  uploaded_at: string;
}

interface Cell {
  id: string;
  image_id: string;
  polygon_data: string;
  area: number;
  perimeter: number;
  circularity: number;
  created_at: string;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: string;
}

interface ApiError {
  message: string;
  status: number;
  code: string;
  timestamp: string;
}

interface TestScenario {
  name: string;
  setup: Array<() => void | Promise<void>>;
  actions: Array<() => void | Promise<void>>;
  assertions: Array<() => void | Promise<void>>;
}

export default {
  AdvancedTestDataFactory,
  renderWithProviders,
  AdvancedMockBuilder,
  TestScenarioBuilder,
  TestTimingUtils,
  AdvancedAssertions,
};