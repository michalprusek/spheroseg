import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { ThemeProvider, useTheme } from '../ThemeContext';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null, // Start with no user to simplify tests
  })),
}));

// Mock userProfileService
const mockUserProfileService = {
  loadSettingFromDatabase: vi.fn().mockResolvedValue(null),
  setUserSetting: vi.fn().mockResolvedValue({ success: true }),
};

vi.mock('@/services/userProfileService', () => ({
  default: mockUserProfileService,
}));

// Create a test component to test the useTheme hook
const TestThemeComponent: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div data-testid="theme-provider">
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

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
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
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));

    window.matchMedia = matchMediaMock;

    // Mock document.documentElement classList and setAttribute
    const originalClassList = document.documentElement.classList;
    const originalSetAttribute = document.documentElement.setAttribute;
    
    // Create a Set to track classes
    const classes = new Set<string>();
    
    document.documentElement.classList = {
      add: vi.fn((...classNames: string[]) => {
        classNames.forEach(c => classes.add(c));
      }),
      remove: vi.fn((...classNames: string[]) => {
        classNames.forEach(c => classes.delete(c));
      }),
      contains: vi.fn((className: string) => classes.has(className)),
      toggle: vi.fn(),
      length: 0,
      value: '',
      item: vi.fn(),
      forEach: vi.fn(),
      entries: vi.fn(),
      keys: vi.fn(),
      values: vi.fn(),
      replace: vi.fn(),
      supports: vi.fn(),
      toString: vi.fn(),
      [Symbol.iterator]: vi.fn(),
    } as any;
    
    document.documentElement.setAttribute = vi.fn();
    
    // Mock document.body classList
    const bodyClasses = new Set<string>();
    
    document.body.classList = {
      add: vi.fn((...classNames: string[]) => {
        classNames.forEach(c => bodyClasses.add(c));
      }),
      remove: vi.fn((...classNames: string[]) => {
        classNames.forEach(c => bodyClasses.delete(c));
      }),
      contains: vi.fn((className: string) => bodyClasses.has(className)),
      toggle: vi.fn(),
      length: 0,
      value: '',
      item: vi.fn(),
      forEach: vi.fn(),
      entries: vi.fn(),
      keys: vi.fn(),
      values: vi.fn(),
      replace: vi.fn(),
      supports: vi.fn(),
      toString: vi.fn(),
      [Symbol.iterator]: vi.fn(),
    } as any;
    
    // Clean up in afterEach
    afterEach(() => {
      document.documentElement.classList = originalClassList;
      document.documentElement.setAttribute = originalSetAttribute;
    });
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

    // Wait for the theme to be initialized
    await waitFor(() => {
      expect(screen.queryByTestId('current-theme')).toBeInTheDocument();
    });

    // Check the theme value - should be 'system' when no localStorage
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('system');
    });

    // Should apply theme based on system preference (dark)
    await waitFor(() => {
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
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
      expect(screen.queryByTestId('current-theme')).toBeInTheDocument();
    });
    
    // Should show light theme
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('light');
    });

    // Should apply light theme classes
    await waitFor(() => {
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('light');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });
  });

  it('should set theme when setTheme is called', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.queryByTestId('current-theme')).toBeInTheDocument();
    });

    // Click button to set dark theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-dark'));
    });

    // Should update theme state
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    });

    // Should store in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');

    // Should apply dark theme
    expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('should apply system-preferred theme when system theme is selected', async () => {
    // Start with light theme
    localStorageMock['theme'] = 'light';
    
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.queryByTestId('current-theme')).toBeInTheDocument();
    });

    // Clear mocks
    vi.mocked(document.documentElement.classList.add).mockClear();
    vi.mocked(document.documentElement.setAttribute).mockClear();
    vi.mocked(localStorage.setItem).mockClear();

    // Click button to set system theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-system'));
    });

    // Should update theme state
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('system');
    });

    // Should store in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'system');

    // Should apply system preference (dark)
    expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('should update theme when system preference changes', async () => {
    let changeListener: any = null;
    
    // Set up matchMedia to capture the event listener
    matchMediaMock.mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'change') changeListener = handler;
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.queryByTestId('current-theme')).toBeInTheDocument();
    });

    // Set system theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-system'));
    });

    // Wait for system theme
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('system');
    });

    // Clear mocks
    vi.mocked(document.documentElement.classList.add).mockClear();
    vi.mocked(document.documentElement.classList.remove).mockClear();
    vi.mocked(document.documentElement.setAttribute).mockClear();

    // Update matchMedia to return light theme
    matchMediaMock.mockImplementation((query) => ({
      matches: false, // light theme
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));

    // Trigger the change event
    act(() => {
      if (changeListener) {
        changeListener({ matches: false });
      }
    });

    // Should apply light theme
    await waitFor(() => {
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith('light', 'dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('light');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });
  });

  it('should apply consistent styling to body and html elements', async () => {
    // Set initial theme to dark
    localStorageMock['theme'] = 'dark';

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.queryByTestId('current-theme')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    });

    // Should apply dark styles
    await waitFor(() => {
      expect(document.documentElement.style.backgroundColor).toBe('#111827');
      expect(document.body.style.backgroundColor).toBe('#111827');
      expect(document.body.classList.add).toHaveBeenCalledWith('dark');
      expect(document.body.classList.remove).toHaveBeenCalledWith('light');
    });

    // Clear mocks
    vi.mocked(document.body.classList.add).mockClear();
    vi.mocked(document.body.classList.remove).mockClear();

    // Change to light theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-light'));
    });

    // Wait for theme update
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('light');
    });
    
    // Should apply light styles
    await waitFor(() => {
      expect(document.documentElement.style.backgroundColor).toBe('#f9fafb');
      expect(document.body.style.backgroundColor).toBe('#f9fafb');
      expect(document.body.classList.add).toHaveBeenCalledWith('light');
      expect(document.body.classList.remove).toHaveBeenCalledWith('dark');
    });
  });
});