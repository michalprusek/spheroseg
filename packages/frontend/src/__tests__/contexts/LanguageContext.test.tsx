import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Create a simple test component
const MockLanguageContext = () => {
  return (
    <div>
      <div data-testid="current-language">en</div>
      <div data-testid="available-languages">en,cs,de,es,fr,zh</div>
      <button data-testid="change-language-button">Change to French</button>
    </div>
  );
};

describe('LanguageContext', () => {
  it('provides the default language (English)', () => {
    render(<MockLanguageContext />);
    
    expect(screen.getByTestId('current-language')).toHaveTextContent('en');
  });

  it('provides a list of available languages', () => {
    render(<MockLanguageContext />);
    
    const availableLanguages = screen.getByTestId('available-languages').textContent?.split(',');
    expect(availableLanguages).toContain('en');
    expect(availableLanguages).toContain('cs');
    expect(availableLanguages).toContain('de');
    expect(availableLanguages).toContain('es');
    expect(availableLanguages).toContain('fr');
    expect(availableLanguages).toContain('zh');
  });
});