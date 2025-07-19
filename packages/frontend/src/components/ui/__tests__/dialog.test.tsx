import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../dialog';
import '@testing-library/jest-dom';

// Mock the Radix UI Dialog components
vi.mock('@radix-ui/react-dialog', () => {
  const React = vi.importActual('react') as typeof import('react');

  // Create a context to share state between components
  const DialogContext = React.createContext({
    isOpen: false,
    setIsOpen: () => {},
  });

  return {
    Root: ({ children, open, onOpenChange, modal = true }) => {
      const [isOpen, setIsOpen] = React.useState(open ?? false);

      React.useEffect(() => {
        if (open !== undefined) {
          setIsOpen(open);
        }
      }, [open]);

      const handleOpenChange = (newOpen) => {
        setIsOpen(newOpen);
        onOpenChange?.(newOpen);
      };

      return (
        <DialogContext.Provider value={{ isOpen, setIsOpen: handleOpenChange }}>
          <div data-testid="dialog-root" data-state={isOpen ? 'open' : 'closed'}>
            {children}
            {isOpen && <div data-testid="dialog-backdrop" />}
          </div>
        </DialogContext.Provider>
      );
    },
    Trigger: ({ children, ...props }) => {
      const { setIsOpen } = React.useContext(DialogContext);
      return (
        <button data-testid="dialog-trigger" onClick={() => setIsOpen(true)} {...props}>
          {children}
        </button>
      );
    },
    Portal: ({ children }) => {
      const { isOpen } = React.useContext(DialogContext);
      if (!isOpen) return null;
      return <div data-testid="dialog-portal">{children}</div>;
    },
    Overlay: React.forwardRef(({ children, className, ...props }, ref) => {
      const { isOpen } = React.useContext(DialogContext);
      if (!isOpen) return null;
      return (
        <div ref={ref} data-testid="dialog-overlay" className={className} {...props}>
          {children}
        </div>
      );
    }),
    Content: React.forwardRef(({ children, className, ...props }, ref) => {
      const { isOpen } = React.useContext(DialogContext);
      if (!isOpen) return null;
      return (
        <div ref={ref} data-testid="dialog-content" role="dialog" aria-modal="true" className={className} {...props}>
          {children}
        </div>
      );
    }),
    Close: ({ children, className, ...props }) => {
      const { setIsOpen } = React.useContext(DialogContext);
      return (
        <button data-testid="dialog-close" onClick={() => setIsOpen(false)} className={className} {...props}>
          {children}
        </button>
      );
    },
    Title: React.forwardRef(({ children, className, ...props }, ref) => (
      <h2 ref={ref} data-testid="dialog-title" className={className} {...props}>
        {children}
      </h2>
    )),
    Description: React.forwardRef(({ children, className, ...props }, ref) => (
      <p ref={ref} data-testid="dialog-description" className={className} {...props}>
        {children}
      </p>
    )),
  };
});

// Create a simple dialog test component
const TestDialog = ({ initialOpen = false }) => {
  const [open, setOpen] = React.useState(initialOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>Open Dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>This is a dialog description</DialogDescription>
        </DialogHeader>
        <div className="py-4">Dialog content goes here</div>
        <DialogFooter>
          <button>Cancel</button>
          <button>Save</button>
        </DialogFooter>
        <DialogClose />
      </DialogContent>
    </Dialog>
  );
};

describe('Dialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog trigger correctly', () => {
    render(<TestDialog />);

    expect(screen.getByTestId('dialog-trigger')).toBeInTheDocument();
    expect(screen.getByText('Open Dialog')).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', async () => {
    render(<TestDialog />);

    // Initially dialog content shouldn't be visible
    expect(screen.queryByTestId('dialog-content')).not.toBeInTheDocument();

    // Click the trigger
    fireEvent.click(screen.getByText('Open Dialog'));

    // Now dialog content should be visible
    await waitFor(() => {
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
    });

    // Check for dialog components
    expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-description')).toBeInTheDocument();
    expect(screen.getByText('Dialog Title')).toBeInTheDocument();
    expect(screen.getByText('This is a dialog description')).toBeInTheDocument();
    expect(screen.getByText('Dialog content goes here')).toBeInTheDocument();
  });

  it('closes dialog when close button is clicked', async () => {
    render(<TestDialog initialOpen={true} />);

    // Initially dialog content should be visible
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();

    // Click the close button (get the first one if multiple exist)
    const closeButtons = screen.getAllByTestId('dialog-close');
    fireEvent.click(closeButtons[0]);

    // Dialog content should be removed
    await waitFor(() => {
      expect(screen.queryByTestId('dialog-content')).not.toBeInTheDocument();
    });
  });

  it('renders dialog components with correct classes', () => {
    render(<TestDialog initialOpen={true} />);

    // Check for correct classes on components
    expect(screen.getByTestId('dialog-overlay')).toHaveClass('fixed');
    expect(screen.getByTestId('dialog-overlay')).toHaveClass('inset-0');
    expect(screen.getByTestId('dialog-overlay')).toHaveClass('z-50');

    expect(screen.getByTestId('dialog-content')).toHaveClass('fixed');
    expect(screen.getByTestId('dialog-content')).toHaveClass('z-50');

    expect(screen.getByTestId('dialog-title')).toHaveClass('text-lg');
    expect(screen.getByTestId('dialog-title')).toHaveClass('font-semibold');

    expect(screen.getByTestId('dialog-description')).toHaveClass('text-sm');
    expect(screen.getByTestId('dialog-description')).toHaveClass('text-muted-foreground');
  });

  it('renders with DialogHeader and DialogFooter', () => {
    render(<TestDialog initialOpen={true} />);

    // Find header and footer by their content since they're div elements without test ids
    const header = screen.getByText('Dialog Title').closest('div');
    expect(header).toHaveClass('flex');
    expect(header).toHaveClass('flex-col');

    const footer = screen.getByText('Save').closest('div');
    expect(footer).toHaveClass('flex');
    expect(footer).toHaveClass('flex-col-reverse');
    expect(footer).toHaveClass('sm:flex-row');
  });

  it('applies custom className to dialog components', () => {
    const CustomDialog = () => (
      <Dialog open={true}>
        <DialogContent className="custom-content-class">
          <DialogHeader className="custom-header-class">
            <DialogTitle className="custom-title-class">Custom Title</DialogTitle>
            <DialogDescription className="custom-description-class">Custom Description</DialogDescription>
          </DialogHeader>
          <DialogFooter className="custom-footer-class">
            <button>Custom Button</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    render(<CustomDialog />);

    expect(screen.getByTestId('dialog-content')).toHaveClass('custom-content-class');
    expect(screen.getByText('Custom Title').closest('div')).toHaveClass('custom-header-class');
    expect(screen.getByTestId('dialog-title')).toHaveClass('custom-title-class');
    expect(screen.getByTestId('dialog-description')).toHaveClass('custom-description-class');
    expect(screen.getByText('Custom Button').closest('div')).toHaveClass('custom-footer-class');
  });
});
