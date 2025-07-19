import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { ThemeProvider, useTheme } from '../../ThemeContext';
import '@testing-library/jest-dom';

// Mock AuthContext with multiple user scenarios
vi.mock('@/contexts/AuthContext', () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
  let currentUser = mockUser;

  return {
    useAuth: vi.fn(() => ({
      user: currentUser,
      signOut: vi.fn(() => {
        currentUser = null;
        return Promise.resolve();
      }),
      signIn: vi.fn(() => {
        currentUser = mockUser;
        return Promise.resolve({ user: mockUser });
      }),
    })),
    // Export for tests to manipulate the mock
    __setMockUser: (user: any) => {
      currentUser = user;
    },
  };
});

// Create a test component to test the useTheme hook with more interactive features
const TestThemeComponent: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light Theme';
      case 'dark':
        return 'Dark Theme';
      case 'system':
        return 'System Theme';
      default:
        return 'Unknown Theme';
    }
  };

  return (
    <div>
      <h1>Theme Tester</h1>
      <div data-testid="theme-container" className={`theme-${theme}`}>
        <span data-testid="current-theme">{theme}</span>
        <span data-testid="theme-label">{getThemeLabel()}</span>
      </div>
      <div className="theme-controls">
        <button data-testid="set-light" onClick={() => setTheme('light')} className={theme === 'light' ? 'active' : ''}>
          Set Light
        </button>
        <button data-testid="set-dark" onClick={() => setTheme('dark')} className={theme === 'dark' ? 'active' : ''}>
          Set Dark
        </button>
        <button
          data-testid="set-system"
          onClick={() => setTheme('system')}
          className={theme === 'system' ? 'active' : ''}
        >
          Set System
        </button>
        <button
          data-testid="cycle-theme"
          onClick={() => {
            if (theme === 'light') setTheme('dark');
            else if (theme === 'dark') setTheme('system');
            else setTheme('light');
          }}
        >
          Cycle Theme
        </button>
      </div>
    </div>
  );
};

// Component to test error boundaries
const ThemeConsumer: React.FC = () => {
  try {
    useTheme();
    return <div data-testid="theme-consumer-success">Theme consumer working</div>;
  } catch (error) {
    return <div data-testid="theme-consumer-error">Error: {(error as Error).message}</div>;
  }
};

describe('ThemeContext (Enhanced)', () => {
  // Mock localStorage
  let localStorageMock: { [key: string]: string } = {};

  // Mock matchMedia
  let matchMediaMock: { [key: string]: any } = {};
  let mediaQueryListeners: Function[] = [];

  // Mock document manipulation
  let addClassListMock: any;
  let removeClassListMock: any;
  let setAttributeMock: any;
  let containsClassListMock: any;

  // Store original values
  const originalDocumentElementStyle = { ...document.documentElement.style };
  const originalBodyStyle = { ...document.body.style };

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

    // Mock matchMedia with event simulation capabilities
    mediaQueryListeners = [];
    matchMediaMock = {
      matches: false, // Default to light theme
      addEventListener: vi.fn((event, listener) => {
        if (event === 'change') {
          mediaQueryListeners.push(listener);
        }
      }),
      removeEventListener: vi.fn((event, listener) => {
        if (event === 'change') {
          const index = mediaQueryListeners.indexOf(listener);
          if (index !== -1) {
            mediaQueryListeners.splice(index, 1);
          }
        }
      }),
    };

    window.matchMedia = vi.fn().mockImplementation(() => matchMediaMock);

    // Mock document.documentElement.classList more completely
    const originalClassList = document.documentElement.classList;
    const classListMock = {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn().mockImplementation(() => false),
      toggle: vi.fn(),
    };

    // Spy on document.documentElement methods
    addClassListMock = vi.spyOn(document.documentElement.classList, 'add');
    removeClassListMock = vi.spyOn(document.documentElement.classList, 'remove');
    containsClassListMock = vi.spyOn(document.documentElement.classList, 'contains');
    setAttributeMock = vi.spyOn(document.documentElement, 'setAttribute');

    // Mock document.body.classList
    Object.defineProperty(document.body, 'classList', {
      value: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
        toggle: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    // Reset document styles
    document.documentElement.style.backgroundColor = '';
    document.body.style.backgroundColor = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
    mediaQueryListeners = [];

    // Restore document styles
    Object.keys(originalDocumentElementStyle).forEach((key) => {
      document.documentElement.style[key as unknown] =
        originalDocumentElementStyle[key as keyof typeof originalDocumentElementStyle];
    });

    Object.keys(originalBodyStyle).forEach((key) => {
      document.body.style[key as unknown] = originalBodyStyle[key as keyof typeof originalBodyStyle];
    });
  });

  const simulateSystemThemeChange = (prefersDark: boolean) => {
    matchMediaMock.matches = prefersDark;
    mediaQueryListeners.forEach((listener) => listener());
  };

  it('should initialize with system theme when no localStorage value exists', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for the theme to be initialized
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('system');
    });
    expect(screen.getByTestId('theme-label').textContent).toBe('System Theme');

    // Should attempt to read from localStorage
    expect(localStorage.getItem).toHaveBeenCalledWith('theme');

    // Should apply system preference theme
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('should initialize with theme from localStorage if available', async () => {
    // Set initial theme in localStorage
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
    expect(screen.getByTestId('theme-label').textContent).toBe('Dark Theme');

    // Verify localStorage was checked
    expect(localStorage.getItem).toHaveBeenCalledWith('theme');

    localStorageMock['theme'] = 'light';

    // Render with light theme from localStorage
    const { unmount } = render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    unmount();

    // Change to invalid theme to test fallback behavior
    localStorageMock['theme'] = 'invalid-theme';

    // Should fall back to system theme for invalid stored themes
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('system');
    });
  });

  it('should properly cycle through themes', async () => {
    // Start with light theme in localStorage
    localStorageMock['theme'] = 'light';

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('light');
    });

    // Cycle to dark theme
    act(() => {
      fireEvent.click(screen.getByTestId('cycle-theme'));
    });

    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');

    // Cycle to system theme
    act(() => {
      fireEvent.click(screen.getByTestId('cycle-theme'));
    });

    expect(screen.getByTestId('current-theme').textContent).toBe('system');
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'system');

    // Cycle back to light theme
    act(() => {
      fireEvent.click(screen.getByTestId('cycle-theme'));
    });

    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('should apply correct CSS classes for each theme', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toBeInTheDocument();
    });

    // Test light theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-light'));
    });

    expect(removeClassListMock).toHaveBeenCalledWith('light', 'dark');
    expect(addClassListMock).toHaveBeenCalledWith('light');
    expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'light');
    expect(document.body.classList.add).toHaveBeenCalledWith('light');
    expect(document.body.classList.remove).toHaveBeenCalledWith('dark');

    // Reset mocks
    vi.clearAllMocks();

    // Test dark theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-dark'));
    });

    expect(removeClassListMock).toHaveBeenCalledWith('light', 'dark');
    expect(addClassListMock).toHaveBeenCalledWith('dark');
    expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'dark');
    expect(document.body.classList.add).toHaveBeenCalledWith('dark');
    expect(document.body.classList.remove).toHaveBeenCalledWith('light');
  });

  it('should apply correct background colors for light and dark themes', async () => {
    // Start with light theme
    localStorageMock['theme'] = 'light';

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('light');
    });

    // Light theme should have light background
    expect(document.documentElement.style.backgroundColor).toBe('#f9fafb');
    expect(document.body.style.backgroundColor).toBe('#f9fafb');

    // Switch to dark theme
    act(() => {
      fireEvent.click(screen.getByTestId('set-dark'));
    });

    // Dark theme should have dark background
    expect(document.documentElement.style.backgroundColor).toBe('#111827');
    expect(document.body.style.backgroundColor).toBe('#111827');
  });

  it('should react to system theme changes when set to system', async () => {
    // Start with system theme
    localStorageMock['theme'] = 'system';

    // Initial system preference is light (matches = false)
    matchMediaMock.matches = false;

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('system');
    });

    // Should have light theme applied initially based on system preference
    expect(document.documentElement.style.backgroundColor).toBe('#f9fafb');

    // Reset mocks
    vi.clearAllMocks();

    // Simulate system theme changing to dark
    act(() => {
      simulateSystemThemeChange(true);
    });

    // Should now apply dark theme
    expect(removeClassListMock).toHaveBeenCalledWith('light', 'dark');
    expect(addClassListMock).toHaveBeenCalledWith('dark');
    expect(document.documentElement.style.backgroundColor).toBe('#111827');

    // Reset mocks
    vi.clearAllMocks();

    // Simulate system theme changing back to light
    act(() => {
      simulateSystemThemeChange(false);
    });

    // Should now apply light theme
    expect(removeClassListMock).toHaveBeenCalledWith('light', 'dark');
    expect(addClassListMock).toHaveBeenCalledWith('light');
    expect(document.documentElement.style.backgroundColor).toBe('#f9fafb');
  });

  it('should not react to system theme changes when set to explicit theme', async () => {
    // Start with dark theme
    localStorageMock['theme'] = 'dark';

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    });

    // Reset mocks
    vi.clearAllMocks();

    // Simulate system theme change
    act(() => {
      simulateSystemThemeChange(false); // Change to light preference
    });

    // Should not change theme since we're using explicit dark theme
    expect(removeClassListMock).not.toHaveBeenCalled();
    expect(addClassListMock).not.toHaveBeenCalled();
    expect(document.documentElement.style.backgroundColor).toBe('#111827');
  });

  it('should clean up event listeners when unmounted', async () => {
    // Start with system theme
    localStorageMock['theme'] = 'system';

    const { unmount } = render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initialization and event listener setup
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('system');
    });

    // Verify addEventListener was called
    expect(matchMediaMock.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    // Store number of listeners before unmount
    const listenersBeforeUnmount = mediaQueryListeners.length;

    // Unmount component
    unmount();

    // Verify removeEventListener was called
    expect(matchMediaMock.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    // Verify listeners were actually removed
    expect(mediaQueryListeners.length).toBeLessThan(listenersBeforeUnmount);
  });

  it('should handle browser without localStorage gracefully', async () => {
    // Mock situation where localStorage throws an error (like in incognito mode)
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
        setItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
      },
      writable: true,
    });

    // Should not throw errors when localStorage fails
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toBeInTheDocument();
    });

    // Should default to system theme
    expect(screen.getByTestId('current-theme').textContent).toBe('system');

    // Changing theme should not throw errors despite localStorage failure
    act(() => {
      fireEvent.click(screen.getByTestId('set-dark'));
    });

    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
  });

  it('should throw error when useTheme is used outside ThemeProvider', () => {
    render(<ThemeConsumer />);

    // Should show error message
    expect(screen.getByTestId('theme-consumer-error')).toBeInTheDocument();
    expect(screen.getByTestId('theme-consumer-error').textContent).toContain(
      'useTheme must be used within a ThemeProvider',
    );
  });

  it('should handle user authentication status changes gracefully', async () => {
    // Start with user logged in and theme preference set
    localStorageMock['theme'] = 'dark';

    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    });

    // Simulate user logging out (theme preference should persist)
    act(() => {
      require('@/contexts/AuthContext').__setMockUser(null);
    });

    // Changing theme should still work without user
    act(() => {
      fireEvent.click(screen.getByTestId('set-light'));
    });

    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('should pause theme operations during initial load', async () => {
    // Create a custom ThemeProvider with delayed initialization
    const DelayedThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      // Render nothing during "loading"
      return (
        <ThemeProvider>
          {null}
          {children}
        </ThemeProvider>
      );
    };

    const { rerender } = render(
      <DelayedThemeProvider>
        <TestThemeComponent />
      </DelayedThemeProvider>,
    );

    // Should not have rendered the test component yet (null from the provider)
    expect(screen.queryByTestId('current-theme')).not.toBeInTheDocument();

    // Now rerender with the actual provider that doesn't block children
    rerender(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    );

    // Should now render the component with theme
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toBeInTheDocument();
    });
  });
});
