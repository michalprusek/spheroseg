import { useEffect } from 'react';
import { useStore } from '@/store';

interface StoreProviderProps {
  children: React.ReactNode;
}

/**
 * StoreProvider - Initializes and configures the Zustand store
 * 
 * This provider handles:
 * - Initial authentication check
 * - System theme detection
 * - Language detection
 * - Store hydration from persistence
 */
export function StoreProvider({ children }: StoreProviderProps) {
  const checkAuth = useStore((state) => state.checkAuth);
  const detectSystemTheme = useStore((state) => state.detectSystemTheme);
  const detectLanguage = useStore((state) => state.detectLanguage);
  const applyTheme = useStore((state) => state.applyTheme);

  useEffect(() => {
    // Initialize store on mount
    const initializeStore = async () => {
      // Detect and apply system theme
      detectSystemTheme();
      applyTheme();

      // Detect and apply language
      detectLanguage();

      // Check authentication status
      await checkAuth();
    };

    initializeStore();

    // Set up system theme listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = () => {
      detectSystemTheme();
      applyTheme();
    };
    
    mediaQuery.addEventListener('change', handleThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, [checkAuth, detectSystemTheme, detectLanguage, applyTheme]);

  return <>{children}</>;
}