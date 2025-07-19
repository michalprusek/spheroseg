/**
 * Common Test Fixes
 * 
 * This file contains fixes for common test issues in the frontend test suite.
 * Import this in your test files to fix common issues.
 */

import { vi } from 'vitest';

// Fix for missing global timers
export function setupGlobalTimers() {
  // Store references to avoid timing issues
  const timers = {
    clearInterval: global.clearInterval || clearInterval,
    setInterval: global.setInterval || setInterval,
    clearTimeout: global.clearTimeout || clearTimeout,
    setTimeout: global.setTimeout || setTimeout,
  };

  // Assign to global
  Object.assign(global, timers);
  
  // Also assign to window for browser environment
  if (typeof window !== 'undefined') {
    Object.assign(window, timers);
  }
}

// Enhanced mock for userProfileService with all methods
export const mockUserProfileService = {
  getUserSetting: vi.fn().mockResolvedValue('en'),
  saveUserSetting: vi.fn().mockResolvedValue(undefined),
  getLanguage: vi.fn().mockResolvedValue('en'),
  setLanguage: vi.fn().mockResolvedValue(undefined),
  getTheme: vi.fn().mockResolvedValue('light'),
  setTheme: vi.fn().mockResolvedValue(undefined),
  updateUserProfile: vi.fn().mockResolvedValue({
    id: '1',
    user_id: '1',
    username: 'testuser',
    full_name: 'Test User',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  deleteAvatar: vi.fn().mockResolvedValue({ message: 'Avatar deleted' }),
  getUserProfile: vi.fn().mockResolvedValue({
    id: '1',
    user_id: '1',
    username: 'testuser',
    full_name: 'Test User',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  uploadAvatar: vi.fn().mockResolvedValue({ avatar_url: 'https://example.com/avatar.jpg' }),
  getUserProfileWithSettings: vi.fn().mockResolvedValue({
    profile: {
      id: '1',
      user_id: '1',
      username: 'testuser',
      full_name: 'Test User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    settings: {},
  }),
  clearCache: vi.fn(),
  getAllSettings: vi.fn().mockResolvedValue({}),
  bulkSaveSettings: vi.fn().mockResolvedValue(undefined),
};

// Enhanced translation mock that can return actual translated values
export function createTranslationMock(translations: Record<string, string> = {}) {
  return vi.fn((key: string) => translations[key] || key);
}

// Common translations used in tests
export const commonTranslations: Record<string, string> = {
  'export.selectImagesForExport': 'Please select images for export',
  'export.metricsRequireSegmentation': 'Metrics require segmentation data',
  'export.options.includeMetadata': 'Include Project Metadata',
  'export.options.includeSegmentation': 'Include Segmentation',
  'export.options.includeObjectMetrics': 'Include Object Metrics',
  'export.options.includeImages': 'Include Original Images',
  'export.options.exportMetricsOnly': 'Export Metrics Only',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.submit': 'Submit',
};

// Setup function to be called in test files
export function setupCommonTestFixes() {
  setupGlobalTimers();
  
  // Return mocked services for use in tests
  return {
    mockUserProfileService,
    createTranslationMock,
    commonTranslations,
  };
}

// Helper to mock fetch responses
export function mockFetchResponse(data: any, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  });
}

// Helper to wait for async updates in tests
export function waitForAsync(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export everything for convenience
export default {
  setupGlobalTimers,
  mockUserProfileService,
  createTranslationMock,
  commonTranslations,
  setupCommonTestFixes,
  mockFetchResponse,
  waitForAsync,
};