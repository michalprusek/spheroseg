// Mock for react-router-dom that sets future flags
import React from 'react';
import * as ReactRouterDom from 'react-router-dom';

// Set React Router future flags
window.REACT_ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
  v7_normalizeFormMethod: true,
};

console.log('React Router DOM mock loaded with future flags set');

// Re-export everything from the actual module
export * from 'react-router-dom';

// Override specific components to ensure flags are set
export const BrowserRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ReactRouterDom.BrowserRouter>{children}</ReactRouterDom.BrowserRouter>;
};

export const MemoryRouter: React.FC<ReactRouterDom.MemoryRouterProps> = (props) => {
  return <ReactRouterDom.MemoryRouter {...props} />;
};

export const RouterProvider: React.FC<ReactRouterDom.RouterProviderProps> = (props) => {
  return <ReactRouterDom.RouterProvider {...props} />;
};
