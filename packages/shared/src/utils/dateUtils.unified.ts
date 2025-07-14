/**
 * Unified Date Utilities Module
 * 
 * This module provides a comprehensive set of date utilities standardized on date-fns.
 * It consolidates all date formatting, parsing, and manipulation functionality
 * across both frontend and backend applications.
 * 
 * Features:
 * - Consistent date formatting with locale support
 * - Relative time formatting ("2 hours ago")
 * - Date parsing and validation
 * - Time zone handling
 * - Date arithmetic
 * - ISO format utilities
 * - Safe date handling with error recovery
 */

import {
  format,
  formatRelative,
  formatDistance,
  formatDistanceToNow,
  formatDistanceStrict,
  parse,
  parseISO,
  isValid,
  isDate,
  isBefore,
  isAfter,
  isEqual,
  isFuture,
  isPast,
  isToday,
  isYesterday,
  isTomorrow,
  isThisWeek,
  isThisMonth,
  isThisYear,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  addHours,
  addMinutes,
  addSeconds,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  subHours,
  subMinutes,
  subSeconds,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  differenceInMilliseconds,
  toDate,
  getTime,
  getUnixTime,
  fromUnixTime,
  type Locale,
} from 'date-fns';

// Type definitions
export type DateInput = Date | string | number | null | undefined;
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
export type FormatStyle = 'short' | 'medium' | 'long' | 'full';

export interface DateDifference {
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  weeks: number;
  months: number;
  years: number;
}

export interface FormatOptions {
  locale?: Locale;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  firstWeekContainsDate?: 1 | 4;
  useAdditionalWeekYearTokens?: boolean;
  useAdditionalDayOfYearTokens?: boolean;
}

// Predefined date format patterns
export const DATE_FORMATS = {
  // Date only formats
  DATE_SHORT: 'MM/dd/yyyy', // 01/15/2024
  DATE_MEDIUM: 'MMM d, yyyy', // Jan 15, 2024
  DATE_LONG: 'MMMM d, yyyy', // January 15, 2024
  DATE_FULL: 'EEEE, MMMM d, yyyy', // Monday, January 15, 2024
  DATE_ISO: 'yyyy-MM-dd', // 2024-01-15
  DATE_COMPACT: 'yyyyMMdd', // 20240115
  
  // Time only formats
  TIME_SHORT: 'h:mm a', // 3:30 PM
  TIME_MEDIUM: 'h:mm:ss a', // 3:30:45 PM
  TIME_24H: 'HH:mm', // 15:30
  TIME_24H_SECONDS: 'HH:mm:ss', // 15:30:45
  TIME_ISO: "HH:mm:ss'Z'", // 15:30:45Z
  
  // Date and time formats
  DATETIME_SHORT: 'MM/dd/yyyy h:mm a', // 01/15/2024 3:30 PM
  DATETIME_MEDIUM: 'MMM d, yyyy h:mm a', // Jan 15, 2024 3:30 PM
  DATETIME_LONG: 'MMMM d, yyyy h:mm:ss a', // January 15, 2024 3:30:45 PM
  DATETIME_FULL: 'EEEE, MMMM d, yyyy h:mm:ss a zzzz', // Monday, January 15, 2024 3:30:45 PM Eastern Standard Time
  DATETIME_ISO: "yyyy-MM-dd'T'HH:mm:ss'Z'", // 2024-01-15T15:30:45Z
  
  // Special formats
  MONTH_YEAR: 'MMMM yyyy', // January 2024
  MONTH_DAY: 'MMMM d', // January 15
  YEAR_ONLY: 'yyyy', // 2024
  WEEKDAY: 'EEEE', // Monday
  WEEKDAY_SHORT: 'EEE', // Mon
  
  // File-safe formats
  FILE_DATE: 'yyyy-MM-dd', // 2024-01-15
  FILE_DATETIME: 'yyyy-MM-dd_HH-mm-ss', // 2024-01-15_15-30-45
  FILE_TIMESTAMP: 'yyyyMMdd_HHmmss', // 20240115_153045
} as const;

// Common format presets by use case
export const FORMAT_PRESETS = {
  display: {
    date: DATE_FORMATS.DATE_MEDIUM,
    time: DATE_FORMATS.TIME_SHORT,
    datetime: DATE_FORMATS.DATETIME_MEDIUM,
  },
  form: {
    date: DATE_FORMATS.DATE_SHORT,
    time: DATE_FORMATS.TIME_24H,
    datetime: DATE_FORMATS.DATETIME_SHORT,
  },
  api: {
    date: DATE_FORMATS.DATE_ISO,
    time: DATE_FORMATS.TIME_ISO,
    datetime: DATE_FORMATS.DATETIME_ISO,
  },
  file: {
    date: DATE_FORMATS.FILE_DATE,
    datetime: DATE_FORMATS.FILE_DATETIME,
    timestamp: DATE_FORMATS.FILE_TIMESTAMP,
  },
} as const;

/**
 * Normalize date input to Date object
 */
export function normalizeDate(date: DateInput): Date | null {
  if (!date) return null;
  
  if (isDate(date)) {
    return isValid(date) ? date : null;
  }
  
  if (typeof date === 'string') {
    // Try parsing ISO string first
    const isoDate = parseISO(date);
    if (isValid(isoDate)) return isoDate;
    
    // Try converting directly
    const directDate = new Date(date);
    if (isValid(directDate)) return directDate;
    
    return null;
  }
  
  if (typeof date === 'number') {
    // Assume it's a timestamp
    const timestamp = date > 9999999999 ? fromUnixTime(date / 1000) : fromUnixTime(date);
    return isValid(timestamp) ? timestamp : null;
  }
  
  return null;
}

/**
 * Format a date with fallback handling
 */
export function formatDate(
  date: DateInput,
  pattern: string = DATE_FORMATS.DATE_MEDIUM,
  options?: FormatOptions
): string {
  const normalizedDate = normalizeDate(date);
  if (!normalizedDate) return '';
  
  try {
    return format(normalizedDate, pattern, options);
  } catch (error) {
    console.warn('Error formatting date:', error);
    return '';
  }
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: DateInput,
  baseDate: DateInput = new Date(),
  options?: FormatOptions & { addSuffix?: boolean; includeSeconds?: boolean }
): string {
  const normalizedDate = normalizeDate(date);
  const normalizedBase = normalizeDate(baseDate);
  
  if (!normalizedDate || !normalizedBase) return '';
  
  try {
    // For very recent dates, use custom logic
    const diffInSeconds = differenceInSeconds(normalizedBase, normalizedDate);
    
    if (diffInSeconds < 60 && options?.includeSeconds !== false) {
      return diffInSeconds < 5 ? 'just now' : `${diffInSeconds} seconds ago`;
    }
    
    return formatDistance(normalizedDate, normalizedBase, {
      ...options,
      addSuffix: options?.addSuffix !== false,
    });
  } catch (error) {
    console.warn('Error formatting relative time:', error);
    return '';
  }
}

/**
 * Format a date as relative time from now
 */
export function formatTimeAgo(
  date: DateInput,
  options?: FormatOptions & { addSuffix?: boolean; includeSeconds?: boolean }
): string {
  return formatRelativeTime(date, new Date(), options);
}

/**
 * Safe date formatting with custom fallback
 */
export function safeFormatDate(
  date: DateInput,
  pattern: string = DATE_FORMATS.DATE_MEDIUM,
  fallback: string = '',
  options?: FormatOptions
): string {
  try {
    const formatted = formatDate(date, pattern, options);
    return formatted || fallback;
  } catch (error) {
    console.warn('Safe format date error:', error);
    return fallback;
  }
}

/**
 * Parse a date string with multiple format attempts
 */
export function parseDate(
  dateString: string,
  formats?: string[],
  options?: FormatOptions
): Date | null {
  if (!dateString) return null;
  
  // Default formats to try
  const formatsToTry = formats || [
    DATE_FORMATS.DATE_ISO,
    DATE_FORMATS.DATETIME_ISO,
    DATE_FORMATS.DATE_SHORT,
    DATE_FORMATS.DATE_MEDIUM,
    DATE_FORMATS.DATETIME_SHORT,
    DATE_FORMATS.DATETIME_MEDIUM,
  ];
  
  // Try ISO parse first (most common)
  const isoDate = parseISO(dateString);
  if (isValid(isoDate)) return isoDate;
  
  // Try each format
  for (const formatPattern of formatsToTry) {
    try {
      const parsed = parse(dateString, formatPattern, new Date(), options);
      if (isValid(parsed)) return parsed;
    } catch {
      // Continue to next format
    }
  }
  
  // Try native Date parsing as last resort
  const nativeDate = new Date(dateString);
  return isValid(nativeDate) ? nativeDate : null;
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: DateInput): boolean {
  const normalized = normalizeDate(date);
  return normalized !== null && isValid(normalized);
}

/**
 * Get formatted date for display based on context
 */
export function getDisplayDate(
  date: DateInput,
  style: FormatStyle = 'medium',
  options?: FormatOptions
): string {
  const patterns: Record<FormatStyle, string> = {
    short: DATE_FORMATS.DATE_SHORT,
    medium: DATE_FORMATS.DATE_MEDIUM,
    long: DATE_FORMATS.DATE_LONG,
    full: DATE_FORMATS.DATE_FULL,
  };
  
  return formatDate(date, patterns[style], options);
}

/**
 * Get formatted time for display based on context
 */
export function getDisplayTime(
  date: DateInput,
  style: FormatStyle = 'short',
  use24Hour: boolean = false,
  options?: FormatOptions
): string {
  const patterns: Record<FormatStyle, string> = {
    short: use24Hour ? DATE_FORMATS.TIME_24H : DATE_FORMATS.TIME_SHORT,
    medium: use24Hour ? DATE_FORMATS.TIME_24H_SECONDS : DATE_FORMATS.TIME_MEDIUM,
    long: use24Hour ? DATE_FORMATS.TIME_24H_SECONDS : DATE_FORMATS.TIME_MEDIUM,
    full: use24Hour ? DATE_FORMATS.TIME_24H_SECONDS : DATE_FORMATS.TIME_MEDIUM,
  };
  
  return formatDate(date, patterns[style], options);
}

/**
 * Get formatted datetime for display based on context
 */
export function getDisplayDateTime(
  date: DateInput,
  style: FormatStyle = 'medium',
  options?: FormatOptions
): string {
  const patterns: Record<FormatStyle, string> = {
    short: DATE_FORMATS.DATETIME_SHORT,
    medium: DATE_FORMATS.DATETIME_MEDIUM,
    long: DATE_FORMATS.DATETIME_LONG,
    full: DATE_FORMATS.DATETIME_FULL,
  };
  
  return formatDate(date, patterns[style], options);
}

/**
 * Format date for API communication (ISO format)
 */
export function formatForAPI(date: DateInput): string {
  const normalized = normalizeDate(date);
  return normalized ? normalized.toISOString() : '';
}

/**
 * Format date for file names (safe characters)
 */
export function formatForFileName(
  date: DateInput,
  includeTime: boolean = false
): string {
  const pattern = includeTime ? DATE_FORMATS.FILE_DATETIME : DATE_FORMATS.FILE_DATE;
  return formatDate(date, pattern);
}

/**
 * Get human-readable date range
 */
export function formatDateRange(
  startDate: DateInput,
  endDate: DateInput,
  options?: FormatOptions
): string {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  
  if (!start || !end) return '';
  
  // Same day
  if (isSameDay(start, end)) {
    return formatDate(start, DATE_FORMATS.DATE_MEDIUM, options);
  }
  
  // Same month
  if (isSameMonth(start, end)) {
    return `${formatDate(start, 'MMM d', options)} - ${formatDate(end, 'd, yyyy', options)}`;
  }
  
  // Same year
  if (isSameYear(start, end)) {
    return `${formatDate(start, 'MMM d', options)} - ${formatDate(end, 'MMM d, yyyy', options)}`;
  }
  
  // Different years
  return `${formatDate(start, DATE_FORMATS.DATE_MEDIUM, options)} - ${formatDate(end, DATE_FORMATS.DATE_MEDIUM, options)}`;
}

/**
 * Calculate difference between dates
 */
export function getDateDifference(
  date1: DateInput,
  date2: DateInput = new Date()
): DateDifference | null {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  
  if (!d1 || !d2) return null;
  
  return {
    milliseconds: Math.abs(differenceInMilliseconds(d2, d1)),
    seconds: Math.abs(differenceInSeconds(d2, d1)),
    minutes: Math.abs(differenceInMinutes(d2, d1)),
    hours: Math.abs(differenceInHours(d2, d1)),
    days: Math.abs(differenceInDays(d2, d1)),
    weeks: Math.abs(differenceInWeeks(d2, d1)),
    months: Math.abs(differenceInMonths(d2, d1)),
    years: Math.abs(differenceInYears(d2, d1)),
  };
}

/**
 * Add time to a date
 */
export function addTime(
  date: DateInput,
  amount: number,
  unit: TimeUnit
): Date | null {
  const normalized = normalizeDate(date);
  if (!normalized) return null;
  
  const operations = {
    seconds: addSeconds,
    minutes: addMinutes,
    hours: addHours,
    days: addDays,
    weeks: addWeeks,
    months: addMonths,
    years: addYears,
  };
  
  return operations[unit](normalized, amount);
}

/**
 * Subtract time from a date
 */
export function subtractTime(
  date: DateInput,
  amount: number,
  unit: TimeUnit
): Date | null {
  const normalized = normalizeDate(date);
  if (!normalized) return null;
  
  const operations = {
    seconds: subSeconds,
    minutes: subMinutes,
    hours: subHours,
    days: subDays,
    weeks: subWeeks,
    months: subMonths,
    years: subYears,
  };
  
  return operations[unit](normalized, amount);
}

// Helper functions for common checks
export function isSameDay(date1: DateInput, date2: DateInput): boolean {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  return d1 && d2 ? isEqual(startOfDay(d1), startOfDay(d2)) : false;
}

export function isSameMonth(date1: DateInput, date2: DateInput): boolean {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  return d1 && d2 ? isEqual(startOfMonth(d1), startOfMonth(d2)) : false;
}

export function isSameYear(date1: DateInput, date2: DateInput): boolean {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  return d1 && d2 ? isEqual(startOfYear(d1), startOfYear(d2)) : false;
}

// Re-export commonly used date-fns functions
export {
  isValid,
  isDate,
  isBefore,
  isAfter,
  isEqual,
  isFuture,
  isPast,
  isToday,
  isYesterday,
  isTomorrow,
  isThisWeek,
  isThisMonth,
  isThisYear,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parseISO,
  toDate,
  getTime,
  getUnixTime,
  fromUnixTime,
};

// Default export with all utilities
export default {
  // Core functions
  normalizeDate,
  formatDate,
  formatRelativeTime,
  formatTimeAgo,
  safeFormatDate,
  parseDate,
  isValidDate,
  
  // Display functions
  getDisplayDate,
  getDisplayTime,
  getDisplayDateTime,
  
  // Special format functions
  formatForAPI,
  formatForFileName,
  formatDateRange,
  
  // Date math
  getDateDifference,
  addTime,
  subtractTime,
  
  // Comparison helpers
  isSameDay,
  isSameMonth,
  isSameYear,
  
  // Constants
  DATE_FORMATS,
  FORMAT_PRESETS,
};