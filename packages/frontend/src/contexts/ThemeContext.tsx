import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Default theme (can be 'light', 'dark', or 'system')
const defaultTheme = 'system';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth(); // Keep useAuth for potential future backend integration
  const [theme, setThemeState] = useState<Theme>('system');
  const [loaded, setLoaded] = useState(false);

  // Load theme from localStorage only
  useEffect(() => {
    const localTheme = localStorage.getItem('theme') as Theme | null;
    if (localTheme) {
      setThemeState(localTheme);
      applyTheme(localTheme);
    } else {
      setThemeState('system'); // Default to system if nothing in localStorage
      applyTheme('system');
    }
    setLoaded(true);
    // Removed dependency on user, as Supabase logic is gone
  }, []);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
    applyTheme(newTheme);

    // Removed Supabase update logic
    // TODO: Implement saving theme preference to our backend if needed
  };

  const applyTheme = (theme: Theme) => {
    const root = window.document.documentElement;

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

      root.classList.remove('light', 'dark');
      root.classList.add(systemTheme);

      // Set data-theme attribute for components that use it
      root.setAttribute('data-theme', systemTheme);
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);

      // Set data-theme attribute for components that use it
      root.setAttribute('data-theme', theme);
    }

    // Apply consistent dark mode styling to body and html
    if (root.classList.contains('dark')) {
      document.documentElement.style.backgroundColor = '#111827'; // bg-gray-900
      document.body.style.backgroundColor = '#111827'; // bg-gray-900
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    } else {
      document.documentElement.style.backgroundColor = '#f9fafb'; // bg-gray-50
      document.body.style.backgroundColor = '#f9fafb'; // bg-gray-50
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    }
  };

  // Initial theme application and system theme listener
  useEffect(() => {
    if (!loaded) return;

    applyTheme(theme);

    // Listen for system theme changes if using system theme
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = () => {
        applyTheme('system');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, loaded]);

  if (!loaded) {
    return null; // Keep this to prevent flash of unstyled content
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
