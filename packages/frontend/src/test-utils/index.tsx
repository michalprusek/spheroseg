/**
 * Frontend-specific test utilities
 */
import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { createUserFixture } from '../../../shared/test-utils/fixtures';

// Export the polygon action test utilities
export * from './polygonActionTestUtils';
// Export the React Router test wrapper
export * from './react-router-wrapper';
// Export the test wrapper with all providers
export * from './test-wrapper';
// Export the API client mock utilities
export * from './apiClientMock';
// Export the context mock utilities
export * from './contextMocks';
// Export the test setup helper
export * from './test-setup-helper';

/**
 * Custom render function with all frontend providers
 */
export const renderWithProviders = (
  ui: ReactElement,
  {
    route = '/',
    initialEntries = [route],
    preloadedState = {},
    ...renderOptions
  }: RenderOptions & {
    route?: string;
    initialEntries?: string[];
    preloadedState?: any;
  } = {},
) => {
  // Use our new MemoryRouterWrapper
  return render(ui, {
    wrapper: ({ children }) => <MemoryRouterWrapper initialEntries={initialEntries}>{children}</MemoryRouterWrapper>,
    ...renderOptions,
  });
};

/**
 * Mock authenticated user for frontend tests
 */
export const mockAuthenticatedUser = (user = createUserFixture()) => {
  // Set up localStorage with auth token
  localStorage.setItem('authToken', 'mock-jwt-token');

  // Return the user for test assertions
  return user;
};

/**
 * Setup mock for API client in frontend tests
 */
export const setupApiClientMock = () => {
  const apiClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  };

  jest.mock('@/lib/apiClient', () => ({
    default: apiClient,
  }));

  return apiClient;
};
