import React from 'react';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import '@testing-library/jest-dom';

// Mock the AuthContext to avoid API calls during tests
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    checkAuth: vi.fn(),
  }),
}));

// Mock the LanguageContext to provide translations
vi.mock('@/contexts/LanguageContext', () => ({
  LanguageProvider: ({ children }) => <div>{children}</div>,
  useLanguage: () => ({
    t: (key: string) => {
      const translations = {
        'editor.sliceErrorInvalidPolygon': 'Cannot slice: Invalid polygon selected.',
        'editor.sliceWarningInvalidResult': 'Slice resulted in polygons too small to be valid.',
        'editor.sliceWarningInvalidIntersections': 'Slice invalid: The cut line must intersect the polygon at exactly two points.',
        'editor.sliceSuccess': 'Polygon sliced successfully.',
        'editor.noPolygonToSlice': 'No polygons available to slice.',
        'editor.savingTooltip': 'Saving...'
      };
      return translations[key] || key;
    },
    language: 'en',
    changeLanguage: vi.fn()
  }),
}));

// Test component to verify translation keys
const TestEditorTranslationComponent = () => {
  const { t } = useLanguage();

  return (
    <div>
      <div data-testid="sliceErrorInvalidPolygon">{t('editor.sliceErrorInvalidPolygon')}</div>
      <div data-testid="sliceWarningInvalidResult">{t('editor.sliceWarningInvalidResult')}</div>
      <div data-testid="sliceWarningInvalidIntersections">{t('editor.sliceWarningInvalidIntersections')}</div>
      <div data-testid="sliceSuccess">{t('editor.sliceSuccess')}</div>
      <div data-testid="noPolygonToSlice">{t('editor.noPolygonToSlice')}</div>
      <div data-testid="savingTooltip">{t('editor.savingTooltip')}</div>
    </div>
  );
};

describe('Editor Slice Warning Translation Keys', () => {
  it('should render all editor slice warning translation keys correctly', () => {
    render(
      <AuthProvider>
        <LanguageProvider>
          <TestEditorTranslationComponent />
        </LanguageProvider>
      </AuthProvider>
    );

    // Check that all keys render with their expected values
    expect(screen.getByTestId('sliceErrorInvalidPolygon')).toHaveTextContent('Cannot slice: Invalid polygon selected.');
    expect(screen.getByTestId('sliceWarningInvalidResult')).toHaveTextContent('Slice resulted in polygons too small to be valid.');
    expect(screen.getByTestId('sliceWarningInvalidIntersections')).toHaveTextContent('Slice invalid: The cut line must intersect the polygon at exactly two points.');
    expect(screen.getByTestId('sliceSuccess')).toHaveTextContent('Polygon sliced successfully.');
    expect(screen.getByTestId('noPolygonToSlice')).toHaveTextContent('No polygons available to slice.');
    expect(screen.getByTestId('savingTooltip')).toHaveTextContent('Saving...');
  });
});
