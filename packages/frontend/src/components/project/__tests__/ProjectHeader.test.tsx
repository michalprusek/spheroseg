import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectHeader from '../ProjectHeader';
import '@testing-library/jest-dom';

// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the DashboardHeader component
vi.mock('@/components/DashboardHeader', () => ({
  default: () => <div data-testid="dashboard-header">Dashboard Header</div>,
}));

// Mock the SegmentationProgress component
vi.mock('../SegmentationProgress', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <div data-testid="segmentation-progress">
      Segmentation Progress for project {projectId}
    </div>
  ),
}));

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.back': 'Back',
        'common.loading': 'Loading...',
        'common.images': 'Images',
      };
      return translations[key] || key;
    },
  }),
}));

describe('ProjectHeader Component', () => {
  const mockProps = {
    projectTitle: 'Test Project',
    imagesCount: 10,
    loading: false,
    projectId: 'project-123',
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders the project header with title and image count', () => {
    render(<ProjectHeader {...mockProps} />);
    
    // Check if the dashboard header is rendered
    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
    
    // Check if the project title is displayed
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    
    // Check if the image count is displayed
    expect(screen.getByText('10 images')).toBeInTheDocument();
    
    // Check if the back button is rendered
    expect(screen.getByText('Back')).toBeInTheDocument();
    
    // Check if the segmentation progress component is rendered
    expect(screen.getByTestId('segmentation-progress')).toBeInTheDocument();
    expect(screen.getByText('Segmentation Progress for project project-123')).toBeInTheDocument();
  });
  
  it('displays loading state when loading is true', () => {
    render(<ProjectHeader {...mockProps} loading={true} />);
    
    // Check if the loading text is displayed instead of image count
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('10 images')).not.toBeInTheDocument();
  });
  
  it('navigates back to dashboard when back button is clicked', () => {
    render(<ProjectHeader {...mockProps} />);
    
    // Click the back button
    fireEvent.click(screen.getByText('Back'));
    
    // Check if navigate was called with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
  
  it('renders with zero images', () => {
    render(<ProjectHeader {...mockProps} imagesCount={0} />);
    
    // Check if the image count shows zero
    expect(screen.getByText('0 images')).toBeInTheDocument();
  });
});
