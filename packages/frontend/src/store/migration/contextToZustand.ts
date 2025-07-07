/**
 * Migration utilities for transitioning from Context API to Zustand
 * 
 * This file provides compatibility layers and migration helpers
 * to facilitate gradual migration from React Context to Zustand
 */

import { useEffect } from 'react';
import { useStore } from '../index';

/**
 * Hook to migrate auth context data to Zustand
 * Use this temporarily during migration
 */
export function useMigrateAuth(contextAuth: any) {
  const updateUser = useStore((state) => state.updateUser);
  const { user: storeUser } = useStore((state) => ({
    user: state.user,
  }));

  useEffect(() => {
    if (contextAuth?.user && !storeUser) {
      // Migrate user data from context to store
      updateUser(contextAuth.user);
    }
  }, [contextAuth, storeUser, updateUser]);
}

/**
 * Hook to sync theme between old context and new store
 */
export function useSyncTheme(contextTheme: string | undefined) {
  const setTheme = useStore((state) => state.setTheme);
  const storeTheme = useStore((state) => state.theme);

  useEffect(() => {
    if (contextTheme && contextTheme !== storeTheme) {
      setTheme(contextTheme as any);
    }
  }, [contextTheme, storeTheme, setTheme]);
}

/**
 * Context compatibility wrapper
 * Provides Context API interface backed by Zustand store
 */
export function createContextCompatWrapper(slice: keyof typeof sliceMap) {
  return function CompatWrapper({ children }: { children: React.ReactNode }) {
    // The component just renders children
    // All state is managed by Zustand
    return <>{children}</>;
  };
}

// Map old context names to new store slices
const sliceMap = {
  AuthContext: 'auth',
  ThemeContext: 'theme',
  LanguageContext: 'language',
  ProfileContext: 'profile',
  SocketContext: 'webSocket',
} as const;

/**
 * Create a hook that mimics the old useContext API
 */
export function createCompatHook(contextName: keyof typeof sliceMap) {
  return function useCompatContext() {
    const slice = sliceMap[contextName];
    
    switch (slice) {
      case 'auth':
        return useStore((state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          login: state.login,
          logout: state.logout,
          register: state.register,
        }));
        
      case 'theme':
        return useStore((state) => ({
          theme: state.theme,
          setTheme: state.setTheme,
          toggleTheme: state.toggleTheme,
        }));
        
      case 'language':
        return useStore((state) => ({
          language: state.language,
          setLanguage: state.setLanguage,
          supportedLanguages: state.supportedLanguages,
        }));
        
      case 'profile':
        return useStore((state) => ({
          profile: state.profile,
          updateProfile: state.updateProfile,
          uploadAvatar: state.uploadAvatar,
        }));
        
      case 'webSocket':
        return useStore((state) => ({
          socket: state.socket,
          isConnected: state.isConnected,
          emit: state.emit,
          on: state.on,
          off: state.off,
        }));
        
      default:
        throw new Error(`Unknown context: ${contextName}`);
    }
  };
}

/**
 * Batch migration helper
 * Migrates all context data to Zustand in one operation
 */
export async function migrateAllContexts(contexts: {
  auth?: any;
  theme?: any;
  language?: any;
  profile?: any;
}) {
  const state = useStore.getState();
  
  // Migrate auth
  if (contexts.auth?.user && !state.user) {
    state.updateUser(contexts.auth.user);
    if (contexts.auth.tokens) {
      // Direct state update for tokens
      useStore.setState({ tokens: contexts.auth.tokens });
    }
  }
  
  // Migrate theme
  if (contexts.theme?.theme) {
    state.setTheme(contexts.theme.theme);
  }
  
  // Migrate language
  if (contexts.language?.language) {
    await state.setLanguage(contexts.language.language);
  }
  
  // Migrate profile
  if (contexts.profile?.profile && !state.profile) {
    useStore.setState({ profile: contexts.profile.profile });
  }
}

/**
 * Development helper to log context vs store differences
 */
export function useContextStoreSync(contextValue: any, storePath: string) {
  if (process.env.NODE_ENV === 'development') {
    useEffect(() => {
      const storeValue = useStore.getState();
      const storePathValue = storePath.split('.').reduce((obj, key) => obj?.[key], storeValue as any);
      
      if (JSON.stringify(contextValue) !== JSON.stringify(storePathValue)) {
        console.warn(`Store sync mismatch at ${storePath}:`, {
          context: contextValue,
          store: storePathValue,
        });
      }
    }, [contextValue, storePath]);
  }
}