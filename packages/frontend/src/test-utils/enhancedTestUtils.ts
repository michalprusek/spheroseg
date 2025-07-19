/**
 * Enhanced Test Utilities
 * 
 * Improved utilities for frontend testing with better type safety and i18n support
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Enhanced translation mock that provides actual translations for common keys
 */
export const createMockTranslation = (additionalTranslations: Record<string, string> = {}) => {
  const defaultTranslations = {
    // Export related
    'export.metricsRequireSegmentation': 'Metrics require segmentation to be completed',
    'export.selectImagesForExport': 'Select images for export',
    'export.formats.COCO': 'COCO JSON',
    'export.formats.YOLO': 'YOLO TXT',
    'export.formats.MASK': 'Mask (TIFF)',
    'export.formats.POLYGONS': 'Polygons (JSON)',
    'export.metricsFormats.EXCEL': 'Excel (.xlsx)',
    'export.metricsFormats.CSV': 'CSV (.csv)',
    
    // Common UI
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    
    // Navigation
    'nav.home': 'Home',
    'nav.projects': 'Projects',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    
    // Auth
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.register': 'Register',
    'auth.email': 'Email',
    'auth.password': 'Password',
    
    // Project
    'project.name': 'Project Name',
    'project.description': 'Description',
    'project.images': 'Images',
    'project.create': 'Create Project',
    'project.delete': 'Delete Project',
    
    ...additionalTranslations,
  };

  return (key: string, params?: any) => {
    const translation = defaultTranslations[key] || key;
    
    if (params && typeof translation === 'string') {
      // Simple parameter replacement
      return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return params[param] || match;
      });
    }
    
    return translation;
  };
};

/**
 * Create a mock user object for testing
 */
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a mock project object for testing
 */
export const createMockProject = (overrides: Partial<any> = {}) => ({
  id: '456',
  name: 'Test Project',
  description: 'Test project description',
  user_id: '123',
  image_count: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a mock image object for testing
 */
export const createMockImage = (overrides: Partial<any> = {}) => ({
  id: '789',
  project_id: '456',
  filename: 'test-image.jpg',
  original_filename: 'test-image.jpg',
  file_path: '/uploads/test-image.jpg',
  file_size: 1024,
  mime_type: 'image/jpeg',
  segmentation_status: 'without_segmentation',
  width: 800,
  height: 600,
  thumbnail_path: '/uploads/thumbnails/test-image.jpg',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Enhanced render function with better defaults
 */
export interface EnhancedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withAuth?: boolean;
  withTheme?: boolean;
  withLanguage?: boolean;
  user?: any;
  translations?: Record<string, string>;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options: EnhancedRenderOptions = {}
) => {
  const {
    withAuth = false,
    withTheme = false,
    withLanguage = false,
    user = createMockUser(),
    translations = {},
    ...renderOptions
  } = options;

  // Create wrapper components based on options
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    let wrappedChildren = children;

    if (withLanguage) {
      const mockT = createMockTranslation(translations);
      wrappedChildren = React.createElement(
        'div',
        { 'data-testid': 'language-provider', 'data-language': 'en' },
        wrappedChildren
      );
    }

    if (withTheme) {
      wrappedChildren = React.createElement(
        'div',
        { 'data-testid': 'theme-provider', 'data-theme': 'light' },
        wrappedChildren
      );
    }

    if (withAuth) {
      wrappedChildren = React.createElement(
        'div',
        { 'data-testid': 'auth-provider', 'data-user': JSON.stringify(user) },
        wrappedChildren
      );
    }

    return React.createElement(React.Fragment, {}, wrappedChildren);
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

/**
 * Mock API response builder
 */
export const createMockApiResponse = <T>(data: T, status = 200) => ({
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: {},
  config: {},
});

/**
 * Mock API error builder
 */
export const createMockApiError = (message: string, status = 500) => {
  const error = new Error(message) as any;
  error.response = {
    data: { error: message },
    status,
    statusText: 'Error',
  };
  error.isAxiosError = true;
  return error;
};

/**
 * Wait for element with timeout
 */
export const waitForElement = async (
  queryFn: () => HTMLElement | null,
  timeout = 1000
): Promise<HTMLElement> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = queryFn();
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  throw new Error(`Element not found within ${timeout}ms`);
};

/**
 * Mock localStorage for tests
 */
export const createMockStorage = () => {
  let storage: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      storage = {};
    }),
    length: 0,
    key: vi.fn(),
  };
};

/**
 * Mock file for file upload tests
 */
export const createMockFile = (
  name = 'test-image.jpg',
  type = 'image/jpeg',
  size = 1024
) => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/**
 * Test data factory
 */
export const TestFactory = {
  user: createMockUser,
  project: createMockProject,
  image: createMockImage,
  apiResponse: createMockApiResponse,
  apiError: createMockApiError,
  file: createMockFile,
  storage: createMockStorage,
  translation: createMockTranslation,
};

/**
 * Common test assertions
 */
export const TestAssertions = {
  elementExists: (element: HTMLElement | null, name?: string) => {
    if (!element) {
      throw new Error(`Expected element${name ? ` "${name}"` : ''} to exist`);
    }
  },
  
  elementNotExists: (element: HTMLElement | null, name?: string) => {
    if (element) {
      throw new Error(`Expected element${name ? ` "${name}"` : ''} to not exist`);
    }
  },
  
  hasText: (element: HTMLElement, expectedText: string) => {
    if (!element.textContent?.includes(expectedText)) {
      throw new Error(
        `Expected element to contain text "${expectedText}", but got "${element.textContent}"`
      );
    }
  },
  
  hasClass: (element: HTMLElement, className: string) => {
    if (!element.classList.contains(className)) {
      throw new Error(
        `Expected element to have class "${className}", but classes are: ${Array.from(element.classList).join(', ')}`
      );
    }
  },
};