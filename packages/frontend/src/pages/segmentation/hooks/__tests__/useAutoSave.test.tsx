import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useAutoSave } from '../useAutoSave';
import { toast } from 'sonner';

import { vi } from 'vitest';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        'editor.autoSaveSuccess': 'Changes auto-saved successfully',
        'editor.autoSaveError': 'Auto-save failed. Your changes are not saved.',
        'editor.autoSaveEnabled': 'Auto-save enabled',
        'editor.autoSaveDisabled': 'Auto-save disabled',
      };
      return translations[key] || key;
    },
  }),
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    // Mock global timer functions properly
    global.setTimeout = vi.fn().mockImplementation(setTimeout);
    global.clearTimeout = vi.fn().mockImplementation(clearTimeout);
    global.setInterval = vi.fn().mockImplementation(setInterval);
    global.clearInterval = vi.fn().mockImplementation(clearInterval);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockSegmentation = {
    polygons: [{ id: 'test', points: [{ x: 0, y: 0 }], type: 'external' }],
    imageWidth: 100,
    imageHeight: 100,
  };

  const mockHandleSave = vi.fn().mockResolvedValue(undefined);
  const testAutoSaveDelay = 1000;

  it('should not auto-save if disabled', () => {
    const { result } = renderHook(() =>
      useAutoSave(
        mockSegmentation,
        1,
        2,
        false,
        mockHandleSave,
        testAutoSaveDelay,
        false, // disabled
      ),
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockHandleSave).not.toHaveBeenCalled();
    expect(result.current.autoSaveEnabled).toBe(false);
  });

  it('should auto-save after the specified delay', async () => {
    const { result, rerender } = renderHook(
      ({ historyIndex }) => useAutoSave(mockSegmentation, historyIndex, 2, false, mockHandleSave, testAutoSaveDelay),
      { initialProps: { historyIndex: 0 } },
    );

    // Change history index to trigger auto-save
    rerender({ historyIndex: 1 });

    // Status should change to pending
    expect(result.current.autoSaveStatus).toBe('pending');

    // Fast-forward time past the auto-save delay
    act(() => {
      vi.advanceTimersByTime(testAutoSaveDelay + 10);
    });

    // Wait for the promises to resolve
    await vi.runAllTimersAsync();

    // Should have called handleSave
    expect(mockHandleSave).toHaveBeenCalled();

    // Status should be success
    expect(result.current.autoSaveStatus).toBe('success');

    // Should show success toast
    expect(toast.success).toHaveBeenCalledWith('Changes auto-saved successfully');

    // Should update lastSavedIndex
    expect(result.current.lastSavedIndex).toBe(1);

    // Should reset hasUnsavedChanges
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should handle save errors', async () => {
    // Mock handleSave to reject
    const mockHandleSaveError = vi.fn().mockRejectedValue(new Error('Save failed'));

    const { result, rerender } = renderHook(
      ({ historyIndex }) =>
        useAutoSave(mockSegmentation, historyIndex, 2, false, mockHandleSaveError, testAutoSaveDelay),
      { initialProps: { historyIndex: 0 } },
    );

    // Change history index to trigger auto-save
    rerender({ historyIndex: 1 });

    // Fast-forward time past the auto-save delay
    act(() => {
      vi.advanceTimersByTime(testAutoSaveDelay + 10);
    });

    // Wait for the promises to resolve/reject
    await vi.runAllTimersAsync();

    // Should have attempted to call handleSave
    expect(mockHandleSaveError).toHaveBeenCalled();

    // Status should be error
    expect(result.current.autoSaveStatus).toBe('error');

    // Should show error toast
    expect(toast.error).toHaveBeenCalledWith('Auto-save failed. Your changes are not saved.');

    // Should NOT update lastSavedIndex
    expect(result.current.lastSavedIndex).toBe(0);

    // Should still have unsaved changes
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('should toggle auto-save when requested', () => {
    const { result } = renderHook(() =>
      useAutoSave(mockSegmentation, 1, 2, false, mockHandleSave, testAutoSaveDelay, true),
    );

    // Initially enabled
    expect(result.current.autoSaveEnabled).toBe(true);

    // Toggle off
    act(() => {
      result.current.toggleAutoSave();
    });
    expect(result.current.autoSaveEnabled).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Auto-save disabled');

    // Toggle back on
    act(() => {
      result.current.toggleAutoSave();
    });
    expect(result.current.autoSaveEnabled).toBe(true);
    expect(toast.info).toHaveBeenCalledWith('Auto-save enabled');
  });

  it('should save immediately when saveNow is called', async () => {
    const { result, rerender } = renderHook(
      ({ historyIndex }) => useAutoSave(mockSegmentation, historyIndex, 2, false, mockHandleSave),
      { initialProps: { historyIndex: 0 } },
    );

    // Change history index to have unsaved changes
    rerender({ historyIndex: 1 });

    // Call saveNow
    await act(async () => {
      await result.current.saveNow();
    });

    // Should have called handleSave
    expect(mockHandleSave).toHaveBeenCalled();

    // Status should be success
    expect(result.current.autoSaveStatus).toBe('success');

    // Should update lastSavedIndex
    expect(result.current.lastSavedIndex).toBe(1);

    // Should reset hasUnsavedChanges
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should not auto-save when already saving', async () => {
    const { result, rerender } = renderHook(
      ({ historyIndex, saving }) =>
        useAutoSave(mockSegmentation, historyIndex, 2, saving, mockHandleSave, testAutoSaveDelay),
      { initialProps: { historyIndex: 0, saving: true } },
    );

    // Change history index to try to trigger auto-save
    rerender({ historyIndex: 1, saving: true });

    // Fast-forward time past the auto-save delay
    act(() => {
      vi.advanceTimersByTime(testAutoSaveDelay + 10);
    });

    // Wait for the promises to resolve
    await vi.runAllTimersAsync();

    // Should NOT have called handleSave because saving is true
    expect(mockHandleSave).not.toHaveBeenCalled();
  });

  it('should not auto-save when there are no unsaved changes', async () => {
    const { result } = renderHook(() =>
      useAutoSave(
        mockSegmentation,
        0, // Same as lastSavedIndex initial value
        1,
        false,
        mockHandleSave,
        testAutoSaveDelay,
      ),
    );

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(testAutoSaveDelay * 2);
    });

    // Should not have called handleSave
    expect(mockHandleSave).not.toHaveBeenCalled();

    // hasUnsavedChanges should be false
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should clear existing timeout when history changes again', async () => {
    // Spy on clearTimeout
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { rerender } = renderHook(
      ({ historyIndex }) => useAutoSave(mockSegmentation, historyIndex, 3, false, mockHandleSave, testAutoSaveDelay),
      { initialProps: { historyIndex: 0 } },
    );

    // Change history index to trigger auto-save
    rerender({ historyIndex: 1 });

    // Change again before timeout fires
    rerender({ historyIndex: 2 });

    // Should have called clearTimeout
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should handle error when saveNow fails', async () => {
    // Mock handleSave to reject
    const mockHandleSaveError = vi.fn().mockRejectedValue(new Error('Save failed'));

    const { result, rerender } = renderHook(
      ({ historyIndex }) => useAutoSave(mockSegmentation, historyIndex, 2, false, mockHandleSaveError),
      { initialProps: { historyIndex: 0 } },
    );

    // Change history index to have unsaved changes
    rerender({ historyIndex: 1 });

    // Call saveNow
    await act(async () => {
      await result.current.saveNow();
    });

    // Should have called handleSave
    expect(mockHandleSaveError).toHaveBeenCalled();

    // Status should be error
    expect(result.current.autoSaveStatus).toBe('error');
  });

  it('should not saveNow when segmentation data is null', async () => {
    const { result } = renderHook(() =>
      useAutoSave(
        null, // null segmentation
        1,
        2,
        false,
        mockHandleSave,
      ),
    );

    // Call saveNow with null segmentation
    await act(async () => {
      await result.current.saveNow();
    });

    // Should NOT have called handleSave
    expect(mockHandleSave).not.toHaveBeenCalled();
  });

  it('should update lastSavedIndex when manual save completes', () => {
    const { result, rerender } = renderHook(
      ({ historyIndex, saving }) => useAutoSave(mockSegmentation, historyIndex, 2, saving, mockHandleSave),
      { initialProps: { historyIndex: 0, saving: true } },
    );

    // Simulate saving in progress with a different history index
    rerender({ historyIndex: 1, saving: true });

    // Simulate save completion
    rerender({ historyIndex: 1, saving: false });

    // Should update lastSavedIndex
    expect(result.current.lastSavedIndex).toBe(1);

    // Should not have unsaved changes
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});
