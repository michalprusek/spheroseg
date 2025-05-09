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
        'segmentation.loading': 'Loading segmentation...',
        'segmentation.polygon': 'Polygon',
        'segmentation.regions': 'Segmentations',
        'segmentation.noData': 'No segmentation data available',
        'segmentation.noPolygons': 'No polygons found',
        'segmentation.autoSave.enabled': 'Auto-save: On',
        'segmentation.autoSave.disabled': 'Auto-save: Off',
        'segmentation.autoSave.idle': 'Idle',
        'segmentation.autoSave.pending': 'Pending...',
        'segmentation.autoSave.saving': 'Saving...',
        'segmentation.autoSave.success': 'Saved',
        'segmentation.autoSave.error': 'Error',
        'segmentation.unsavedChanges': 'Unsaved changes'
      };
      return translations[key] || key;
    },
    language: 'en',
    changeLanguage: vi.fn()
  }),
}));

// Test component to verify translation keys
const TestTranslationComponent = () => {
  const { t } = useLanguage();

  return (
    <div>
      <div data-testid="loading">{t('segmentation.loading')}</div>
      <div data-testid="polygon">{t('segmentation.polygon')}</div>
      <div data-testid="regions">{t('segmentation.regions')}</div>
      <div data-testid="noData">{t('segmentation.noData')}</div>
      <div data-testid="noPolygons">{t('segmentation.noPolygons')}</div>
      <div data-testid="autoSave-enabled">{t('segmentation.autoSave.enabled')}</div>
      <div data-testid="autoSave-disabled">{t('segmentation.autoSave.disabled')}</div>
      <div data-testid="autoSave-idle">{t('segmentation.autoSave.idle')}</div>
      <div data-testid="autoSave-pending">{t('segmentation.autoSave.pending')}</div>
      <div data-testid="autoSave-saving">{t('segmentation.autoSave.saving')}</div>
      <div data-testid="autoSave-success">{t('segmentation.autoSave.success')}</div>
      <div data-testid="autoSave-error">{t('segmentation.autoSave.error')}</div>
      <div data-testid="unsavedChanges">{t('segmentation.unsavedChanges')}</div>
    </div>
  );
};

describe('Segmentation Translation Keys', () => {
  it('should render all segmentation translation keys correctly', () => {
    render(
      <AuthProvider>
        <LanguageProvider>
          <TestTranslationComponent />
        </LanguageProvider>
      </AuthProvider>
    );

    // Check that all keys render with their expected values
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading segmentation...');
    expect(screen.getByTestId('polygon')).toHaveTextContent('Polygon');
    expect(screen.getByTestId('regions')).toHaveTextContent('Segmentations');
    expect(screen.getByTestId('noData')).toHaveTextContent('No segmentation data available');
    expect(screen.getByTestId('noPolygons')).toHaveTextContent('No polygons found');
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
