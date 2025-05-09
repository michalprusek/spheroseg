import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationSection from '../NotificationSection';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: (key: string) => {
      const translations = {
        'settings.notificationSettingsSaved': 'Notification settings saved successfully',
        'settings.emailNotifications': 'Email Notifications',
        'settings.notifications.projectUpdates': 'Project Updates',
        'settings.notifications.receiveProjectUpdates': 'Receive updates on your projects',
        'settings.notifications.segmentationResults': 'Segmentation Results',
        'settings.notifications.receiveSegmentationResults': 'Receive notifications when segmentation completes',
        'settings.notifications.newsletterUpdates': 'Newsletter & Updates',
        'settings.notifications.receiveNewsletterUpdates': 'Receive occasional updates and newsletters',
        'settings.inAppNotifications': 'In-App Notifications',
        'settings.notifications.collaborationRequests': 'Collaboration Requests',
        'settings.notifications.receiveCollaborationRequests': 'Get notified about new collaboration requests',
        'settings.notifications.commentsMentions': 'Comments & Mentions',
        'settings.notifications.receiveCommentsMentions': 'Receive notifications about comments and mentions',
        'settings.savePreferences': 'Save Preferences',
      };
      return translations[key] || key;
    },
  })),
}));

describe('NotificationSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notification settings form with all switches', () => {
    render(<NotificationSection />);
    
    // Check for section headings
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    expect(screen.getByText('In-App Notifications')).toBeInTheDocument();
    
    // Check for all switch inputs (6 in total)
    expect(screen.getByLabelText('Project Updates')).toBeInTheDocument();
    expect(screen.getByLabelText('Segmentation Results')).toBeInTheDocument();
    expect(screen.getByLabelText('Newsletter & Updates')).toBeInTheDocument();
    expect(screen.getByLabelText('Collaboration Requests')).toBeInTheDocument();
    expect(screen.getByLabelText('Comments & Mentions')).toBeInTheDocument();
    
    // Check for save button
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeInTheDocument();
  });

  it('has default checked state for switches', () => {
    render(<NotificationSection />);
    
    // Email notification switches
    expect(screen.getByLabelText('Project Updates')).toBeChecked();
    expect(screen.getByLabelText('Segmentation Results')).toBeChecked();
    expect(screen.getByLabelText('Newsletter & Updates')).not.toBeChecked();
    
    // In-app notification switches
    expect(screen.getByLabelText('Collaboration Requests')).toBeChecked();
    expect(screen.getByLabelText('Comments & Mentions')).toBeChecked();
  });

  it('shows success toast when form is submitted', () => {
    render(<NotificationSection />);
    
    // Submit the form
    const saveButton = screen.getByRole('button', { name: 'Save Preferences' });
    fireEvent.click(saveButton);
    
    // Check if success toast was displayed
    expect(toast.success).toHaveBeenCalledWith('Notification settings saved successfully');
  });

  it('handles form submission and prevents default', () => {
    render(<NotificationSection />);
    
    // Create a mock event with preventDefault
    const mockEvent = {
      preventDefault: vi.fn(),
    };
    
    // Get the form and simulate submission
    const form = screen.getByRole('form');
    fireEvent.submit(form, mockEvent);
    
    // Check if preventDefault was called
    expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
    
    // Check if success toast was displayed
    expect(toast.success).toHaveBeenCalledWith('Notification settings saved successfully');
  });

  it('allows toggling notification preferences', () => {
    render(<NotificationSection />);
    
    // Toggle some switches
    const newsletterSwitch = screen.getByLabelText('Newsletter & Updates');
    const projectUpdatesSwitch = screen.getByLabelText('Project Updates');
    
    // Initially newsletter is unchecked and project updates is checked
    expect(newsletterSwitch).not.toBeChecked();
    expect(projectUpdatesSwitch).toBeChecked();
    
    // Toggle them
    fireEvent.click(newsletterSwitch);
    fireEvent.click(projectUpdatesSwitch);
    
    // Now newsletter should be checked and project updates unchecked
    expect(newsletterSwitch).toBeChecked();
    expect(projectUpdatesSwitch).not.toBeChecked();
  });
});