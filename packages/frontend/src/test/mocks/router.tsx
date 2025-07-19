import React from 'react';
import { vi } from 'vitest';

// Mock router functions
export const mockNavigate = vi.fn();
export const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: undefined,
  key: 'default',
};
export const mockParams: Record<string, string> = {};
export const mockSearchParams = new URLSearchParams();
export const mockSetSearchParams = vi.fn();

// Helper functions to update mocks
export const updateMockLocation = (updates: Partial<typeof mockLocation>) => {
  Object.assign(mockLocation, updates);
};

export const updateMockParams = (params: Record<string, string>) => {
  Object.keys(mockParams).forEach(key => delete mockParams[key]);
  Object.assign(mockParams, params);
};

export const updateMockSearchParams = (params: Record<string, string>) => {
  mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
  Object.entries(params).forEach(([key, value]) => mockSearchParams.set(key, value));
};

// Mock hooks
export const mockUseNavigate = () => mockNavigate;
export const mockUseLocation = () => mockLocation;
export const mockUseParams = () => mockParams;
export const mockUseSearchParams = () => {
  return [mockSearchParams, mockSetSearchParams] as const;
};

// Reset function for tests
export const resetRouterMocks = () => {
  mockNavigate.mockClear();
  updateMockLocation({
    pathname: '/',
    search: '',
    hash: '',
    state: undefined,
    key: 'default',
  });
  updateMockParams({});
  updateMockSearchParams({});
  mockSetSearchParams.mockClear();
};

// Mock Link component
export const MockLink = ({ children, to, ...props }: any) => (
  <a href={typeof to === 'string' ? to : to.pathname} {...props}>
    {children}
  </a>
);

// Mock NavLink component
export const MockNavLink = MockLink;

// Mock Navigate component
export const MockNavigate = ({ to }: { to: string }) => {
  mockNavigate(to);
  return null;
};

// Mock Outlet
export const MockOutlet = () => null;

// Create navigation context
const NavigationContext = React.createContext({
  navigate: mockNavigate,
});

const RouterProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <NavigationContext.Provider value={{ navigate: mockNavigate }}>
      {children}
    </NavigationContext.Provider>
  );
};

// Setup module mocks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
    useLocation: mockUseLocation,
    useParams: mockUseParams,
    useSearchParams: mockUseSearchParams,
    Navigate: MockNavigate,
    Link: MockLink,
    NavLink: MockNavLink,
    Outlet: MockOutlet,
    BrowserRouter: RouterProvider,
    MemoryRouter: RouterProvider,
    Routes: ({ children }: { children: React.ReactNode }) => children,
    Route: ({ element }: { element: React.ReactNode }) => element,
  };
});