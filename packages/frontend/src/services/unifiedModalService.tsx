/**
 * Unified Modal Service
 * 
 * This service consolidates all modal/dialog functionality into a single,
 * comprehensive API for managing modals, dialogs, and overlays.
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { createLogger } from '@/utils/logging/unifiedLogger';
import { handleError, AppError, ErrorType } from '@/utils/error/unifiedErrorHandler';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const logger = createLogger('UnifiedModalService');

// ===========================
// Types and Interfaces
// ===========================

export interface ModalConfig {
  id: string;
  type: ModalType;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  options?: ModalOptions;
  priority?: number;
  onClose?: () => void;
  onConfirm?: (data?: any) => void;
  onCancel?: () => void;
}

export enum ModalType {
  DIALOG = 'dialog',
  ALERT = 'alert',
  CONFIRM = 'confirm',
  FORM = 'form',
  SHEET = 'sheet',
  DRAWER = 'drawer',
  FULLSCREEN = 'fullscreen',
  CUSTOM = 'custom'
}

export interface ModalOptions {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
  animate?: boolean;
  animationDuration?: number;
  backdrop?: boolean | 'blur';
  persistent?: boolean;
  className?: string;
  zIndex?: number;
  disableBodyScroll?: boolean;
  focusTrap?: boolean;
  returnFocusOnClose?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export interface AlertOptions extends ModalOptions {
  title: string;
  description?: string;
  confirmText?: string;
  variant?: 'default' | 'destructive' | 'warning' | 'info';
  icon?: ReactNode;
}

export interface ConfirmOptions extends AlertOptions {
  cancelText?: string;
  destructive?: boolean;
}

export interface FormModalOptions extends ModalOptions {
  title: string;
  description?: string;
  submitText?: string;
  cancelText?: string;
  initialValues?: Record<string, any>;
  validationSchema?: any;
  onSubmit: (values: any) => void | Promise<void>;
}

export interface ModalState {
  modals: ModalConfig[];
  activeModalId: string | null;
}

export interface ModalContextValue {
  // Modal management
  openModal: (config: ModalConfig) => void;
  closeModal: (id?: string) => void;
  closeAllModals: () => void;
  
  // Convenience methods
  alert: (message: string, options?: Partial<AlertOptions>) => Promise<void>;
  confirm: (message: string, options?: Partial<ConfirmOptions>) => Promise<boolean>;
  prompt: (message: string, options?: Partial<FormModalOptions>) => Promise<string | null>;
  
  // State
  modals: ModalConfig[];
  activeModal: ModalConfig | null;
  isOpen: boolean;
}

// ===========================
// Default Options
// ===========================

const DEFAULT_MODAL_OPTIONS: ModalOptions = {
  size: 'md',
  position: 'center',
  closeOnEscape: true,
  closeOnBackdropClick: true,
  showCloseButton: true,
  animate: true,
  animationDuration: 200,
  backdrop: true,
  persistent: false,
  disableBodyScroll: true,
  focusTrap: true,
  returnFocusOnClose: true,
  zIndex: 50
};

// ===========================
// Context
// ===========================

const ModalContext = createContext<ModalContextValue | null>(null);

// ===========================
// Modal Provider Component
// ===========================

export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState>({
    modals: [],
    activeModalId: null
  });
  
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalIdCounterRef = useRef(0);
  
  // Generate unique modal ID
  const generateModalId = useCallback(() => {
    return `modal-${++modalIdCounterRef.current}`;
  }, []);
  
  // Open modal
  const openModal = useCallback((config: ModalConfig) => {
    // Store current focus
    if (config.options?.returnFocusOnClose) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
    
    // Generate ID if not provided
    const modalConfig: ModalConfig = {
      ...config,
      id: config.id || generateModalId(),
      options: { ...DEFAULT_MODAL_OPTIONS, ...config.options }
    };
    
    logger.info('Opening modal', { id: modalConfig.id, type: modalConfig.type });
    
    setState(prev => ({
      modals: [...prev.modals, modalConfig],
      activeModalId: modalConfig.id
    }));
    
    // Disable body scroll if needed
    if (modalConfig.options?.disableBodyScroll) {
      document.body.style.overflow = 'hidden';
    }
  }, [generateModalId]);
  
  // Close modal
  const closeModal = useCallback((id?: string) => {
    const modalId = id || state.activeModalId;
    if (!modalId) return;
    
    const modal = state.modals.find(m => m.id === modalId);
    if (!modal) return;
    
    logger.info('Closing modal', { id: modalId });
    
    setState(prev => {
      const newModals = prev.modals.filter(m => m.id !== modalId);
      const newActiveId = newModals.length > 0 
        ? newModals[newModals.length - 1].id 
        : null;
      
      return {
        modals: newModals,
        activeModalId: newActiveId
      };
    });
    
    // Re-enable body scroll if no more modals
    if (state.modals.length === 1) {
      document.body.style.overflow = '';
    }
    
    // Restore focus
    if (modal.options?.returnFocusOnClose && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
    
    // Call onClose callback
    modal.onClose?.();
  }, [state.activeModalId, state.modals]);
  
  // Close all modals
  const closeAllModals = useCallback(() => {
    logger.info('Closing all modals');
    
    setState({
      modals: [],
      activeModalId: null
    });
    
    document.body.style.overflow = '';
    
    // Restore focus to last element
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, []);
  
  // Alert dialog
  const alert = useCallback((message: string, options?: Partial<AlertOptions>): Promise<void> => {
    return new Promise((resolve) => {
      const AlertComponent = () => (
        <AlertDialog
          message={message}
          options={options}
          onConfirm={() => {
            closeModal();
            resolve();
          }}
        />
      );
      
      openModal({
        id: generateModalId(),
        type: ModalType.ALERT,
        component: AlertComponent,
        options: {
          ...DEFAULT_MODAL_OPTIONS,
          closeOnBackdropClick: false,
          closeOnEscape: false,
          showCloseButton: false,
          ...options
        }
      });
    });
  }, [openModal, closeModal, generateModalId]);
  
  // Confirm dialog
  const confirm = useCallback((message: string, options?: Partial<ConfirmOptions>): Promise<boolean> => {
    return new Promise((resolve) => {
      const ConfirmComponent = () => (
        <ConfirmDialog
          message={message}
          options={options}
          onConfirm={() => {
            closeModal();
            resolve(true);
          }}
          onCancel={() => {
            closeModal();
            resolve(false);
          }}
        />
      );
      
      openModal({
        id: generateModalId(),
        type: ModalType.CONFIRM,
        component: ConfirmComponent,
        options: {
          ...DEFAULT_MODAL_OPTIONS,
          closeOnBackdropClick: false,
          closeOnEscape: true,
          showCloseButton: false,
          ...options
        }
      });
    });
  }, [openModal, closeModal, generateModalId]);
  
  // Prompt dialog
  const prompt = useCallback((message: string, options?: Partial<FormModalOptions>): Promise<string | null> => {
    return new Promise((resolve) => {
      const PromptComponent = () => (
        <PromptDialog
          message={message}
          options={options}
          onSubmit={(value: string) => {
            closeModal();
            resolve(value);
          }}
          onCancel={() => {
            closeModal();
            resolve(null);
          }}
        />
      );
      
      openModal({
        id: generateModalId(),
        type: ModalType.FORM,
        component: PromptComponent,
        options: {
          ...DEFAULT_MODAL_OPTIONS,
          closeOnBackdropClick: false,
          ...options
        }
      });
    });
  }, [openModal, closeModal, generateModalId]);
  
  const activeModal = state.modals.find(m => m.id === state.activeModalId) || null;
  
  const value: ModalContextValue = {
    openModal,
    closeModal,
    closeAllModals,
    alert,
    confirm,
    prompt,
    modals: state.modals,
    activeModal,
    isOpen: state.modals.length > 0
  };
  
  return (
    <ModalContext.Provider value={value}>
      {children}
      <ModalRenderer modals={state.modals} activeModalId={state.activeModalId} />
    </ModalContext.Provider>
  );
}

// ===========================
// Modal Renderer
// ===========================

function ModalRenderer({ modals, activeModalId }: { modals: ModalConfig[]; activeModalId: string | null }) {
  if (modals.length === 0) return null;
  
  return createPortal(
    <AnimatePresence>
      {modals.map((modal) => (
        <ModalWrapper
          key={modal.id}
          modal={modal}
          isActive={modal.id === activeModalId}
        />
      ))}
    </AnimatePresence>,
    document.body
  );
}

// ===========================
// Modal Wrapper Component
// ===========================

function ModalWrapper({ modal, isActive }: { modal: ModalConfig; isActive: boolean }) {
  const { closeModal } = useModal();
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Handle escape key
  React.useEffect(() => {
    if (!isActive || !modal.options?.closeOnEscape) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal(modal.id);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isActive, modal, closeModal]);
  
  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && modal.options?.closeOnBackdropClick) {
      closeModal(modal.id);
    }
  }, [modal, closeModal]);
  
  // Focus trap
  React.useEffect(() => {
    if (!isActive || !modal.options?.focusTrap || !modalRef.current) return;
    
    const focusableElements = modalRef.current.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
    );
    
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    firstFocusable?.focus();
    
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };
    
    modalRef.current.addEventListener('keydown', handleTab);
    return () => modalRef.current?.removeEventListener('keydown', handleTab);
  }, [isActive, modal.options?.focusTrap]);
  
  const Component = modal.component;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: modal.options?.animationDuration || 200 }}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        modal.options?.backdrop && 'bg-black/50',
        modal.options?.backdrop === 'blur' && 'backdrop-blur-sm',
        !isActive && 'pointer-events-none'
      )}
      style={{ zIndex: modal.options?.zIndex }}
      onClick={handleBackdropClick}
      aria-label={modal.options?.ariaLabel}
      aria-describedby={modal.options?.ariaDescribedBy}
    >
      <motion.div
        ref={modalRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: modal.options?.animationDuration || 200 }}
        className={cn(
          'relative bg-white dark:bg-gray-800 rounded-lg shadow-lg',
          getModalSizeClass(modal.options?.size),
          modal.options?.className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {modal.options?.showCloseButton && (
          <button
            onClick={() => closeModal(modal.id)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="sr-only">Close</span>
          </button>
        )}
        
        <Component {...modal.props} />
      </motion.div>
    </motion.div>
  );
}

// ===========================
// Built-in Dialog Components
// ===========================

function AlertDialog({ 
  message, 
  options, 
  onConfirm 
}: { 
  message: string; 
  options?: Partial<AlertOptions>; 
  onConfirm: () => void;
}) {
  return (
    <div className="p-6">
      {options?.icon && (
        <div className="mb-4 flex justify-center">
          {options.icon}
        </div>
      )}
      
      {options?.title && (
        <h2 className="text-lg font-semibold mb-2">{options.title}</h2>
      )}
      
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {message}
      </p>
      
      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          className={cn(
            'px-4 py-2 rounded-md font-medium',
            options?.variant === 'destructive'
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {options?.confirmText || 'OK'}
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog({
  message,
  options,
  onConfirm,
  onCancel
}: {
  message: string;
  options?: Partial<ConfirmOptions>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-6">
      {options?.icon && (
        <div className="mb-4 flex justify-center">
          {options.icon}
        </div>
      )}
      
      {options?.title && (
        <h2 className="text-lg font-semibold mb-2">{options.title}</h2>
      )}
      
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {message}
      </p>
      
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md font-medium border border-gray-300 hover:bg-gray-50"
        >
          {options?.cancelText || 'Cancel'}
        </button>
        <button
          onClick={onConfirm}
          className={cn(
            'px-4 py-2 rounded-md font-medium',
            options?.destructive
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {options?.confirmText || 'Confirm'}
        </button>
      </div>
    </div>
  );
}

function PromptDialog({
  message,
  options,
  onSubmit,
  onCancel
}: {
  message: string;
  options?: Partial<FormModalOptions>;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };
  
  return (
    <form onSubmit={handleSubmit} className="p-6">
      {options?.title && (
        <h2 className="text-lg font-semibold mb-2">{options.title}</h2>
      )}
      
      <p className="text-gray-600 dark:text-gray-300 mb-4">
        {message}
      </p>
      
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
        autoFocus
      />
      
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md font-medium border border-gray-300 hover:bg-gray-50"
        >
          {options?.cancelText || 'Cancel'}
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700"
        >
          {options?.submitText || 'Submit'}
        </button>
      </div>
    </form>
  );
}

// ===========================
// Utility Functions
// ===========================

function getModalSizeClass(size?: string): string {
  switch (size) {
    case 'sm':
      return 'max-w-sm w-full';
    case 'md':
      return 'max-w-md w-full';
    case 'lg':
      return 'max-w-lg w-full';
    case 'xl':
      return 'max-w-xl w-full';
    case 'full':
      return 'max-w-7xl w-full mx-4';
    default:
      return 'max-w-md w-full';
  }
}

// ===========================
// Hook
// ===========================

export function useModal(): ModalContextValue {
  const context = useContext(ModalContext);
  
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  
  return context;
}