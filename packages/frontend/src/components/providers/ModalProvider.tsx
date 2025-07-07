import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useUI } from '@/store';
import type { Modal } from '@/store/slices/uiSlice';

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
};

interface ModalItemProps {
  modal: Modal;
}

function ModalItem({ modal }: ModalItemProps) {
  const { closeModal } = useUI();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && modal.closeOnBackdrop) {
      closeModal(modal.id);
    }
  };

  React.useEffect(() => {
    if (!modal.closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal(modal.id);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [modal.id, modal.closeOnEscape, closeModal]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${
          sizeClasses[modal.size || 'md']
        } ${modal.className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold">{modal.title}</h3>
          <button
            onClick={() => closeModal(modal.id)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {modal.content}
        </div>

        {/* Actions */}
        {modal.actions && modal.actions.length > 0 && (
          <div className="flex items-center justify-end gap-2 p-4 border-t dark:border-gray-700">
            {modal.actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  action.variant === 'primary'
                    ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300'
                    : action.variant === 'danger'
                    ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 disabled:opacity-50'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * ModalProvider - Renders modals from Zustand store
 * 
 * Features:
 * - Stacking support for multiple modals
 * - Backdrop click to close
 * - Escape key to close
 * - Smooth animations
 * - Customizable sizes and styles
 */
export function ModalProvider() {
  const { modals } = useUI();

  return (
    <AnimatePresence>
      {modals.map((modal) => (
        <ModalItem key={modal.id} modal={modal} />
      ))}
    </AnimatePresence>
  );
}