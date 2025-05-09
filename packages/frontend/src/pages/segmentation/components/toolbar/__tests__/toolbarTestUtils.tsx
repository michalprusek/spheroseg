import React from 'react';
import { vi } from 'vitest';
import { EditMode } from '@/pages/segmentation/hooks/segmentation';
import { renderWithProviders } from '../../../../../../shared/test-utils/componentTestUtils';
import { fireEvent } from '@testing-library/react';

// Common test props for ToolbarV2 component
export const defaultToolbarV2Props = {
  editMode: EditMode.View,
  setEditMode: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onResetView: vi.fn(),
  onSave: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onResegment: vi.fn(),
  canUndo: true,
  canRedo: false,
  isSaving: false
};

// Render helper for Toolbar components
export function renderToolbar(
  ui: React.ReactElement,
  options = {}
) {
  return renderWithProviders(ui, {
    withLanguage: true,
    ...options
  });
}

// Verification helper for testing button functionality
export function verifyToolbarButtonsAction(
  buttons: HTMLElement[],
  buttonIndex: number,
  mockFn: ReturnType<typeof vi.fn>,
  expectedParams?: any
) {
  fireEvent.click(buttons[buttonIndex]);
  
  if (expectedParams !== undefined) {
    expect(mockFn).toHaveBeenCalledWith(expectedParams);
  } else {
    expect(mockFn).toHaveBeenCalled();
  }
}

// Verification helper for testing button states
export function verifyButtonDisabledState(
  button: HTMLElement,
  shouldBeDisabled: boolean
) {
  if (shouldBeDisabled) {
    expect(button).toHaveClass('opacity-50');
  } else {
    expect(button).not.toHaveClass('opacity-50');
  }
}

// Test all toolbar buttons in a single call
export function testAllToolbarButtons(screen: any, props = defaultToolbarV2Props) {
  const buttons = screen.getAllByRole('button');
  
  // Verify button count
  expect(buttons.length).toBeGreaterThanOrEqual(10);
  
  // Test zoom in button
  verifyToolbarButtonsAction(buttons, 0, props.onZoomIn);
  
  // Test zoom out button
  verifyToolbarButtonsAction(buttons, 1, props.onZoomOut);
  
  // Test reset view button
  verifyToolbarButtonsAction(buttons, 2, props.onResetView);
  
  // Test view mode button
  verifyToolbarButtonsAction(buttons, 3, props.setEditMode, EditMode.View);
  
  // Test add points button
  verifyToolbarButtonsAction(buttons, 4, props.setEditMode, EditMode.AddPoints);
  
  // Test create polygon button
  verifyToolbarButtonsAction(buttons, 5, props.setEditMode, EditMode.CreatePolygon);
  
  // Test slice button
  verifyToolbarButtonsAction(buttons, 6, props.setEditMode, EditMode.Slice);
  
  // Test delete polygon button
  verifyToolbarButtonsAction(buttons, 7, props.setEditMode, EditMode.DeletePolygon);
  
  // Test undo button
  verifyToolbarButtonsAction(buttons, 8, props.onUndo);
  
  // Test save button
  verifyToolbarButtonsAction(buttons, 10, props.onSave);
  
  return buttons;
}