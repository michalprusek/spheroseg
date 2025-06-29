/**
 * Date and time utility functions
 * 
 * This module provides centralized date formatting utilities for the application.
 * All date formatting should use these functions for consistency.
 */

/**
 * Default date formats used across the application
 */
export const DATE_FORMATS = {
  DATE_ONLY: { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  } as const,
  DATE_LONG: { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  } as const,
  TIME_ONLY: { 
    hour: 'numeric', 
    minute: 'numeric' 
  } as const,
  TIME_WITH_SECONDS: { 
    hour: 'numeric', 
    minute: 'numeric',
    second: 'numeric'
  } as const,
  DATE_TIME: { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: 'numeric' 
  } as const,
  FULL_DATE_TIME: { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: 'numeric',
    second: 'numeric'
  } as const,
} as const;

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
 * @param formatType The format type to use ('date', 'time', 'datetime', 'relative', 'iso')
 * @param fallback Fallback string to return if date is invalid
 * @returns Formatted date string or fallback value
 */
export function safeFormatDate(
  date: string | Date | undefined | null,
  formatType: 'date' | 'time' | 'datetime' | 'relative' | 'iso' | 'date-long' = 'date-long',
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

    // Format based on type
    switch (formatType) {
      case 'time':
        return formatTime(dateObj);
      case 'datetime':
        return formatDateTime(dateObj);
      case 'relative':
        return formatRelativeTime(dateObj);
      case 'iso':
        return formatISODate(dateObj);
      case 'date':
        return formatDate(dateObj);
      case 'date-long':
      default:
        return formatDate(dateObj, DATE_FORMATS.DATE_LONG);
    }
  } catch (error) {
    console.warn('Error safely formatting date:', error);
    return fallback;
  }
}

/**
 * Format a time with seconds using locale-specific formatting
 * @param date - The date to format
 * @returns Formatted time string with seconds
 */
export function formatTimeWithSeconds(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString(undefined, DATE_FORMATS.TIME_WITH_SECONDS);
}

/**
 * Formats a date as ISO string (yyyy-mm-dd)
 * @param date - The date to format
 * @returns ISO date string
 */
export function formatISODate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}

/**
 * Formats a date as full ISO string
 * @param date - The date to format
 * @returns Full ISO string
 */
export function formatISODateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString();
}

/**
 * Checks if a date is valid
 * @param date - The date to check
 * @returns True if the date is valid
 */
export function isValidDate(date: string | Date | undefined | null): boolean {
  if (!date) return false;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return !isNaN(dateObj.getTime());
  } catch {
    return false;
  }
}

/**
 * Gets the difference between two dates in various units
 * @param date1 - First date
 * @param date2 - Second date (defaults to now)
 * @returns Object with differences in various units
 */
export function getDateDifference(date1: string | Date, date2: string | Date = new Date()) {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  const diffInMs = Math.abs(d2.getTime() - d1.getTime());
  
  return {
    milliseconds: diffInMs,
    seconds: Math.floor(diffInMs / 1000),
    minutes: Math.floor(diffInMs / (1000 * 60)),
    hours: Math.floor(diffInMs / (1000 * 60 * 60)),
    days: Math.floor(diffInMs / (1000 * 60 * 60 * 24)),
    weeks: Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7)),
    months: Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30)),
    years: Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365)),
  };
}

/**
 * Adds a specified amount of time to a date
 * @param date - The base date
 * @param amount - Amount to add
 * @param unit - Unit of time ('days', 'hours', 'minutes', 'seconds')
 * @returns New date with added time
 */
export function addToDate(
  date: string | Date, 
  amount: number, 
  unit: 'days' | 'hours' | 'minutes' | 'seconds'
): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
  
  switch (unit) {
    case 'days':
      dateObj.setDate(dateObj.getDate() + amount);
      break;
    case 'hours':
      dateObj.setHours(dateObj.getHours() + amount);
      break;
    case 'minutes':
      dateObj.setMinutes(dateObj.getMinutes() + amount);
      break;
    case 'seconds':
      dateObj.setSeconds(dateObj.getSeconds() + amount);
      break;
  }
  
  return dateObj;
}

export default {
  formatRelativeTime,
  formatDate,
  formatTime,
  formatDateTime,
  formatTimeWithSeconds,
  formatISODate,
  formatISODateTime,
  safeFormatDate,
  isValidDate,
  getDateDifference,
  addToDate,
  DATE_FORMATS,
};
