import React, { useEffect, useState } from 'react';

interface ScreenReaderAnnouncementProps {
  message: string;
  assertive?: boolean;
  clearAfter?: number; // Time in ms after which to clear the message
}

/**
 * Component for announcing messages to screen readers
 * Uses ARIA live regions to make dynamic content accessible
 */
const ScreenReaderAnnouncement: React.FC<ScreenReaderAnnouncementProps> = ({
  message,
  assertive = false,
  clearAfter = 5000,
}) => {
  const [announcement, setAnnouncement] = useState(message);

  useEffect(() => {
    // Update the announcement when the message changes
    setAnnouncement(message);

    // Clear the announcement after the specified time
    if (clearAfter > 0 && message) {
      const timer = setTimeout(() => {
        setAnnouncement('');
      }, clearAfter);

      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      className="sr-only"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid="screen-reader-announcement"
    >
      {announcement}
    </div>
  );
};

export default ScreenReaderAnnouncement;
