import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import userProfileService from '../services/userProfileService';

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
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('system');
  const [loaded, setLoaded] = useState(false);

  // Load theme from database or localStorage
  useEffect(() => {
    const loadTheme = async () => {
      // Always check localStorage first as it's the most reliable fallback
      const localTheme = localStorage.getItem('theme') as Theme | null;
      const validLocalTheme = localTheme && ['light', 'dark', 'system'].includes(localTheme) ? localTheme as Theme : 'system';
      
      if (user) {
        // Prevent multiple concurrent API calls for the same user
        const lastUserId = window.sessionStorage.getItem('spheroseg_theme_last_user');
        if (lastUserId === user.id) {
          console.log('[ThemeContext] Theme already loaded for user', user.id, ', using localStorage:', validLocalTheme);
          setThemeState(validLocalTheme);
          applyTheme(validLocalTheme);
          setLoaded(true);
          return;
        }

        try {
          // Mark this user as processed
          window.sessionStorage.setItem('spheroseg_theme_last_user', user.id);
          
          // Try to load from database
          const dbTheme = await userProfileService.loadSettingFromDatabase('theme', 'theme', 'system');
          
          if (dbTheme && ['light', 'dark', 'system'].includes(dbTheme)) {
            const validDbTheme = dbTheme as Theme;
            
            // Update localStorage if DB has different value
            if (localTheme !== validDbTheme) {
              localStorage.setItem('theme', validDbTheme);
              console.log('[ThemeContext] Updated localStorage with DB theme:', validDbTheme);
            }
            
            setThemeState(validDbTheme);
            applyTheme(validDbTheme);
          } else {
            // Use localStorage fallback
            console.log('[ThemeContext] No valid DB theme, using localStorage fallback:', validLocalTheme);
            setThemeState(validLocalTheme);
            applyTheme(validLocalTheme);
          }
        } catch (error) {
          // Clear the user marker if API fails so we can retry later
          window.sessionStorage.removeItem('spheroseg_theme_last_user');
          console.warn('[ThemeContext] Failed to load theme from database, using localStorage fallback:', error);
          // Fallback to localStorage
          setThemeState(validLocalTheme);
          applyTheme(validLocalTheme);
        }
      } else {
        // When not authenticated, use localStorage only
        console.log('[ThemeContext] No user, using localStorage theme:', validLocalTheme);
        setThemeState(validLocalTheme);
        applyTheme(validLocalTheme);
      }
      setLoaded(true);
    };

    loadTheme();
  }, [user]);

  const setTheme = async (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
    applyTheme(newTheme);

    // Save to database if user is authenticated
    if (user) {
      try {
        await userProfileService.setUserSetting('theme', newTheme, 'ui');
        console.log('[ThemeContext] Successfully saved theme to database:', newTheme);
      } catch (error) {
        console.warn('[ThemeContext] Failed to save theme to database (theme saved in localStorage):', error);
        // Theme is already saved in localStorage above, so this is not critical
        // The user's preference is preserved locally and will sync when the API is available
      }
    }
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
