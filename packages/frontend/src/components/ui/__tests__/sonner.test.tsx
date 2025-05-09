import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Toaster } from '../sonner';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

// Mock dependencies
vi.mock('sonner', () => ({
  Toaster: vi.fn(({ children, ...props }) => (
    <div data-testid="mock-sonner-toaster" {...props}>
      {children}
    </div>
  )),
  toast: {
    dismiss: vi.fn(),
  }
}));

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
  })),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: (key: string) => key === 'common.cancel' ? 'Cancel' : key,
  })),
}));

// Utility function to render the component
const renderToaster = () => {
  return render(<Toaster />);
};

describe('Toaster Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sonner toaster with correct props', () => {
    renderToaster();
    
    const toasterElement = screen.getByTestId('mock-sonner-toaster');
    
    expect(toasterElement).toBeInTheDocument();
    expect(toasterElement).toHaveAttribute('theme', 'light');
    expect(toasterElement).toHaveAttribute('className', 'toaster group');
    expect(toasterElement).toHaveAttribute('position', 'bottom-right');
    expect(toasterElement).toHaveAttribute('closeButton', 'true');
    expect(toasterElement).toHaveAttribute('richColors', 'true');
    expect(toasterElement).toHaveAttribute('expand', 'false');
  });

  it('should provide toast classNames in toastOptions', () => {
    renderToaster();
    
    const toasterElement = screen.getByTestId('mock-sonner-toaster');
    
    expect(toasterElement).toHaveAttribute('toastOptions');
    const toastOptions = JSON.parse(toasterElement.getAttribute('toastOptions') || '{}');
    
    expect(toastOptions.classNames).toEqual({
      toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
      description: 'group-[.toast]:text-muted-foreground',
      actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
      cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
    });
  });

  it('renders the close all button with correct text', () => {
    renderToaster();
    
    const closeButton = screen.getByRole('button');
    
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveTextContent('Cancel');
    expect(closeButton).toHaveClass('fixed bottom-4 right-4 z-[100] opacity-0 group-[.toaster]:opacity-100 transition-opacity duration-200');
  });

  it('calls toast.dismiss when close all button is clicked', () => {
    renderToaster();
    
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    
    expect(toast.dismiss).toHaveBeenCalledTimes(1);
  });

  it('should handle close all with correct translated text', () => {
    // Mock a different translation
    (useLanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      t: (key: string) => key === 'common.cancel' ? 'Close All' : key,
    });
    
    renderToaster();
    
    const closeButton = screen.getByRole('button');
    expect(closeButton).toHaveTextContent('Close All');
  });
});