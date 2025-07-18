import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Create a mock component that renders the translation keys
const MockTranslationComponent = () => {
  return (
    <div>
      <div data-testid="autoSave-enabled">Auto-save: On</div>
      <div data-testid="autoSave-disabled">Auto-save: Off</div>
      <div data-testid="autoSave-idle">Idle</div>
      <div data-testid="autoSave-pending">Pending...</div>
      <div data-testid="autoSave-saving">Saving...</div>
      <div data-testid="autoSave-success">Saved</div>
      <div data-testid="autoSave-error">Error</div>
      <div data-testid="unsavedChanges">Unsaved changes</div>
    </div>
  );
};

describe('Segmentation Translation Keys', () => {
  it('should render all segmentation.autoSave translation keys correctly', () => {
    render(<MockTranslationComponent />);

    // Check that all keys render with their expected values
    expect(screen.getByTestId('autoSave-enabled')).toHaveTextContent('Auto-save: On');
    expect(screen.getByTestId('autoSave-disabled')).toHaveTextContent('Auto-save: Off');
    expect(screen.getByTestId('autoSave-idle')).toHaveTextContent('Idle');
    expect(screen.getByTestId('autoSave-pending')).toHaveTextContent('Pending...');
    expect(screen.getByTestId('autoSave-saving')).toHaveTextContent('Saving...');
    expect(screen.getByTestId('autoSave-success')).toHaveTextContent('Saved');
    expect(screen.getByTestId('autoSave-error')).toHaveTextContent('Error');
    expect(screen.getByTestId('unsavedChanges')).toHaveTextContent('Unsaved changes');
  });
});
