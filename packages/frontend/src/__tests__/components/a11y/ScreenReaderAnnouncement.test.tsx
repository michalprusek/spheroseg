import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ScreenReaderAnnouncement } from '@/components/a11y';

// Mock timers for testing clearAfter functionality
vi.useFakeTimers();

describe('ScreenReaderAnnouncement', () => {
  it('renders with the provided message', () => {
    render(<ScreenReaderAnnouncement message="Test announcement" />);

    const announcement = screen.getByTestId('screen-reader-announcement');
    expect(announcement).toBeInTheDocument();
    expect(announcement).toHaveTextContent('Test announcement');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    expect(announcement).toHaveAttribute('aria-atomic', 'true');
    expect(announcement).toHaveClass('sr-only');
  });

  it('renders with assertive politeness when specified', () => {
    render(<ScreenReaderAnnouncement message="Important announcement" assertive={true} />);

    const announcement = screen.getByTestId('screen-reader-announcement');
    expect(announcement).toHaveAttribute('aria-live', 'assertive');
  });

  it('clears the message after the specified time', () => {
    render(<ScreenReaderAnnouncement message="This will clear" clearAfter={1000} />);

    const announcement = screen.getByTestId('screen-reader-announcement');
    expect(announcement).toHaveTextContent('This will clear');

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Message should be cleared
    expect(announcement).toHaveTextContent('');
  });

  it('updates the message when props change', () => {
    const { rerender } = render(<ScreenReaderAnnouncement message="Initial message" />);

    const announcement = screen.getByTestId('screen-reader-announcement');
    expect(announcement).toHaveTextContent('Initial message');

    // Update the message
    rerender(<ScreenReaderAnnouncement message="Updated message" />);
    expect(announcement).toHaveTextContent('Updated message');
  });

  it('does not clear the message if clearAfter is 0', () => {
    render(<ScreenReaderAnnouncement message="This will not clear" clearAfter={0} />);

    const announcement = screen.getByTestId('screen-reader-announcement');

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Message should still be there
    expect(announcement).toHaveTextContent('This will not clear');
  });
});
