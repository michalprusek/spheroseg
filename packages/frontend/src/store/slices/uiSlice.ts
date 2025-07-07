import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { ReactNode } from 'react';

export interface Modal {
  id: string;
  type: 'info' | 'warning' | 'error' | 'confirm' | 'custom';
  title: string;
  content: ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
  }>;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

export interface LoadingState {
  global: boolean;
  tasks: Map<string, boolean>;
}

export interface UISlice {
  // State
  modals: Modal[];
  sidebarOpen: boolean;
  loading: LoadingState;
  activeView: string;
  breadcrumbs: Array<{ label: string; path?: string }>;
  
  // Actions
  openModal: (modal: Omit<Modal, 'id'>) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setLoading: (loading: boolean, taskId?: string) => void;
  setActiveView: (view: string) => void;
  setBreadcrumbs: (breadcrumbs: Array<{ label: string; path?: string }>) => void;
}

let modalIdCounter = 0;

export const createUISlice: StateCreator<
  StoreState,
  [
    ['zustand/devtools', never],
    ['zustand/persist', unknown],
    ['zustand/subscribeWithSelector', never],
    ['zustand/immer', never]
  ],
  [],
  UISlice
> = (set, get) => ({
  // Initial state
  modals: [],
  sidebarOpen: true,
  loading: {
    global: false,
    tasks: new Map(),
  },
  activeView: '',
  breadcrumbs: [],
  
  // Actions
  openModal: (modalData) => {
    const id = `modal-${++modalIdCounter}`;
    const modal: Modal = {
      ...modalData,
      id,
      closeOnBackdrop: modalData.closeOnBackdrop ?? true,
      closeOnEscape: modalData.closeOnEscape ?? true,
      size: modalData.size ?? 'md',
    };
    
    set((state) => {
      state.modals.push(modal);
    });
    
    return id;
  },
  
  closeModal: (id) => {
    set((state) => {
      const modalIndex = state.modals.findIndex((m) => m.id === id);
      if (modalIndex !== -1) {
        const modal = state.modals[modalIndex];
        modal.onClose?.();
        state.modals.splice(modalIndex, 1);
      }
    });
  },
  
  closeAllModals: () => {
    const { modals } = get();
    
    // Call onClose for all modals
    modals.forEach((modal) => modal.onClose?.());
    
    set((state) => {
      state.modals = [];
    });
  },
  
  toggleSidebar: () => {
    set((state) => {
      state.sidebarOpen = !state.sidebarOpen;
    });
    
    // Save preference
    localStorage.setItem('sidebarOpen', String(!get().sidebarOpen));
  },
  
  setSidebarOpen: (open) => {
    set((state) => {
      state.sidebarOpen = open;
    });
    
    // Save preference
    localStorage.setItem('sidebarOpen', String(open));
  },
  
  setLoading: (loading, taskId) => {
    set((state) => {
      if (taskId) {
        if (loading) {
          state.loading.tasks.set(taskId, true);
        } else {
          state.loading.tasks.delete(taskId);
        }
        // Update global loading based on active tasks
        state.loading.global = state.loading.tasks.size > 0;
      } else {
        state.loading.global = loading;
      }
    });
  },
  
  setActiveView: (view) => {
    set((state) => {
      state.activeView = view;
    });
  },
  
  setBreadcrumbs: (breadcrumbs) => {
    set((state) => {
      state.breadcrumbs = breadcrumbs;
    });
  },
});

// Initialize sidebar state from localStorage
if (typeof window !== 'undefined') {
  const savedSidebarState = localStorage.getItem('sidebarOpen');
  if (savedSidebarState !== null) {
    useStore.setState({ sidebarOpen: savedSidebarState === 'true' });
  }
}