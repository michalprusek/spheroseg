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

// Mock hooks
export const mockUseNavigate = () => mockNavigate;
export const mockUseLocation = () => mockLocation;
export const mockUseParams = () => ({});
export const mockUseSearchParams = () => {
  const searchParams = new URLSearchParams();
  const setSearchParams = vi.fn();
  return [searchParams, setSearchParams] as const;
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