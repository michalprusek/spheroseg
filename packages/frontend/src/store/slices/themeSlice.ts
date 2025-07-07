import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'blue' | 'green' | 'purple' | 'orange' | 'red';

export interface ThemeSlice {
  // State
  theme: Theme;
  colorScheme: ColorScheme;
  systemTheme: 'light' | 'dark';
  
  // Actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
  detectSystemTheme: () => void;
  applyTheme: () => void;
}

export const createThemeSlice: StateCreator<
  StoreState,
  [
    ['zustand/devtools', never],
    ['zustand/persist', unknown],
    ['zustand/subscribeWithSelector', never],
    ['zustand/immer', never]
  ],
  [],
  ThemeSlice
> = (set, get) => ({
  // Initial state
  theme: 'system',
  colorScheme: 'blue',
  systemTheme: 'light',
  
  // Actions
  setTheme: (theme) => {
    set((state) => {
      state.theme = theme;
    });
    
    // Apply theme to DOM
    get().applyTheme();
    
    // Save to user preferences if authenticated
    const { isAuthenticated, user } = get();
    if (isAuthenticated && user) {
      // API call to save preference
      fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${get().tokens?.accessToken}`,
        },
        body: JSON.stringify({ theme }),
      }).catch(console.error);
    }
  },
  
  toggleTheme: () => {
    const { theme, systemTheme } = get();
    const currentTheme = theme === 'system' ? systemTheme : theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    get().setTheme(newTheme);
  },
  
  setColorScheme: (scheme) => {
    set((state) => {
      state.colorScheme = scheme;
    });
    
    // Apply color scheme to DOM
    document.documentElement.setAttribute('data-color-scheme', scheme);
    
    // Save to user preferences if authenticated
    const { isAuthenticated, user } = get();
    if (isAuthenticated && user) {
      // API call to save preference
      fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${get().tokens?.accessToken}`,
        },
        body: JSON.stringify({ colorScheme: scheme }),
      }).catch(console.error);
    }
  },
  
  detectSystemTheme: () => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    set((state) => {
      state.systemTheme = isDark ? 'dark' : 'light';
    });
    
    // Apply theme if using system preference
    if (get().theme === 'system') {
      get().applyTheme();
    }
  },
  
  applyTheme: () => {
    const { theme, systemTheme } = get();
    const actualTheme = theme === 'system' ? systemTheme : theme;
    
    // Apply theme to DOM
    document.documentElement.classList.toggle('dark', actualTheme === 'dark');
    document.documentElement.setAttribute('data-theme', actualTheme);
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        actualTheme === 'dark' ? '#1a1a1a' : '#ffffff'
      );
    }
  },
});

// Set up system theme detection
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const { detectSystemTheme } = useStore.getState();
    detectSystemTheme();
  });
}