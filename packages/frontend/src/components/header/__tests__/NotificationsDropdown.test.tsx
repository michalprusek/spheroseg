import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationsDropdown from '../NotificationsDropdown';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard' }),
}));

describe('NotificationsDropdown Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the bell icon', () => {
    render(<NotificationsDropdown hasNotifications={false} />);

    // Bell icon should be present (as part of the button)
    const bellButton = screen.getByRole('button');
    expect(bellButton).toBeInTheDocument();
  });

  it('displays notification indicator when hasNotifications is true', () => {
    render(<NotificationsDropdown hasNotifications={true} />);

    // Look for the notification indicator (the red dot)
    const notificationIndicator = screen.getByTestId('notification-indicator'); // Add data-testid in the component
    expect(notificationIndicator).toBeInTheDocument();
    expect(notificationIndicator).toHaveClass('bg-red-500');
  });

  it('does not display notification indicator when hasNotifications is false', () => {
    render(<NotificationsDropdown hasNotifications={false} />);

    // Notification indicator should not be present
    const notificationIndicator = screen.queryByTestId('notification-indicator');
    expect(notificationIndicator).not.toBeInTheDocument();
  });

  it('navigates to settings page with notifications tab when clicked', () => {
    render(<NotificationsDropdown hasNotifications={false} />);

    // Click the bell button
    const bellButton = screen.getByRole('button');
    fireEvent.click(bellButton);

    // Check if navigate was called with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/settings?tab=notifications');
  });

  it('does not navigate when already on settings page', () => {
    // Mock location to be on settings page
    vi.mocked('react-router-dom').useLocation.mockReturnValue({
      pathname: '/settings',
    });

    render(<NotificationsDropdown hasNotifications={false} />);

    // Click the bell button
    const bellButton = screen.getByRole('button');
    fireEvent.click(bellButton);

    // Navigate should not be called
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('has correct styling for the button', () => {
    render(<NotificationsDropdown hasNotifications={false} />);

    const bellButton = screen.getByRole('button');
    expect(bellButton).toHaveClass('relative');
    expect(bellButton).toHaveClass('dark:text-gray-300');
  });
});
