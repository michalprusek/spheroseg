import { describe, it, expect, vi } from 'vitest';
import { toast } from '../use-toast';
import * as sonnerModule from 'sonner';

// Mock the sonner module
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
    custom: vi.fn(),
  },
}));

describe('use-toast hook', () => {
  it('should directly export the sonner toast function', () => {
    // Verify that the exported toast is the same as sonner's toast
    expect(toast).toBe(sonnerModule.toast);
  });

  it('should call sonner toast.success when used', () => {
    // Call the toast.success method
    toast.success('Test success message');

    // Verify that sonner's toast.success was called with the correct arguments
    expect(sonnerModule.toast.success).toHaveBeenCalledWith('Test success message');
  });

  it('should call sonner toast.error when used', () => {
    // Call the toast.error method
    toast.error('Test error message');

    // Verify that sonner's toast.error was called with the correct arguments
    expect(sonnerModule.toast.error).toHaveBeenCalledWith('Test error message');
  });

  it('should call sonner toast.dismiss when used', () => {
    // Call the toast.dismiss method
    toast.dismiss();

    // Verify that sonner's toast.dismiss was called
    expect(sonnerModule.toast.dismiss).toHaveBeenCalled();
  });

  it('should call sonner toast function directly when used', () => {
    // Mock the direct toast call
    vi.spyOn(sonnerModule, 'toast');

    // Call the toast function directly
    toast('Direct toast message');

    // Verify that sonner's toast was called with the correct arguments
    expect(sonnerModule.toast).toHaveBeenCalledWith('Direct toast message');
  });

  it('should pass additional options to sonner toast', () => {
    // Call with additional options
    toast.success('Success with options', {
      duration: 5000,
      position: 'top-center',
      description: 'This is a description',
    });

    // Verify the options were passed through
    expect(sonnerModule.toast.success).toHaveBeenCalledWith('Success with options', {
      duration: 5000,
      position: 'top-center',
      description: 'This is a description',
    });
  });
});
