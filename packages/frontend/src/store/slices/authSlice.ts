import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import { unifiedAuthService } from '../../services/unifiedAuthService';
import type { User, AuthTokens, LoginCredentials, RegisterData } from '../../types/auth';

export interface AuthSlice {
  // State
  user: User | null;
  isAuthenticated: boolean;
  tokens: AuthTokens | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export const createAuthSlice: StateCreator<
  StoreState,
  [
    ['zustand/devtools', never],
    ['zustand/persist', unknown],
    ['zustand/subscribeWithSelector', never],
    ['zustand/immer', never]
  ],
  [],
  AuthSlice
> = (set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  tokens: null,
  isLoading: false,
  error: null,
  
  // Actions
  login: async (credentials) => {
    set((state) => {
      state.isLoading = true;
      state.error = null;
    });
    
    try {
      const { user, tokens } = await unifiedAuthService.login(credentials);
      
      set((state) => {
        state.user = user;
        state.isAuthenticated = true;
        state.tokens = tokens;
        state.isLoading = false;
      });
      
      // Trigger profile fetch
      get().fetchProfile();
      
      // Connect WebSocket
      get().connectSocket();
      
    } catch (error) {
      set((state) => {
        state.isLoading = false;
        state.error = error instanceof Error ? error.message : 'Login failed';
      });
      throw error;
    }
  },
  
  register: async (data) => {
    set((state) => {
      state.isLoading = true;
      state.error = null;
    });
    
    try {
      const { user, tokens } = await unifiedAuthService.register(data);
      
      set((state) => {
        state.user = user;
        state.isAuthenticated = true;
        state.tokens = tokens;
        state.isLoading = false;
      });
      
      // Trigger profile fetch
      get().fetchProfile();
      
      // Connect WebSocket
      get().connectSocket();
      
    } catch (error) {
      set((state) => {
        state.isLoading = false;
        state.error = error instanceof Error ? error.message : 'Registration failed';
      });
      throw error;
    }
  },
  
  logout: async () => {
    try {
      await unifiedAuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set((state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.tokens = null;
        state.error = null;
        state.profile = null;
      });
      
      // Disconnect WebSocket
      get().disconnectSocket();
    }
  },
  
  refreshTokens: async () => {
    try {
      const tokens = await unifiedAuthService.refreshTokens();
      
      set((state) => {
        state.tokens = tokens;
      });
    } catch (error) {
      // If refresh fails, logout
      await get().logout();
      throw error;
    }
  },
  
  updateUser: (userData) => {
    set((state) => {
      if (state.user) {
        state.user = { ...state.user, ...userData };
      }
    });
  },
  
  clearError: () => {
    set((state) => {
      state.error = null;
    });
  },
  
  checkAuth: async () => {
    set((state) => {
      state.isLoading = true;
    });
    
    try {
      const isAuth = await unifiedAuthService.isAuthenticated();
      
      if (isAuth) {
        const user = await unifiedAuthService.getCurrentUser();
        set((state) => {
          state.user = user;
          state.isAuthenticated = true;
          state.isLoading = false;
        });
        
        // Fetch profile
        get().fetchProfile();
        
        // Connect WebSocket
        get().connectSocket();
      } else {
        set((state) => {
          state.isAuthenticated = false;
          state.isLoading = false;
        });
      }
    } catch (error) {
      set((state) => {
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = error instanceof Error ? error.message : 'Auth check failed';
      });
    }
  },
});