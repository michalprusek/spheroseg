import React from 'react';
import { vi } from 'vitest';

// Mock Checkbox components
export const CheckboxRoot = ({ children, ...props }: any) => (
  <div data-testid="checkbox-root" {...props}>{children}</div>
);

export const CheckboxIndicator = ({ children, ...props }: any) => (
  <div data-testid="checkbox-indicator" {...props}>{children}</div>
);

// Mock other Radix components
export const DropdownMenuRoot = ({ children }: any) => children;
export const DropdownMenuTrigger = ({ children, ...props }: any) => (
  <button data-testid="dropdown-trigger" {...props}>{children}</button>
);
export const DropdownMenuContent = ({ children, ...props }: any) => (
  <div data-testid="dropdown-content" {...props}>{children}</div>
);
export const DropdownMenuItem = ({ children, ...props }: any) => (
  <div data-testid="dropdown-item" {...props}>{children}</div>
);

// Setup module mock
vi.mock('@/lib/radix-optimized', () => ({
  CheckboxRoot,
  CheckboxIndicator,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
}));