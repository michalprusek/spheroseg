import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import NotificationSection from '@/components/settings/NotificationSection';
import { useToastErrorHandler } from '@/hooks/useErrorHandler';
import { Router, Routes, Route } from 'react-router-dom';
import { createMemoryHistory } from 'history';

// Mock dependencies
vi.mock('sonner', () => ({
  Toaster: vi.fn(({ children, ...props }) => (
    <div data-testid="mock-sonner-toaster" {...props}>
      {children}
    </div>
  )),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
    custom: vi.fn(),
  }
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: (key: string) => {
      const translations = {
        'settings.notificationSettingsSaved': 'Notification settings saved successfully',
        'settings.emailNotifications': 'Email Notifications',
        'settings.notifications.projectUpdates': 'Project Updates',
        'settings.inAppNotifications': 'In-App Notifications',
        'settings.savePreferences': 'Save Preferences',
        'common.cancel': 'Cancel',
        'error.handler.title': 'Error',
        'error.handler.defaultMessage': 'An unexpected error occurred',
      };
      return translations[key] || key;
    },
  })),
}));

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
  })),
}));

// Custom hook for error handling with toast
vi.mock('@/hooks/useErrorHandler', () => ({
  useToastErrorHandler: vi.fn(() => ({
    handleError: (error: any) => {
      toast.error(`Error: ${error.message || 'Unknown error'}`);
    }
  }))
}));

// Sample component that uses toast for various notifications
const ToastDemoComponent = () => {
  const { handleError } = useToastErrorHandler();
  
  const showSuccessToast = () => {
    toast.success('Operation completed successfully');
  };
  
  const showErrorToast = () => {
    toast.error('An error occurred');
  };
  
  const showInfoToast = () => {
    toast.info('Here is some information');
  };
  
  const showWarningToast = () => {
    toast.warning('Warning: This action cannot be undone');
  };
  
  const showErrorUsingHandler = () => {
    try {
      throw new Error('Something went wrong');
    } catch (error) {
      handleError(error);
    }
  };
  
  return (
    <div>
      <h1>Toast Demo</h1>
      <button onClick={showSuccessToast}>Show Success</button>
      <button onClick={showErrorToast}>Show Error</button>
      <button onClick={showInfoToast}>Show Info</button>
      <button onClick={showWarningToast}>Show Warning</button>
      <button onClick={showErrorUsingHandler}>Trigger Error Handler</button>
    </div>
  );
};

// Test application wrapper with router
const TestApp = () => {
  const history = createMemoryHistory({ initialEntries: ['/'] });
  
  return (
    <Router location={history.location} navigator={history}>
      <Toaster />
      <Routes>
        <Route path="/" element={<ToastDemoComponent />} />
        <Route path="/settings" element={<NotificationSection />} />
      </Routes>
    </Router>
  );
};

describe('Notification System Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both toast system and notification components', () => {
    render(<TestApp />);
    
    // The toast container should be rendered
    expect(screen.getByTestId('mock-sonner-toaster')).toBeInTheDocument();
    
    // The demo component should be visible
    expect(screen.getByText('Toast Demo')).toBeInTheDocument();
  });

  it('triggers success toast notifications', async () => {
    render(<TestApp />);
    
    // Trigger a success toast
    const successButton = screen.getByRole('button', { name: 'Show Success' });
    fireEvent.click(successButton);
    
    // Success toast should be triggered
    expect(toast.success).toHaveBeenCalledWith('Operation completed successfully');
  });

  it('triggers error toast notifications', async () => {
    render(<TestApp />);
    
    // Trigger an error toast
    const errorButton = screen.getByRole('button', { name: 'Show Error' });
    fireEvent.click(errorButton);
    
    // Error toast should be triggered
    expect(toast.error).toHaveBeenCalledWith('An error occurred');
  });

  it('triggers info toast notifications', async () => {
    render(<TestApp />);
    
    // Trigger an info toast
    const infoButton = screen.getByRole('button', { name: 'Show Info' });
    fireEvent.click(infoButton);
    
    // Info toast should be triggered
    expect(toast.info).toHaveBeenCalledWith('Here is some information');
  });

  it('triggers warning toast notifications', async () => {
    render(<TestApp />);
    
    // Trigger a warning toast
    const warningButton = screen.getByRole('button', { name: 'Show Warning' });
    fireEvent.click(warningButton);
    
    // Warning toast should be triggered
    expect(toast.warning).toHaveBeenCalledWith('Warning: This action cannot be undone');
  });

  it('uses error handler with toast', async () => {
    render(<TestApp />);
    
    // Trigger the error handler
    const errorHandlerButton = screen.getByRole('button', { name: 'Trigger Error Handler' });
    fireEvent.click(errorHandlerButton);
    
    // Error toast should be triggered with the error message
    expect(toast.error).toHaveBeenCalledWith('Error: Something went wrong');
  });
});