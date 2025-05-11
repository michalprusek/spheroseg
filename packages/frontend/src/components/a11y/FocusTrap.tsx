import React, { useEffect, useRef } from 'react';

interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  restoreFocus?: boolean;
  className?: string;
}

/**
 * Component to trap focus within a container
 * Useful for modals, dialogs, and other components that should trap focus
 */
const FocusTrap: React.FC<FocusTrapProps> = ({ children, active = true, restoreFocus = true, className, ...props }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store the currently focused element
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
      if (!containerRef.current) return [];

      const elements = containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      return Array.from(elements);
    };

    // Focus the first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else if (containerRef.current) {
      // If there are no focusable elements, focus the container itself
      containerRef.current.tabIndex = -1;
      containerRef.current.focus();
    }

    // Handle Tab key to keep focus within the container
    const handleTabKey = (event: KeyboardEvent): void => {
      if (!active || !containerRef.current) return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // If Shift + Tab is pressed and focus is on the first element, move to the last element
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // If Tab is pressed and focus is on the last element, move to the first element
      else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    // Add event listener for Tab key
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Tab') {
        handleTabKey(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the previously focused element
      if (restoreFocus && previouslyFocusedElement.current && 'focus' in previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [active, restoreFocus]);

  return (
    <div ref={containerRef} className={className} {...props}>
      {children}
    </div>
  );
};

export default FocusTrap;
