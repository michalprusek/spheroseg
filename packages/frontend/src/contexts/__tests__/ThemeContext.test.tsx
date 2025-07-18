import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { ThemeProvider, useTheme } from '../ThemeContext';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id' },
  })),
}));

// Mock userProfileService
vi.mock('@/services/userProfileService', () => ({
  default: {
    loadSettingFromDatabase: vi.fn().mockResolvedValue(null),
    setUserSetting: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Create a test component to test the useTheme hook
const TestThemeComponent: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button data-testid="set-light" onClick={() => setTheme('light')}>
        Set Light
      </button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
      <button data-testid="set-system" onClick={() => setTheme('system')}>
        Set System
      </button>
    </div>
  );
};

describe('ThemeContext', () => {
  // Mock localStorage
  let localStorageMock: { [key: string]: string } = {};

  // Mock sessionStorage
  let sessionStorageMock: { [key: string]: string } = {};

  // Mock matchMedia
  let matchMediaMock: any;

  // Mock document manipulation
  let addClassListMock: any;
  let removeClassListMock: any;
  let setAttributeMock: any;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => localStorageMock[key] || null),
        setItem: vi.fn((key, value) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key) => delete localStorageMock[key]),
        clear: vi.fn(() => (localStorageMock = {})),
      },
      writable: true,
    });

    // Mock sessionStorage
    sessionStorageMock = {};

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key) => sessionStorageMock[key] || null),
        setItem: vi.fn((key, value) => {
          sessionStorageMock[key] = value;
        }),
        removeItem: vi.fn((key) => delete sessionStorageMock[key]),
        clear: vi.fn(() => (sessionStorageMock = {})),
      },
      writable: true,
    });

    // Mock matchMedia
    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    window.matchMedia = matchMediaMock;

    // Mock document classList
    const classListMock = {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn((className) => className === 'dark'),
    };

    // Mock document.documentElement
    addClassListMock = vi.spyOn(document.documentElement.classList, 'add');
    removeClassListMock = vi.spyOn(document.documentElement.classList, 'remove');
    setAttributeMock = vi.spyOn(document.documentElement, 'setAttribute');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with system theme when no localStorage value exists', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for the theme to be initialized - component might be null initially
    await waitFor(() => {
      expect(screen.queryByTestId('current-theme')).toBeInTheDocument();
    });

    // Check the theme value
    expect(screen.getByTestId('current-theme').textContent).toBe('system');

    // Should apply document class based on system preference (mocked to be dark)
    expect(removeClassListMock).toHaveBeenCalledWith('light', 'dark');
    expect(addClassListMock).toHaveBeenCalledWith('dark');
    expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('should initialize with theme from localStorage if available', async () => {
    // Set initial theme in localStorage
    localStorageMock['theme'] = 'light';

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for the theme to be initialized
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('light');
    });

    // Should apply light theme
    expect(removeClassListMock).toHaveBeenCalledWith('light', 'dark');
    expect(addClassListMock).toHaveBeenCalledWith('light');
    expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'light');
  });

  it('should set theme when setTheme is called', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for the theme to be initialized
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toBeInTheDocument();
    });

    // Click button to set dark theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-dark'));
    });

    // Should update theme state
    expect(screen.getByTestId('current-theme').textContent).toBe('dark');

    // Should store theme in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');

    // Should apply dark theme
    expect(removeClassListMock).toHaveBeenCalledWith('light', 'dark');
    expect(addClassListMock).toHaveBeenCalledWith('dark');
    expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('should apply system-preferred theme when system theme is selected', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for the theme to be initialized
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toBeInTheDocument();
    });

    // Reset mocks to track new calls
    addClassListMock.mockClear();
    removeClassListMock.mockClear();
    setAttributeMock.mockClear();

    // Click button to set system theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-system'));
    });

    // Should update theme state
    expect(screen.getByTestId('current-theme').textContent).toBe('system');

    // Should store theme in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'system');

    // Should apply theme based on system preference (mocked to be dark)
    expect(removeClassListMock).toHaveBeenCalledWith('light', 'dark');
    expect(addClassListMock).toHaveBeenCalledWith('dark');
    expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('should update theme when system preference changes', async () => {
    // Set up matchMedia to initially return light theme
    matchMediaMock.mockImplementation(() => ({
      matches: false, // light theme
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Set system theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-system'));
    });

    // Reset mocks to track new calls
    addClassListMock.mockClear();
    removeClassListMock.mockClear();
    setAttributeMock.mockClear();

    // Simulate system preference change
    const mediaQueryChangeHandler = matchMediaMock.mock.results[0].value.addEventListener.mock.calls[0][1];

    // Simulate dark mode change
    act(() => {
      // Update matchMedia mock to return dark theme
      matchMediaMock.mockImplementation(() => ({
        matches: true, // dark theme
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      // Trigger the change event
      if (mediaQueryChangeHandler) mediaQueryChangeHandler();
    });

    // Should apply dark theme
    expect(removeClassListMock).toHaveBeenCalledWith('light', 'dark');
    expect(addClassListMock).toHaveBeenCalledWith('dark');
    expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('should apply consistent styling to body and html elements', async () => {
    // Mock document.body style and classList
    const originalBodyStyle = document.body.style;
    const originalBodyClassList = document.body.classList;

    const bodyStyleMock = {
      backgroundColor: '',
    };

    const bodyClassListMock = {
      add: vi.fn(),
      remove: vi.fn(),
    };

    Object.defineProperty(document.body, 'style', {
      value: bodyStyleMock,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(document.body, 'classList', {
      value: bodyClassListMock,
      writable: true,
      configurable: true,
    });

    // Set initial theme to dark
    localStorageMock['theme'] = 'dark';

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for the theme to be initialized
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    });

    // Should set background color for dark theme
    expect(document.documentElement.style.backgroundColor).toBe('#111827');
    expect(bodyStyleMock.backgroundColor).toBe('#111827');

    // Should add dark class to body
    expect(bodyClassListMock.add).toHaveBeenCalledWith('dark');
    expect(bodyClassListMock.remove).toHaveBeenCalledWith('light');

    // Clear mocks
    bodyClassListMock.add.mockClear();
    bodyClassListMock.remove.mockClear();

    // Change to light theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-light'));
    });

    // Wait for theme to update
    await waitFor(() => {
      expect(document.documentElement.style.backgroundColor).toBe('#f9fafb');
    });

    // Should set background color for light theme
    expect(bodyStyleMock.backgroundColor).toBe('#f9fafb');

    // Should add light class to body
    expect(bodyClassListMock.add).toHaveBeenCalledWith('light');
    expect(bodyClassListMock.remove).toHaveBeenCalledWith('dark');

    // Restore original properties
    Object.defineProperty(document.body, 'style', {
      value: originalBodyStyle,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(document.body, 'classList', {
      value: originalBodyClassList,
      writable: true,
      configurable: true,
    });
  });
});
