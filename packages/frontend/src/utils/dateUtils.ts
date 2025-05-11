/**
 * Date and time utility functions
 */

/**
 * Format a date string or object to a relative time string (e.g., "5 minutes ago")
 *
 * @param date Date string or Date object
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const pastDate = typeof date === 'string' ? new Date(date) : date;

  // Calculate time difference in milliseconds
  const diff = now.getTime() - pastDate.getTime();

  // Convert to seconds
  const seconds = Math.floor(diff / 1000);

  // Less than a minute
  if (seconds < 60) {
    return 'just now';
  }

  // Minutes
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }

  // Hours
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  // Days
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }

  // Months
  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  // Years
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Format a date string or object to a localized date string
 *
 * @param date Date string or Date object
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString(undefined, options);
}

/**
 * Format a date string or object to a localized time string
 *
 * @param date Date string or Date object
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted time string
 */
export function formatTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
  },
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString(undefined, options);
}

/**
 * Format a date string or object to a localized date and time string
 *
 * @param date Date string or Date object
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date and time string
 */
export function formatDateTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  },
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString(undefined, options);
}

/**
 * Safely format a date using simple formatting
 * This function handles all edge cases and invalid dates
 *
 * @param date Date string, Date object, or undefined/null
 * @param formatStr Format string (not used in this implementation)
 * @param fallback Fallback string to return if date is invalid
 * @returns Formatted date string or fallback value
 */
export function safeFormatDate(
  date: string | Date | undefined | null,
  formatStr: string = 'PPP',
  fallback: string = '',
): string {
  try {
    // Handle undefined or null
    if (!date) {
      return fallback;
    }

    // Convert to Date object if it's a string
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Check if date is valid
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return fallback;
    }

    // Use built-in date formatting instead of date-fns
    // This avoids the require() issue in browser context
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    return dateObj.toLocaleDateString(undefined, options);
  } catch (error) {
    console.warn('Error safely formatting date:', error);
    return fallback;
  }
}

export default {
  formatRelativeTime,
  formatDate,
  formatTime,
  formatDateTime,
  safeFormatDate,
};
