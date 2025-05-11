import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectCard from '../ProjectCard';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock ProjectActions component
vi.mock('@/components/project/ProjectActions', () => ({
  default: ({ onDelete }: { onDelete: () => void }) => (
    <div data-testid="project-actions">
      <button onClick={onDelete} data-testid="mock-delete-button">
        Delete
      </button>
    </div>
  ),
}));

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
    token: 'test-token',
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the LanguageContext
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: (key: string) => key,
    availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ProjectCard', () => {
  const mockProps = {
    id: 'test-project-id',
    title: 'Test Project',
    description: 'Test Description',
    thumbnailUrl: null,
    date: '2 days ago',
    imageCount: 5,
    onClick: vi.fn(),
    projectName: 'Test Project',
    onDelete: vi.fn(),
  };

  const renderComponent = (props = mockProps) => {
    return render(
      <BrowserRouter>
        <ProjectCard {...props} />
      </BrowserRouter>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project information correctly', () => {
    renderComponent();

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
    expect(screen.getByText('5 images')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    renderComponent();

    fireEvent.click(screen.getByText('Test Project'));

    expect(mockProps.onClick).toHaveBeenCalled();
  });

  it('passes correct props to ProjectActions', () => {
    renderComponent();

    expect(screen.getByTestId('project-actions')).toBeInTheDocument();

    // Test that delete callback works
    fireEvent.click(screen.getByTestId('mock-delete-button'));
    expect(mockProps.onDelete).toHaveBeenCalled();
  });
});
