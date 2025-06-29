import React from 'react';
import { Toaster } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

interface ToastProviderProps {
  children?: React.ReactNode;
}

/**
 * Toast Provider Component
 * Configures the Sonner Toaster with theme-aware styling and consistent settings
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const { theme } = useTheme();

  return (
    <>
      {children}
      <Toaster
        // Visual options
        theme={theme as 'light' | 'dark' | 'system'}
        richColors
        closeButton
        
        // Position and layout
        position="bottom-right"
        expand={true}
        visibleToasts={5}
        
        // Styling
        toastOptions={{
          classNames: {
            toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
            error: 'group-[.toaster]:bg-destructive group-[.toaster]:text-destructive-foreground',
            success: 'group-[.toaster]:bg-success group-[.toaster]:text-success-foreground',
            warning: 'group-[.toaster]:bg-warning group-[.toaster]:text-warning-foreground',
            info: 'group-[.toaster]:bg-info group-[.toaster]:text-info-foreground',
          },
          style: {
            // Add subtle animations
            animation: 'slideIn 0.2s ease-out',
          },
        }}
        
        // Accessibility
        pauseWhenPageIsHidden
        
        // Custom styles for different viewport sizes
        className="toaster-container"
        style={{
          // Responsive positioning
          '@media (max-width: 640px)': {
            bottom: '1rem',
            right: '1rem',
            left: '1rem',
          },
        }}
        
        // Gap between toasts
        gap={8}
        
        // Offset from viewport edge
        offset="1rem"
      />
      
      <style jsx global>{`
        /* Custom animations */
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        /* Custom toast styles */
        .toaster-container {
          z-index: 9999;
        }
        
        /* Success variant with custom colors */
        [data-sonner-toast][data-type="success"] {
          --success: 142.1 76.2% 36.3%;
          --success-foreground: 355.7 100% 97.3%;
        }
        
        /* Warning variant with custom colors */
        [data-sonner-toast][data-type="warning"] {
          --warning: 38 92% 50%;
          --warning-foreground: 48 96% 89%;
        }
        
        /* Info variant with custom colors */
        [data-sonner-toast][data-type="info"] {
          --info: 214.3 77.8% 52.7%;
          --info-foreground: 214.3 77.8% 92.7%;
        }
        
        /* Loading state animation */
        [data-sonner-toast][data-type="loading"] svg {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        /* Mobile responsiveness */
        @media (max-width: 640px) {
          [data-sonner-toaster] {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            margin: 1rem !important;
          }
          
          [data-sonner-toast] {
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>
    </>
  );
}

export default ToastProvider;