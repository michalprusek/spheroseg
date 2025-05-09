/**
 * Accessibility utilities for improving application accessibility
 */

import { KeyboardEvent } from 'react';

/**
 * Key codes for keyboard events
 */
export enum KeyCode {
  ENTER = 'Enter',
  SPACE = ' ',
  ESCAPE = 'Escape',
  TAB = 'Tab',
  ARROW_UP = 'ArrowUp',
  ARROW_DOWN = 'ArrowDown',
  ARROW_LEFT = 'ArrowLeft',
  ARROW_RIGHT = 'ArrowRight',
  HOME = 'Home',
  END = 'End',
  PAGE_UP = 'PageUp',
  PAGE_DOWN = 'PageDown',
}

/**
 * Check if an event key matches one of the specified keys
 * @param event Keyboard event
 * @param keys Array of keys to check
 * @returns True if the event key matches any of the specified keys
 */
export const isKey = (event: KeyboardEvent, keys: KeyCode | KeyCode[]): boolean => {
  const keysArray = Array.isArray(keys) ? keys : [keys];
  return keysArray.includes(event.key as KeyCode);
};

/**
 * Handle keyboard events for interactive elements
 * @param event Keyboard event
 * @param onActivate Callback to execute when the element is activated
 * @param keys Keys that should trigger activation (default: Enter and Space)
 */
export const handleKeyboardActivation = (
  event: KeyboardEvent,
  onActivate: () => void,
  keys: KeyCode[] = [KeyCode.ENTER, KeyCode.SPACE]
): void => {
  if (isKey(event, keys)) {
    event.preventDefault();
    onActivate();
  }
};

/**
 * Create an ID for an element based on a prefix and a value
 * @param prefix ID prefix
 * @param value Value to append to the prefix
 * @returns Generated ID
 */
export const createAccessibleId = (prefix: string, value: string | number): string => {
  return `${prefix}-${value}`;
};

/**
 * Focus trap utility to keep focus within a container
 * @param containerId ID of the container element
 * @returns Object with methods to activate and deactivate the focus trap
 */
export const createFocusTrap = (containerId: string) => {
  let focusableElements: HTMLElement[] = [];
  let firstFocusableElement: HTMLElement | null = null;
  let lastFocusableElement: HTMLElement | null = null;
  let active = false;

  const getFocusableElements = (): HTMLElement[] => {
    const container = document.getElementById(containerId);
    if (!container) return [];

    // Get all focusable elements within the container
    const elements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    return Array.from(elements);
  };

  const handleTabKey = (event: KeyboardEvent): void => {
    if (!active || !firstFocusableElement || !lastFocusableElement) return;

    // If Shift + Tab is pressed and focus is on the first element, move to the last element
    if (event.shiftKey && document.activeElement === firstFocusableElement) {
      event.preventDefault();
      lastFocusableElement.focus();
    }
    // If Tab is pressed and focus is on the last element, move to the first element
    else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
      event.preventDefault();
      firstFocusableElement.focus();
    }
  };

  const activate = (): void => {
    focusableElements = getFocusableElements();
    firstFocusableElement = focusableElements[0] || null;
    lastFocusableElement = focusableElements[focusableElements.length - 1] || null;

    // Focus the first element when activated
    if (firstFocusableElement) {
      firstFocusableElement.focus();
    }

    // Add event listener for Tab key
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === KeyCode.TAB) {
        handleTabKey(event as unknown as KeyboardEvent);
      }
    });

    active = true;
  };

  const deactivate = (): void => {
    document.removeEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === KeyCode.TAB) {
        handleTabKey(event as unknown as KeyboardEvent);
      }
    });

    active = false;
  };

  return {
    activate,
    deactivate,
    focusFirst: () => firstFocusableElement?.focus(),
    focusLast: () => lastFocusableElement?.focus(),
  };
};

/**
 * Announce a message to screen readers using an ARIA live region
 * @param message Message to announce
 * @param priority Priority of the announcement (polite or assertive)
 */
export const announceToScreenReader = (
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void => {
  // Check if the live region already exists
  let liveRegion = document.getElementById(`sr-live-region-${priority}`);

  // Create the live region if it doesn't exist
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = `sr-live-region-${priority}`;
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-relevant', 'additions');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only'; // This class should hide the element visually
    document.body.appendChild(liveRegion);
  }

  // Update the live region with the message
  liveRegion.textContent = '';
  
  // Use setTimeout to ensure the DOM update is recognized by screen readers
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }, 50);
};

/**
 * Create a hook to manage focus when a component mounts and unmounts
 * @param elementRef Reference to the element to focus
 * @param restoreFocus Whether to restore focus to the previously focused element when unmounting
 */
export const manageFocus = (
  elementRef: React.RefObject<HTMLElement>,
  restoreFocus = true
): void => {
  // Store the currently focused element
  const previouslyFocusedElement = document.activeElement as HTMLElement;

  // Focus the element
  if (elementRef.current) {
    elementRef.current.focus();
  }

  // Return a cleanup function to restore focus
  if (restoreFocus) {
    return () => {
      if (previouslyFocusedElement && 'focus' in previouslyFocusedElement) {
        previouslyFocusedElement.focus();
      }
    };
  }
};

/**
 * Add a skip link to the page for keyboard users
 * @param mainContentId ID of the main content element
 */
export const addSkipLink = (mainContentId: string): HTMLElement => {
  // Check if the skip link already exists
  let skipLink = document.getElementById('skip-to-content');

  // Create the skip link if it doesn't exist
  if (!skipLink) {
    skipLink = document.createElement('a');
    skipLink.id = 'skip-to-content';
    skipLink.href = `#${mainContentId}`;
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    
    // Style the skip link to be visually hidden until focused
    skipLink.style.position = 'absolute';
    skipLink.style.top = '-40px';
    skipLink.style.left = '0';
    skipLink.style.padding = '8px';
    skipLink.style.zIndex = '100';
    skipLink.style.background = '#ffffff';
    skipLink.style.color = '#000000';
    skipLink.style.textDecoration = 'none';
    skipLink.style.transition = 'top 0.2s ease-in-out';
    
    // Show the skip link when focused
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '0';
    });
    
    // Hide the skip link when blurred
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });
    
    // Add the skip link to the beginning of the body
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  return skipLink;
};

/**
 * Check if an element is visible to screen readers
 * @param element Element to check
 * @returns True if the element is visible to screen readers
 */
export const isVisibleToScreenReaders = (element: HTMLElement): boolean => {
  // Check if the element is hidden from screen readers
  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  // Check if the element has role="presentation" or role="none"
  const role = element.getAttribute('role');
  if (role === 'presentation' || role === 'none') {
    return false;
  }

  // Check if the element is hidden with CSS
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
    return false;
  }

  return true;
};

/**
 * Create a React component for visually hidden text (for screen readers only)
 */
export const srOnlyStyle = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
} as const;
