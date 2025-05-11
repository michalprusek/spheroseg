import React from 'react';
import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { StatusBarV2 } from '../StatusBarV2';
import { EditMode } from '@/pages/segmentation/hooks/segmentation';
import '@testing-library/jest-dom';
import { resetAllMocks } from '../../../../../../shared/test-utils/componentTestUtils';
import { defaultStatusBarProps, renderStatusBar, verifyStatusBarValues } from './statusBarTestUtils';

// Mock dependencies
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

describe('StatusBarV2', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('renders without crashing', () => {
    renderStatusBar(<StatusBarV2 {...defaultStatusBarProps} />);
    // Component renders without errors
  });

  it('displays all correct values when fully populated', () => {
    renderStatusBar(<StatusBarV2 {...defaultStatusBarProps} />);
    verifyStatusBarValues(screen);
  });

  it('displays "None" when no polygon is selected', () => {
    renderStatusBar(<StatusBarV2 {...defaultStatusBarProps} selectedPolygonId={null} />);
    verifyStatusBarValues(screen, { selectedPolygonId: null });
  });

  it('does not display cursor position when imageCoords is null', () => {
    renderStatusBar(<StatusBarV2 {...defaultStatusBarProps} imageCoords={null} />);
    expect(screen.queryByText(/X:/)).not.toBeInTheDocument();
  });

  it('does not display image resolution when dimensions are not provided', () => {
    renderStatusBar(<StatusBarV2 {...defaultStatusBarProps} imageWidth={undefined} imageHeight={undefined} />);
    expect(screen.queryByText(/px/)).not.toBeInTheDocument();
  });

  it('displays CreatePolygon mode text when in creation mode', () => {
    renderStatusBar(<StatusBarV2 {...defaultStatusBarProps} editMode={EditMode.CreatePolygon} />);
    verifyStatusBarValues(screen, { mode: EditMode.CreatePolygon });
  });

  it('displays DeletePolygon mode text when in deletion mode', () => {
    renderStatusBar(<StatusBarV2 {...defaultStatusBarProps} editMode={EditMode.DeletePolygon} />);
    verifyStatusBarValues(screen, { mode: EditMode.DeletePolygon });
  });
});
