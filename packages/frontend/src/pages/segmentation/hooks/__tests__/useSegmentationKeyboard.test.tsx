import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSegmentationKeyboard } from '../useSegmentationKeyboard';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import {
  TestEditMode,
  createKeyboardTestProps,
  simulateKeyPress,
  simulateKeyPressAndRelease,
  verifyEditModeWasSet,
  verifyHandlerWasCalled,
  createFocusedInput,
  simulateKeyPressWithTarget,
  cleanupInputElement,
} from '../../../../../shared/test-utils/keyboard-test-utils';

describe('useSegmentationKeyboard', () => {
  // Use shared utility to create test props
  const mockProps = createKeyboardTestProps();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with isShiftPressed as false', () => {
    const { result } = renderHook(() => useSegmentationKeyboard(mockProps));
    expect(result.current.isShiftPressed).toBe(false);
  });

  it('should set isShiftPressed to true when Shift key is pressed', () => {
    const { result } = renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('Shift');

    expect(result.current.isShiftPressed).toBe(true);
  });

  it('should set isShiftPressed to false when Shift key is released', () => {
    const { result } = renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPressAndRelease('Shift');

    expect(result.current.isShiftPressed).toBe(false);
  });

  it('should call setEditMode with View mode when V key is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('v');

    verifyEditModeWasSet(mockProps.setEditMode, TestEditMode.View);
  });

  it('should call setEditMode with EditVertices mode when E key is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('e');

    verifyEditModeWasSet(mockProps.setEditMode, TestEditMode.EditVertices);
  });

  it('should call setEditMode with AddPoints mode when A key is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('a');

    verifyEditModeWasSet(mockProps.setEditMode, TestEditMode.AddPoints);
  });

  it('should call setEditMode with CreatePolygon mode when C key is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('c');

    verifyEditModeWasSet(mockProps.setEditMode, TestEditMode.CreatePolygon);
  });

  it('should call setEditMode with Slice mode when S key is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('s');

    verifyEditModeWasSet(mockProps.setEditMode, TestEditMode.Slice);
  });

  it('should call onUndo when Ctrl+Z is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('z', { ctrlKey: true });

    verifyHandlerWasCalled(mockProps.onUndo);
  });

  it('should call onRedo when Ctrl+Y is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('y', { ctrlKey: true });

    verifyHandlerWasCalled(mockProps.onRedo);
  });

  it('should call onSave when Ctrl+S is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('s', { ctrlKey: true });

    verifyHandlerWasCalled(mockProps.onSave);
  });

  it('should call onZoomIn when + key is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('+');

    verifyHandlerWasCalled(mockProps.onZoomIn);
  });

  it('should call onZoomOut when - key is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('-');

    verifyHandlerWasCalled(mockProps.onZoomOut);
  });

  it('should call onResetView when R key is pressed', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    simulateKeyPress('r');

    verifyHandlerWasCalled(mockProps.onResetView);
  });

  it('should not call handlers when typing in an input field', () => {
    renderHook(() => useSegmentationKeyboard(mockProps));

    // Create and focus input
    const input = createFocusedInput();

    // Simulate event with input as target
    simulateKeyPressWithTarget('v', input);

    expect(mockProps.setEditMode).not.toHaveBeenCalled();

    // Clean up
    cleanupInputElement(input);
  });
});
