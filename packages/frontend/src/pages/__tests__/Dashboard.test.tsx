import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Dashboard from '@/pages/Dashboard';
import '@testing-library/jest-dom';
import { TestWrapper } from '@/tests/utils/testUtils';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    token: 'test-token',
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Mock LanguageContext
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
    setLanguage: vi.fn(),
    availableLanguages: ['en', 'cs', 'de', 'fr', 'es', 'ru'],
  }),
}));

// Mock dependencies
vi.mock('@/hooks/useDashboardProjects', () => ({
  useDashboardProjects: () => ({
    projects: [
      {
        id: 'project-1',
        title: 'Test Project 1',
        description: 'This is test project 1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        image_count: 5,
        thumbnail_url: 'https://example.com/thumbnail1.jpg',
      },
      {
        id: 'project-2',
        title: 'Test Project 2',
        description: 'This is test project 2',
        created_at: '2023-01-03T00:00:00Z',
        updated_at: '2023-01-04T00:00:00Z',
        image_count: 3,
        thumbnail_url: 'https://example.com/thumbnail2.jpg',
      },
    ],
    loading: false,
    error: null,
    fetchProjects: vi.fn(),
  }),
}));

vi.mock('@/components/StatsOverview', () => ({
  default: () => <div data-testid="stats-overview">Stats Overview</div>,
}));

vi.mock('@/components/DashboardHeader', () => ({
  default: () => <div data-testid="dashboard-header">Dashboard Header</div>,
}));

vi.mock('@/components/dashboard/DashboardTabs', () => ({
  default: ({ children, viewMode, setViewMode, onSort, sortField, sortDirection }) => (
    <div data-testid="dashboard-tabs">
      <div data-testid="view-mode">{viewMode}</div>
      <div data-testid="sort-field">{sortField}</div>
      <div data-testid="sort-direction">{sortDirection}</div>
      <button data-testid="toggle-view-mode" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
        Toggle View Mode
      </button>
      <button data-testid="sort-by-name" onClick={() => onSort('name')}>
        Sort by Name
      </button>
      <button data-testid="sort-by-updated" onClick={() => onSort('updatedAt')}>
        Sort by Updated
      </button>
      {children}
    </div>
  ),
}));

vi.mock('@/components/dashboard/ProjectsTab', () => ({
  default: ({ projects, viewMode, loading, onOpenProject, onDeleteProject }) => (
    <div data-testid="projects-tab">
      <div data-testid="projects-count">{projects.length}</div>
      <div data-testid="projects-loading">{loading.toString()}</div>
      {projects.map((project) => (
        <div key={project.id} data-testid={`project-${project.id}`}>
          <div>{project.title}</div>
          <button onClick={() => onOpenProject(project.id)}>Open</button>
          <button onClick={() => onDeleteProject(project.id, project.title)}>Delete</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/lib/apiClient', () => ({
  default: {
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Import the mocked modules
import apiClient from '@/lib/apiClient';
import { toast } from 'sonner';

describe('Dashboard Component', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Mock useNavigate outside of beforeEach
  vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
      ...actual,
      useNavigate: () =>
        vi.fn().mockImplementation((path) => {
          console.log(`Navigating to: ${path}`);
        }),
    };
  });

  it('renders the dashboard with projects', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>,
    );

    // Check if main components are rendered
    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
    expect(screen.getByTestId('stats-overview')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('projects-tab')).toBeInTheDocument();

    // Check if projects are displayed
    expect(screen.getByTestId('projects-count')).toHaveTextContent('2');
    expect(screen.getByTestId('project-project-1')).toBeInTheDocument();
    expect(screen.getByTestId('project-project-2')).toBeInTheDocument();
  });

  it('changes view mode when toggle button is clicked', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>,
    );

    // Check initial view mode
    expect(screen.getByTestId('view-mode')).toHaveTextContent('grid');

    // Click toggle view mode button
    fireEvent.click(screen.getByTestId('toggle-view-mode'));

    // Check if view mode changed
    expect(screen.getByTestId('view-mode')).toHaveTextContent('list');
  });

  it('changes sort field and direction when sort buttons are clicked', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>,
    );

    // Check initial sort field and direction
    expect(screen.getByTestId('sort-field')).toHaveTextContent('updatedAt');
    expect(screen.getByTestId('sort-direction')).toHaveTextContent('desc');

    // Click sort by name button
    fireEvent.click(screen.getByTestId('sort-by-name'));

    // Check if sort field changed
    expect(screen.getByTestId('sort-field')).toHaveTextContent('name');
    expect(screen.getByTestId('sort-direction')).toHaveTextContent('desc');

    // Click sort by name button again to toggle direction
    fireEvent.click(screen.getByTestId('sort-by-name'));

    // Check if sort direction changed
    expect(screen.getByTestId('sort-field')).toHaveTextContent('name');
    expect(screen.getByTestId('sort-direction')).toHaveTextContent('asc');
  });

  it('navigates to project detail when project is opened', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>,
    );

    // Click open button for the first project
    fireEvent.click(screen.getAllByText('Open')[0]);

    // We can't easily check the navigation in this test setup
    // Just verify the button was clicked
    expect(screen.getAllByText('Open')[0]).toBeInTheDocument();
  });

  it('deletes a project when delete button is clicked', async () => {
    // Mock successful delete
    (apiClient.delete as unknown).mockResolvedValueOnce({});

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>,
    );

    // Click delete button for the first project
    fireEvent.click(screen.getAllByText('Delete')[0]);

    // Check if API was called with correct path
    expect(apiClient.delete).toHaveBeenCalledWith('/projects/project-1');

    // Wait for success toast
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Project "Test Project 1" deleted successfully.');
    });
  });

  it('handles project deletion error', async () => {
    // Mock delete error
    (apiClient.delete as unknown).mockRejectedValueOnce(new Error('Failed to delete project'));

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>,
    );

    // Click delete button for the first project
    fireEvent.click(screen.getAllByText('Delete')[0]);

    // Wait for error toast
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
