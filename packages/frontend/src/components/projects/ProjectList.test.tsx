import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@/test-utils';
import { ProjectList } from './ProjectList';
import { server } from '@/test-utils/mocks';
import { rest } from 'msw';
import { testProjects, testApiResponses } from '@/test-utils/fixtures';
import {
  waitForLoadingToFinish,
  expectEmptyState,
  expectListItems,
  selectOption,
  fillForm,
  expectApiCall,
  expectToastNotification,
} from '@/test-utils';

describe('ProjectList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<ProjectList />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders list of projects', async () => {
    const projects = Object.values(testProjects);
    server.use(
      rest.get('/api/projects', (req, res, ctx) => {
        return res(ctx.json(testApiResponses.paginated(projects)));
      })
    );

    render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    // Check each project is displayed
    for (const project of projects) {
      expect(screen.getByText(project.title)).toBeInTheDocument();
      expect(screen.getByText(project.description)).toBeInTheDocument();
    }
  });

  it('renders empty state when no projects', async () => {
    server.use(
      rest.get('/api/projects', (req, res, ctx) => {
        return res(ctx.json(testApiResponses.paginated([])));
      })
    );

    render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    expectEmptyState(undefined, /no projects found/i);
  });

  it('filters projects by search query', async () => {
    const projects = Object.values(testProjects);
    render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    const { user } = render(<ProjectList />);
    const searchInput = screen.getByPlaceholderText(/search projects/i);
    
    await user.type(searchInput, 'cancer');
    
    await waitFor(() => {
      expect(screen.getByText(testProjects.cancerResearch.title)).toBeInTheDocument();
      expect(screen.queryByText(testProjects.stemCells.title)).not.toBeInTheDocument();
      expect(screen.queryByText(testProjects.tutorial.title)).not.toBeInTheDocument();
    });
  });

  it('sorts projects by different criteria', async () => {
    render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    await selectOption(/sort by/i, 'Name (A-Z)');
    
    await waitFor(() => {
      expectApiCall('/api/projects', {
        method: 'GET',
      });
    });
    
    const projectCards = screen.getAllByTestId('project-card');
    const titles = projectCards.map(card => within(card).getByRole('heading').textContent);
    
    // Check alphabetical order
    expect(titles).toEqual([...titles].sort());
  });

  it('creates new project', async () => {
    const { user } = render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    const createButton = screen.getByRole('button', { name: /create project/i });
    await user.click(createButton);
    
    // Fill project form in modal
    await fillForm({
      title: 'New Test Project',
      description: 'Description of test project',
    });
    
    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expectApiCall('/api/projects', {
        method: 'POST',
        body: {
          title: 'New Test Project',
          description: 'Description of test project',
        },
      });
      
      expectToastNotification(/project created successfully/i, 'success');
    });
  });

  it('deletes project with confirmation', async () => {
    const projectToDelete = testProjects.tutorial;
    const { user } = render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    const projectCard = screen.getByText(projectToDelete.title).closest('[data-testid="project-card"]');
    const deleteButton = within(projectCard!).getByRole('button', { name: /delete/i });
    
    await user.click(deleteButton);
    
    // Confirm deletion in dialog
    const confirmDialog = screen.getByRole('dialog');
    expect(within(confirmDialog).getByText(/are you sure/i)).toBeInTheDocument();
    
    const confirmButton = within(confirmDialog).getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    
    await waitFor(() => {
      expectApiCall(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });
      
      expectToastNotification(/project deleted/i, 'success');
      expect(screen.queryByText(projectToDelete.title)).not.toBeInTheDocument();
    });
  });

  it('handles project deletion error', async () => {
    const projectToDelete = testProjects.tutorial;
    server.use(
      rest.delete(`/api/projects/${projectToDelete.id}`, (req, res, ctx) => {
        return res(
          ctx.status(403),
          ctx.json({
            error: 'Forbidden',
            message: 'You do not have permission to delete this project',
          })
        );
      })
    );

    const { user } = render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    const projectCard = screen.getByText(projectToDelete.title).closest('[data-testid="project-card"]');
    const deleteButton = within(projectCard!).getByRole('button', { name: /delete/i });
    
    await user.click(deleteButton);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    
    await waitFor(() => {
      expectToastNotification(/permission to delete/i, 'error');
      expect(screen.getByText(projectToDelete.title)).toBeInTheDocument();
    });
  });

  it('navigates to project details on click', async () => {
    const { user } = render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    const projectCard = screen.getByText(testProjects.cancerResearch.title);
    await user.click(projectCard);
    
    expect(window.location.pathname).toBe(`/projects/${testProjects.cancerResearch.id}`);
  });

  it('displays project statistics', async () => {
    render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    const projectCard = screen.getByText(testProjects.cancerResearch.title).closest('[data-testid="project-card"]');
    
    expect(within(projectCard!).getByText(`${testProjects.cancerResearch.imageCount} images`)).toBeInTheDocument();
    expect(within(projectCard!).getByText(testProjects.cancerResearch.collaborators.length + ' collaborator')).toBeInTheDocument();
  });

  it('filters by project visibility', async () => {
    const { user } = render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    // Filter by public projects
    const visibilityFilter = screen.getByRole('combobox', { name: /visibility/i });
    await user.click(visibilityFilter);
    await user.click(screen.getByRole('option', { name: /public/i }));
    
    await waitFor(() => {
      expect(screen.getByText(testProjects.stemCells.title)).toBeInTheDocument();
      expect(screen.getByText(testProjects.tutorial.title)).toBeInTheDocument();
      expect(screen.queryByText(testProjects.cancerResearch.title)).not.toBeInTheDocument();
    });
  });

  it('paginates through projects', async () => {
    // Mock paginated response
    const allProjects = Array(25).fill(null).map((_, i) => ({
      ...testProjects.tutorial,
      id: `project-${i}`,
      title: `Project ${i + 1}`,
    }));

    server.use(
      rest.get('/api/projects', (req, res, ctx) => {
        const page = parseInt(req.url.searchParams.get('page') || '1');
        const pageSize = 10;
        const start = (page - 1) * pageSize;
        const items = allProjects.slice(start, start + pageSize);
        
        return res(ctx.json(testApiResponses.paginated(items, page, pageSize)));
      })
    );

    const { user } = render(<ProjectList />);
    
    await waitForLoadingToFinish();
    
    // Should show first 10 projects
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 10')).toBeInTheDocument();
    expect(screen.queryByText('Project 11')).not.toBeInTheDocument();
    
    // Go to next page
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Project 1')).not.toBeInTheDocument();
      expect(screen.getByText('Project 11')).toBeInTheDocument();
      expect(screen.getByText('Project 20')).toBeInTheDocument();
    });
  });
});