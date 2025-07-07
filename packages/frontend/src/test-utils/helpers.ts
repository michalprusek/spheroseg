import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/**
 * Test Helpers
 * Common testing helper functions
 */

// Wait for element to appear
export async function waitForElement(
  selector: string | RegExp,
  options?: { timeout?: number; container?: HTMLElement }
): Promise<HTMLElement> {
  const { timeout = 3000, container } = options || {};
  const queryMethod = container ? within(container) : screen;
  
  return waitFor(
    () => {
      const element = queryMethod.getByText(selector);
      return element;
    },
    { timeout }
  );
}

// Wait for element to disappear
export async function waitForElementToBeRemoved(
  selector: string | RegExp,
  options?: { timeout?: number; container?: HTMLElement }
): Promise<void> {
  const { timeout = 3000, container } = options || {};
  const queryMethod = container ? within(container) : screen;
  
  return waitFor(
    () => {
      expect(queryMethod.queryByText(selector)).not.toBeInTheDocument();
    },
    { timeout }
  );
}

// Wait for loading to complete
export async function waitForLoadingToFinish(
  loadingText: string = /loading/i,
  options?: { timeout?: number }
): Promise<void> {
  const { timeout = 5000 } = options || {};
  
  // Wait for loading indicator to appear
  const loading = await screen.findByText(loadingText, {}, { timeout: 1000 }).catch(() => null);
  
  if (loading) {
    // Wait for it to disappear
    await waitFor(() => {
      expect(screen.queryByText(loadingText)).not.toBeInTheDocument();
    }, { timeout });
  }
}

// Fill form fields
export async function fillForm(
  fields: Record<string, string | number | boolean>,
  options?: { submitButton?: string | RegExp }
): Promise<void> {
  const user = userEvent.setup();
  
  for (const [name, value] of Object.entries(fields)) {
    const field = screen.getByLabelText(new RegExp(name, 'i'));
    
    if (typeof value === 'boolean') {
      const checkbox = field as HTMLInputElement;
      if (checkbox.checked !== value) {
        await user.click(checkbox);
      }
    } else {
      await user.clear(field);
      await user.type(field, String(value));
    }
  }
  
  if (options?.submitButton) {
    const button = screen.getByRole('button', { name: options.submitButton });
    await user.click(button);
  }
}

// Select from dropdown
export async function selectOption(
  label: string | RegExp,
  option: string
): Promise<void> {
  const user = userEvent.setup();
  
  const select = screen.getByLabelText(label);
  await user.click(select);
  
  // Wait for dropdown to open
  const optionElement = await screen.findByRole('option', { name: option });
  await user.click(optionElement);
}

// Upload file
export async function uploadFile(
  input: HTMLElement | string,
  file: File
): Promise<void> {
  const user = userEvent.setup();
  
  const fileInput = typeof input === 'string' 
    ? screen.getByLabelText(input) 
    : input;
  
  await user.upload(fileInput, file);
}

// Drag and drop
export async function dragAndDrop(
  source: HTMLElement,
  target: HTMLElement
): Promise<void> {
  const user = userEvent.setup();
  
  // Simulate drag and drop
  await user.pointer([
    { target: source, keys: '[MouseLeft>]', coords: { x: 0, y: 0 } },
    { coords: { x: 10, y: 10 } },
    { target: target, coords: { x: 0, y: 0 } },
    { keys: '[/MouseLeft]' },
  ]);
}

// Take snapshot of element
export function takeSnapshot(
  element: HTMLElement,
  name: string
): void {
  expect(element).toMatchSnapshot(name);
}

// Debug element
export function debug(element?: HTMLElement): void {
  if (element) {
    console.log(element.outerHTML);
  } else {
    screen.debug();
  }
}

// Get all text content
export function getAllText(container?: HTMLElement): string {
  const element = container || document.body;
  return element.textContent || '';
}

// Find by test ID
export function getByTestId(testId: string, container?: HTMLElement): HTMLElement {
  const queryMethod = container ? within(container) : screen;
  return queryMethod.getByTestId(testId);
}

// Check if element is visible
export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetParent !== null
  );
}

// Wait for API call
export async function waitForApiCall(
  url: string | RegExp,
  options?: { method?: string; timeout?: number }
): Promise<void> {
  const { method = 'GET', timeout = 5000 } = options || {};
  
  return waitFor(() => {
    const calls = (global.fetch as any).mock.calls;
    const found = calls.some((call: any[]) => {
      const [callUrl, callOptions] = call;
      const matchesUrl = typeof url === 'string' ? callUrl === url : url.test(callUrl);
      const matchesMethod = (callOptions?.method || 'GET') === method;
      return matchesUrl && matchesMethod;
    });
    
    expect(found).toBe(true);
  }, { timeout });
}

// Mock API response
export function mockApiResponse(
  url: string | RegExp,
  response: any,
  options?: { status?: number; delay?: number }
): void {
  const { status = 200, delay = 0 } = options || {};
  
  (global.fetch as any).mockImplementation(async (callUrl: string) => {
    const matches = typeof url === 'string' ? callUrl === url : url.test(callUrl);
    
    if (matches) {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => response,
        text: async () => JSON.stringify(response),
      };
    }
    
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
      text: async () => 'Not found',
    };
  });
}

// Get form values
export function getFormValues(container?: HTMLElement): Record<string, any> {
  const form = container || document;
  const inputs = form.querySelectorAll('input, select, textarea');
  const values: Record<string, any> = {};
  
  inputs.forEach((input) => {
    const element = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const name = element.name || element.id;
    
    if (name) {
      if (element.type === 'checkbox') {
        values[name] = (element as HTMLInputElement).checked;
      } else if (element.type === 'radio') {
        if ((element as HTMLInputElement).checked) {
          values[name] = element.value;
        }
      } else {
        values[name] = element.value;
      }
    }
  });
  
  return values;
}

// Simulate network conditions
export function simulateNetworkConditions(
  condition: 'offline' | 'slow' | 'fast' = 'fast'
): void {
  if (condition === 'offline') {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
  } else if (condition === 'slow') {
    const originalFetch = global.fetch;
    (global.fetch as any).mockImplementation(async (...args: any[]) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return originalFetch(...args);
    });
  }
}

// Test accessibility
export async function testAccessibility(container?: HTMLElement): Promise<void> {
  const element = container || document.body;
  
  // Check for proper ARIA labels
  const interactiveElements = element.querySelectorAll(
    'button, a, input, select, textarea, [role="button"], [role="link"]'
  );
  
  interactiveElements.forEach((el) => {
    const hasLabel = 
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') ||
      el.textContent?.trim() ||
      (el as HTMLInputElement).labels?.length > 0;
    
    expect(hasLabel).toBeTruthy();
  });
  
  // Check for proper heading hierarchy
  const headings = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  let lastLevel = 0;
  
  headings.forEach((heading) => {
    const level = parseInt(heading.tagName[1]);
    expect(level - lastLevel).toBeLessThanOrEqual(1);
    lastLevel = level;
  });
}

// Create mock observer
export function createMockObserver(
  type: 'intersection' | 'resize' | 'mutation'
): any {
  const callbacks: Function[] = [];
  
  const MockObserver = vi.fn().mockImplementation((callback) => {
    callbacks.push(callback);
    
    return {
      observe: vi.fn((element) => {
        // Trigger callback immediately
        if (type === 'intersection') {
          callback([{ isIntersecting: true, target: element }], {});
        } else if (type === 'resize') {
          callback([{ target: element, contentRect: element.getBoundingClientRect() }], {});
        } else if (type === 'mutation') {
          callback([{ type: 'childList', target: element }], {});
        }
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  });
  
  return MockObserver;
}

// Wait for debounced function
export async function waitForDebounce(ms: number = 300): Promise<void> {
  vi.advanceTimersByTime(ms);
  await waitFor(() => {});
}

// Create keyboard event
export function createKeyboardEvent(
  key: string,
  options?: Partial<KeyboardEvent>
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    ...options,
  });
}

// Test component lifecycle
export async function testLifecycle(
  component: any,
  expectedCalls: {
    mount?: string[];
    update?: string[];
    unmount?: string[];
  }
): Promise<void> {
  const consoleSpy = vi.spyOn(console, 'log');
  
  const { rerender, unmount } = customRender(component);
  
  // Check mount
  if (expectedCalls.mount) {
    expectedCalls.mount.forEach((call) => {
      expect(consoleSpy).toHaveBeenCalledWith(call);
    });
  }
  
  // Check update
  if (expectedCalls.update) {
    consoleSpy.mockClear();
    rerender(component);
    
    expectedCalls.update.forEach((call) => {
      expect(consoleSpy).toHaveBeenCalledWith(call);
    });
  }
  
  // Check unmount
  if (expectedCalls.unmount) {
    consoleSpy.mockClear();
    unmount();
    
    expectedCalls.unmount.forEach((call) => {
      expect(consoleSpy).toHaveBeenCalledWith(call);
    });
  }
  
  consoleSpy.mockRestore();
}