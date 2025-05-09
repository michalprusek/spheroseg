import React from 'react';
import { BrowserRouter, RouterProvider, createMemoryRouter } from 'react-router-dom';

// Ensure React Router future flags are set
// Disable the warnings in React Router
process.env.REACT_ROUTER_SKIP_WARNINGS = 'true';
window.REACT_ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
  v7_normalizeFormMethod: true
};

/**
 * Test router wrapper that sets the future flags
 * Use this in tests instead of directly using BrowserRouter
 */
export const TestRouterWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Ensure flags are set before rendering
  if (!window.REACT_ROUTER_FUTURE_FLAGS) {
    window.REACT_ROUTER_FUTURE_FLAGS = {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_normalizeFormMethod: true
    };
  }

  return <BrowserRouter>{children}</BrowserRouter>;
};

/**
 * Create a memory router with future flags for testing
 */
export const createTestRouter = (routes: any[], initialEntries = ['/', '/about']) => {
  // Ensure flags are set before creating the router
  if (!window.REACT_ROUTER_FUTURE_FLAGS) {
    window.REACT_ROUTER_FUTURE_FLAGS = {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_normalizeFormMethod: true
    };
  }

  return createMemoryRouter(routes, { initialEntries });
};

/**
 * Test router provider that sets the future flags
 */
export const TestRouterProvider: React.FC<{ router: ReturnType<typeof createMemoryRouter> }> = ({ router }) => {
  // Ensure flags are set before rendering
  if (!window.REACT_ROUTER_FUTURE_FLAGS) {
    window.REACT_ROUTER_FUTURE_FLAGS = {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_normalizeFormMethod: true
    };
  }

  return <RouterProvider router={router} />;
};