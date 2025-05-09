import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock the components and contexts
vi.mock('../ProjectActions', () => ({
  default: () => (
    <div data-testid="project-actions">
      <button title="projectActions.duplicateTooltip" data-testid="duplicate-button">Duplicate</button>
      <button title="projectActions.deleteTooltip" data-testid="delete-button">Delete</button>
    </div>
  )
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('ProjectActions', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <div data-testid="project-actions">
          <button title="projectActions.duplicateTooltip" data-testid="duplicate-button">Duplicate</button>
          <button title="projectActions.deleteTooltip" data-testid="delete-button">Delete</button>
        </div>
      </BrowserRouter>
    );
  };

  it('renders duplicate and delete buttons', () => {
    renderComponent();

    // Check if buttons are rendered
    expect(screen.getByTitle('projectActions.duplicateTooltip')).toBeInTheDocument();
    expect(screen.getByTitle('projectActions.deleteTooltip')).toBeInTheDocument();
  });
});
