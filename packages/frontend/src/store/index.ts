import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { StateCreator } from 'zustand';

// Import all store slices
import { createAuthSlice, type AuthSlice } from './slices/authSlice';
import { createThemeSlice, type ThemeSlice } from './slices/themeSlice';
import { createLanguageSlice, type LanguageSlice } from './slices/languageSlice';
import { createProfileSlice, type ProfileSlice } from './slices/profileSlice';
import { createWebSocketSlice, type WebSocketSlice } from './slices/webSocketSlice';
import { createUISlice, type UISlice } from './slices/uiSlice';
import { createSegmentationSlice, type SegmentationSlice } from './slices/segmentationSlice';
import { createNotificationSlice, type NotificationSlice } from './slices/notificationSlice';

// Combined store type
export type StoreState = AuthSlice &
  ThemeSlice &
  LanguageSlice &
  ProfileSlice &
  WebSocketSlice &
  UISlice &
  SegmentationSlice &
  NotificationSlice;

// Store creator type
type StoreCreator = StateCreator<
  StoreState,
  [
    ['zustand/devtools', never],
    ['zustand/persist', unknown],
    ['zustand/subscribeWithSelector', never],
    ['zustand/immer', never]
  ],
  [],
  StoreState
>;

// Create the store with all middleware
export const useStore = create<StoreState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer<StoreState>((set, get, api) => ({
          // Auth slice
          ...createAuthSlice(set, get, api),
          
          // Theme slice
          ...createThemeSlice(set, get, api),
          
          // Language slice
          ...createLanguageSlice(set, get, api),
          
          // Profile slice
          ...createProfileSlice(set, get, api),
          
          // WebSocket slice
          ...createWebSocketSlice(set, get, api),
          
          // UI slice
          ...createUISlice(set, get, api),
          
          // Segmentation slice
          ...createSegmentationSlice(set, get, api),
          
          // Notification slice
          ...createNotificationSlice(set, get, api),
        }))
      ),
      {
        name: 'spheroseg-store',
        version: 1,
        partialize: (state) => ({
          // Persist only selected state
          auth: {
            user: state.user,
            isAuthenticated: state.isAuthenticated,
            tokens: state.tokens,
          },
          theme: {
            theme: state.theme,
            colorScheme: state.colorScheme,
          },
          language: {
            language: state.language,
            supportedLanguages: state.supportedLanguages,
          },
          profile: {
            profile: state.profile,
          },
        }),
        migrate: (persistedState: any, version: number) => {
          // Handle store migrations
          if (version === 0) {
            // Migration from version 0 to 1
            return persistedState;
          }
          return persistedState;
        },
      }
    ),
    {
      name: 'SpherosegStore',
      trace: true,
      anonymousActionType: 'action',
    }
  )
);

// Typed selectors
export const useAuth = () => useStore((state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  tokens: state.tokens,
  login: state.login,
  logout: state.logout,
  refreshTokens: state.refreshTokens,
  updateUser: state.updateUser,
}));

export const useTheme = () => useStore((state) => ({
  theme: state.theme,
  colorScheme: state.colorScheme,
  setTheme: state.setTheme,
  toggleTheme: state.toggleTheme,
  setColorScheme: state.setColorScheme,
}));

export const useLanguage = () => useStore((state) => ({
  language: state.language,
  supportedLanguages: state.supportedLanguages,
  setLanguage: state.setLanguage,
  detectLanguage: state.detectLanguage,
}));

export const useProfile = () => useStore((state) => ({
  profile: state.profile,
  fetchProfile: state.fetchProfile,
  updateProfile: state.updateProfile,
  uploadAvatar: state.uploadAvatar,
  deleteAvatar: state.deleteAvatar,
}));

export const useWebSocket = () => useStore((state) => ({
  socket: state.socket,
  isConnected: state.isConnected,
  connectionStatus: state.connectionStatus,
  connect: state.connectSocket,
  disconnect: state.disconnectSocket,
  emit: state.emit,
  on: state.on,
  off: state.off,
}));

export const useUI = () => useStore((state) => ({
  modals: state.modals,
  sidebarOpen: state.sidebarOpen,
  loading: state.loading,
  openModal: state.openModal,
  closeModal: state.closeModal,
  closeAllModals: state.closeAllModals,
  toggleSidebar: state.toggleSidebar,
  setLoading: state.setLoading,
}));

export const useSegmentation = () => useStore((state) => ({
  currentImage: state.currentImage,
  segments: state.segments,
  selectedSegment: state.selectedSegment,
  isProcessing: state.isProcessing,
  setCurrentImage: state.setCurrentImage,
  addSegment: state.addSegment,
  updateSegment: state.updateSegment,
  deleteSegment: state.deleteSegment,
  selectSegment: state.selectSegment,
  startProcessing: state.startProcessing,
  completeProcessing: state.completeProcessing,
}));

export const useNotifications = () => useStore((state) => ({
  notifications: state.notifications,
  addNotification: state.addNotification,
  removeNotification: state.removeNotification,
  clearNotifications: state.clearNotifications,
}));

// Utility functions
export const resetStore = () => {
  useStore.setState((state) => {
    // Reset to initial state
    state.logout();
    state.closeAllModals();
    state.clearNotifications();
    return state;
  });
};

// Subscribe to auth changes
useStore.subscribe(
  (state) => state.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      // Clear sensitive data when logged out
      useStore.getState().closeAllModals();
      useStore.getState().disconnectSocket();
    }
  }
);

// Export store for external usage
export default useStore;