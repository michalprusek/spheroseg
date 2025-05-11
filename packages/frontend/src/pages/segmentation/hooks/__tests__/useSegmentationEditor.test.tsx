import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import {
  MockHookUser,
  mockSegmentationEditorImplementation,
} from '../../../../../shared/test-utils/segmentation-editor-test-utils';

// Create a mock file for the hook
vi.mock('../useSegmentationEditor.ts', () => ({
  ...mockSegmentationEditorImplementation(),
  EditMode: {
    VIEW: 'VIEW',
    EDIT: 'EDIT',
    CREATE_POLYGON: 'CREATE_POLYGON',
    SLICE: 'SLICE',
    ADD_POINTS: 'ADD_POINTS',
  },
}));

describe('useSegmentationEditor Hook', () => {
  it('can be mocked successfully', () => {
    render(<MockHookUser />);
    expect(screen.getByTestId('hook-user')).toBeInTheDocument();
  });
});
