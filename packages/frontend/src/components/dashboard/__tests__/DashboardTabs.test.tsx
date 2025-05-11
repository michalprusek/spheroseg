import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import DashboardTabs from '../DashboardTabs';

// Mock dependencies
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      // Simple mock translation function
      const translations: Record<string, string> = {
        'common.projects': 'Projects',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the ProjectToolbar component
vi.mock('@/components/project/ProjectToolbar', () => ({
  default: vi.fn().mockImplementation((props) => (
    <div data-testid="project-toolbar" data-props={JSON.stringify(props)}>
      ProjectToolbar Mock
    </div>
  )),
}));

describe('DashboardTabs Component', () => {
  // Define default props for testing
  const defaultProps = {
    viewMode: 'grid' as const,
    setViewMode: vi.fn(),
    onSort: vi.fn(),
    sortField: 'name' as const,
    sortDirection: 'asc' as const,
    children: <div data-testid="dashboard-content">Dashboard Content</div>,
  };

  it('renders correctly with default props', () => {
    render(<DashboardTabs {...defaultProps} />);

    // Check that the heading is rendered
    const heading = screen.getByText('Projects');
    expect(heading).toBeInTheDocument();

    // Check that the project toolbar is rendered
    const toolbar = screen.getByTestId('project-toolbar');
    expect(toolbar).toBeInTheDocument();

    // Check that children are rendered
    const content = screen.getByTestId('dashboard-content');
    expect(content).toBeInTheDocument();
  });

  it('passes the correct props to ProjectToolbar', () => {
    render(<DashboardTabs {...defaultProps} />);

    const toolbar = screen.getByTestId('project-toolbar');
    const toolbarProps = JSON.parse(toolbar.getAttribute('data-props') || '{}');

    // Check that props are passed correctly
    expect(toolbarProps.viewMode).toBe('grid');
    expect(toolbarProps.sortField).toBe('name');
    expect(toolbarProps.sortDirection).toBe('asc');
    expect(toolbarProps.showSearchBar).toBe(false);
    expect(toolbarProps.showUploadButton).toBe(false);
    expect(toolbarProps.showExportButton).toBe(false);
  });

  it('renders with list view mode', () => {
    const listViewProps = {
      ...defaultProps,
      viewMode: 'list' as const,
    };

    render(<DashboardTabs {...listViewProps} />);

    const toolbar = screen.getByTestId('project-toolbar');
    const toolbarProps = JSON.parse(toolbar.getAttribute('data-props') || '{}');

    expect(toolbarProps.viewMode).toBe('list');
  });
});
