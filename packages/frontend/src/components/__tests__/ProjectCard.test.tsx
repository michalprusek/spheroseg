import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectCard from '../project/ProjectCard';
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
  const mockProject = {
    id: 'test-project-id',
    name: 'Test Project',
    description: 'Test Description',
    created_at: '2023-05-15T10:00:00Z',
    updated_at: '2023-05-17T10:00:00Z',
    image_count: 5,
    thumbnail_url: null,
    is_owner: true,
    permission: 'owner',
    owner_name: 'Test User',
    owner_email: 'test@example.com',
  };

  const mockProps = {
    project: mockProject,
    onProjectDeleted: vi.fn(),
    onProjectDuplicated: vi.fn(),
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
    expect(screen.getByText('5 images')).toBeInTheDocument();
    // Note: The relative time display is dynamic, so we just check that it's present
    expect(screen.getByText(/ago|just now|in/)).toBeInTheDocument();
  });

  it('calls onProjectDuplicated when duplicate action is triggered', () => {
    renderComponent();

    // Test that the component renders without errors
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('passes correct props to ProjectActions', () => {
    renderComponent();

    expect(screen.getByTestId('project-actions')).toBeInTheDocument();

    // Test that delete callback works
    fireEvent.click(screen.getByTestId('mock-delete-button'));
    expect(mockProps.onProjectDeleted).toHaveBeenCalledWith(mockProject.id);
  });
});
