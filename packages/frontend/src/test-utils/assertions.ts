import { screen, within } from '@testing-library/react';
import { expect } from 'vitest';

/**
 * Custom Assertion Utilities
 * Extended assertions for testing
 */

// Assert element has class
export function expectToHaveClass(element: HTMLElement, className: string): void {
  expect(element).toHaveClass(className);
}

// Assert element has multiple classes
export function expectToHaveClasses(element: HTMLElement, classNames: string[]): void {
  classNames.forEach(className => {
    expect(element).toHaveClass(className);
  });
}

// Assert element has style
export function expectToHaveStyle(
  element: HTMLElement,
  styles: Record<string, string | number>
): void {
  Object.entries(styles).forEach(([property, value]) => {
    expect(element).toHaveStyle({ [property]: value });
  });
}

// Assert element is disabled
export function expectToBeDisabled(element: HTMLElement): void {
  expect(element).toBeDisabled();
  expect(element).toHaveAttribute('aria-disabled', 'true');
}

// Assert element is enabled
export function expectToBeEnabled(element: HTMLElement): void {
  expect(element).toBeEnabled();
  expect(element).not.toHaveAttribute('aria-disabled', 'true');
}

// Assert element is visible
export function expectToBeVisible(element: HTMLElement): void {
  expect(element).toBeVisible();
  expect(element).not.toHaveStyle({ display: 'none' });
  expect(element).not.toHaveStyle({ visibility: 'hidden' });
}

// Assert element is hidden
export function expectToBeHidden(element: HTMLElement): void {
  expect(element).not.toBeVisible();
}

// Assert form field has error
export function expectFieldToHaveError(
  fieldName: string,
  errorMessage?: string | RegExp
): void {
  const field = screen.getByLabelText(new RegExp(fieldName, 'i'));
  expect(field).toHaveAttribute('aria-invalid', 'true');
  
  if (errorMessage) {
    const error = screen.getByText(errorMessage);
    expect(error).toBeInTheDocument();
  }
}

// Assert form field has no error
export function expectFieldToHaveNoError(fieldName: string): void {
  const field = screen.getByLabelText(new RegExp(fieldName, 'i'));
  expect(field).not.toHaveAttribute('aria-invalid', 'true');
}

// Assert toast notification
export function expectToastNotification(
  message: string | RegExp,
  type?: 'success' | 'error' | 'warning' | 'info'
): void {
  const toast = screen.getByRole('alert');
  expect(toast).toHaveTextContent(message);
  
  if (type) {
    expect(toast).toHaveAttribute('data-type', type);
  }
}

// Assert no toast notification
export function expectNoToastNotification(): void {
  const toast = screen.queryByRole('alert');
  expect(toast).not.toBeInTheDocument();
}

// Assert loading state
export function expectLoadingState(
  container?: HTMLElement,
  loadingText: string | RegExp = /loading/i
): void {
  const queryMethod = container ? within(container) : screen;
  const loading = queryMethod.getByText(loadingText);
  expect(loading).toBeInTheDocument();
}

// Assert no loading state
export function expectNoLoadingState(
  container?: HTMLElement,
  loadingText: string | RegExp = /loading/i
): void {
  const queryMethod = container ? within(container) : screen;
  const loading = queryMethod.queryByText(loadingText);
  expect(loading).not.toBeInTheDocument();
}

// Assert empty state
export function expectEmptyState(
  container?: HTMLElement,
  emptyText: string | RegExp = /no.*found/i
): void {
  const queryMethod = container ? within(container) : screen;
  const empty = queryMethod.getByText(emptyText);
  expect(empty).toBeInTheDocument();
}

// Assert list items
export function expectListItems(
  container: HTMLElement,
  expectedItems: string[]
): void {
  const items = within(container).getAllByRole('listitem');
  expect(items).toHaveLength(expectedItems.length);
  
  expectedItems.forEach((expectedItem, index) => {
    expect(items[index]).toHaveTextContent(expectedItem);
  });
}

// Assert table data
export function expectTableData(
  headers: string[],
  rows: Array<Record<string, string | number>>
): void {
  // Check headers
  headers.forEach(header => {
    expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
  });
  
  // Check rows
  const tableRows = screen.getAllByRole('row').slice(1); // Skip header row
  expect(tableRows).toHaveLength(rows.length);
  
  rows.forEach((row, rowIndex) => {
    const cells = within(tableRows[rowIndex]).getAllByRole('cell');
    headers.forEach((header, cellIndex) => {
      expect(cells[cellIndex]).toHaveTextContent(String(row[header]));
    });
  });
}

// Assert form values
export function expectFormValues(
  container: HTMLElement,
  expectedValues: Record<string, string | number | boolean>
): void {
  Object.entries(expectedValues).forEach(([name, value]) => {
    const field = within(container).getByLabelText(new RegExp(name, 'i'));
    
    if (typeof value === 'boolean') {
      if (value) {
        expect(field).toBeChecked();
      } else {
        expect(field).not.toBeChecked();
      }
    } else {
      expect(field).toHaveValue(String(value));
    }
  });
}

// Assert API call
export function expectApiCall(
  url: string | RegExp,
  options?: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  }
): void {
  const { method = 'GET', body, headers } = options || {};
  
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringMatching(url),
    expect.objectContaining({
      method,
      ...(body && { body: JSON.stringify(body) }),
      ...(headers && { headers: expect.objectContaining(headers) }),
    })
  );
}

// Assert no API call
export function expectNoApiCall(url: string | RegExp): void {
  const calls = (global.fetch as any).mock.calls;
  const found = calls.some((call: any[]) => {
    const [callUrl] = call;
    return typeof url === 'string' ? callUrl === url : url.test(callUrl);
  });
  
  expect(found).toBe(false);
}

// Assert navigation
export function expectNavigation(pathname: string, search?: string): void {
  expect(window.location.pathname).toBe(pathname);
  
  if (search) {
    expect(window.location.search).toBe(search);
  }
}

// Assert document title
export function expectDocumentTitle(title: string | RegExp): void {
  if (typeof title === 'string') {
    expect(document.title).toBe(title);
  } else {
    expect(document.title).toMatch(title);
  }
}

// Assert focus
export function expectFocus(element: HTMLElement): void {
  expect(document.activeElement).toBe(element);
}

// Assert no focus
export function expectNoFocus(element: HTMLElement): void {
  expect(document.activeElement).not.toBe(element);
}

// Assert ARIA attributes
export function expectAriaAttributes(
  element: HTMLElement,
  attributes: Record<string, string>
): void {
  Object.entries(attributes).forEach(([attr, value]) => {
    expect(element).toHaveAttribute(`aria-${attr}`, value);
  });
}

// Assert accessibility
export function expectAccessible(container?: HTMLElement): void {
  const element = container || document.body;
  
  // Check for alt text on images
  const images = element.querySelectorAll('img');
  images.forEach(img => {
    expect(img).toHaveAttribute('alt');
  });
  
  // Check for labels on form controls
  const inputs = element.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    const hasLabel = 
      input.getAttribute('aria-label') ||
      input.getAttribute('aria-labelledby') ||
      (input as HTMLInputElement).labels?.length > 0;
    
    expect(hasLabel).toBeTruthy();
  });
  
  // Check for button text
  const buttons = element.querySelectorAll('button');
  buttons.forEach(button => {
    const hasText = 
      button.textContent?.trim() ||
      button.getAttribute('aria-label');
    
    expect(hasText).toBeTruthy();
  });
}

// Assert console output
export function expectConsoleLog(message: string | RegExp): void {
  expect(console.log).toHaveBeenCalledWith(
    expect.stringMatching(message)
  );
}

export function expectConsoleError(message: string | RegExp): void {
  expect(console.error).toHaveBeenCalledWith(
    expect.stringMatching(message)
  );
}

export function expectConsoleWarn(message: string | RegExp): void {
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringMatching(message)
  );
}

// Assert event fired
export function expectEventFired(
  element: HTMLElement,
  eventName: string,
  detail?: any
): void {
  const eventSpy = vi.fn();
  element.addEventListener(eventName, eventSpy);
  
  // Trigger action that should fire event
  element.dispatchEvent(new CustomEvent(eventName, { detail }));
  
  expect(eventSpy).toHaveBeenCalled();
  
  if (detail) {
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail,
      })
    );
  }
  
  element.removeEventListener(eventName, eventSpy);
}

// Assert performance metric
export function expectPerformanceMetric(
  metricName: string,
  maxValue: number
): void {
  const entries = performance.getEntriesByName(metricName);
  expect(entries).toHaveLength(1);
  expect(entries[0].duration).toBeLessThan(maxValue);
}

// Assert Redux/Zustand state
export function expectStoreState(
  store: any,
  expectedState: Record<string, any>
): void {
  const state = store.getState();
  
  Object.entries(expectedState).forEach(([key, value]) => {
    expect(state[key]).toEqual(value);
  });
}

// Custom matchers
expect.extend({
  toHaveBeenCalledBefore(received: any, other: any) {
    const receivedCalls = received.mock.invocationCallOrder;
    const otherCalls = other.mock.invocationCallOrder;
    
    const receivedFirst = Math.min(...receivedCalls);
    const otherFirst = Math.min(...otherCalls);
    
    const pass = receivedFirst < otherFirst;
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to have been called before ${other}`
          : `Expected ${received} to have been called before ${other}`,
    };
  },
  
  toHaveBeenCalledAfter(received: any, other: any) {
    const receivedCalls = received.mock.invocationCallOrder;
    const otherCalls = other.mock.invocationCallOrder;
    
    const receivedFirst = Math.min(...receivedCalls);
    const otherLast = Math.max(...otherCalls);
    
    const pass = receivedFirst > otherLast;
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to have been called after ${other}`
          : `Expected ${received} to have been called after ${other}`,
    };
  },
  
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be within range ${floor} - ${ceiling}`
          : `Expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});