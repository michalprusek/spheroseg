/**
 * Backend Date Service
 * 
 * Integration of the unified date utilities for backend use.
 * Provides consistent date formatting for API responses, logging, and database operations.
 */

import {
  formatDate,
  formatRelativeTime,
  formatTimeAgo,
  safeFormatDate,
  parseDate,
  isValidDate,
  formatForAPI,
  formatForFileName,
  formatDateRange,
  getDateDifference,
  addTime,
  subtractTime,
  normalizeDate,
  DATE_FORMATS,
  FORMAT_PRESETS,
  type DateInput,
  type FormatOptions,
  type TimeUnit,
} from '@spheroseg/shared/utils/dateUtils.unified';

import {
  getDateLocale,
  defaultLocaleCode,
  getFormatOptions,
} from '@spheroseg/shared/utils/dateLocales';

// Service configuration
interface BackendDateServiceConfig {
  defaultLocale: string;
  defaultTimezone: string;
  databaseDateFormat: string;
  logDateFormat: string;
  apiDateFormat: string;
}

class BackendDateService {
  private config: BackendDateServiceConfig = {
    defaultLocale: process.env.DEFAULT_LOCALE || defaultLocaleCode,
    defaultTimezone: process.env.TZ || 'UTC',
    databaseDateFormat: DATE_FORMATS.DATETIME_ISO,
    logDateFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
    apiDateFormat: DATE_FORMATS.DATETIME_ISO,
  };

  /**
   * Initialize the service
   */
  initialize(config: Partial<BackendDateServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get format options with default locale
   */
  private getOptions(locale?: string, overrides?: FormatOptions): FormatOptions {
    return {
      ...getFormatOptions(locale || this.config.defaultLocale),
      ...overrides,
    };
  }

  /**
   * Format date for API response
   */
  formatForResponse(date: DateInput): string {
    return formatForAPI(date);
  }

  /**
   * Format date for database storage
   */
  formatForDatabase(date: DateInput): string {
    const normalized = normalizeDate(date);
    if (!normalized) return '';
    
    // Always use UTC for database
    return normalized.toISOString();
  }

  /**
   * Format date for logging
   */
  formatForLog(date: DateInput = new Date()): string {
    return formatDate(date, this.config.logDateFormat, this.getOptions());
  }

  /**
   * Format date for file operations
   */
  formatForFile(date: DateInput = new Date(), includeTime: boolean = true): string {
    return formatForFileName(date, includeTime);
  }

  /**
   * Parse date from various sources
   */
  parse(dateString: string, formats?: string[]): Date | null {
    // Common database and API formats
    const commonFormats = [
      DATE_FORMATS.DATETIME_ISO,
      DATE_FORMATS.DATE_ISO,
      'yyyy-MM-dd HH:mm:ss',
      'yyyy-MM-dd HH:mm:ss.SSS',
      ...(formats || []),
    ];
    
    return parseDate(dateString, commonFormats, this.getOptions());
  }

  /**
   * Validate date input
   */
  isValid(date: DateInput): boolean {
    return isValidDate(date);
  }

  /**
   * Parse and validate date with error info
   */
  parseAndValidate(dateString: string): { 
    valid: boolean; 
    date?: Date; 
    error?: string 
  } {
    if (!dateString) {
      return { valid: false, error: 'Date string is empty' };
    }

    const parsed = this.parse(dateString);
    if (!parsed) {
      return { valid: false, error: 'Invalid date format' };
    }

    return { valid: true, date: parsed };
  }

  /**
   * Format timestamp for performance tracking
   */
  formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Get current timestamp in milliseconds
   */
  getCurrentTimestamp(): number {
    return Date.now();
  }

  /**
   * Format duration for logging
   */
  formatDuration(startTime: number, endTime: number = Date.now()): string {
    const duration = endTime - startTime;
    
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(2)}s`;
    } else {
      return `${(duration / 60000).toFixed(2)}m`;
    }
  }

  /**
   * Get date range for queries
   */
  getDateRange(
    period: 'today' | 'week' | 'month' | 'year' | 'custom',
    customStart?: DateInput,
    customEnd?: DateInput
  ): { start: Date; end: Date } | null {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = now;

    switch (period) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        start = subtractTime(now, 7, 'days');
        break;
      case 'month':
        start = subtractTime(now, 1, 'months');
        break;
      case 'year':
        start = subtractTime(now, 1, 'years');
        break;
      case 'custom':
        start = normalizeDate(customStart);
        end = normalizeDate(customEnd) || now;
        break;
    }

    if (!start || !end) return null;
    
    return { start, end };
  }

  /**
   * Format for different locales (for multi-tenant apps)
   */
  formatWithLocale(
    date: DateInput,
    locale: string,
    pattern: string = DATE_FORMATS.DATETIME_MEDIUM
  ): string {
    return formatDate(date, pattern, this.getOptions(locale));
  }

  /**
   * Utility methods
   */
  getDifference(date1: DateInput, date2?: DateInput) {
    return getDateDifference(date1, date2);
  }

  add(date: DateInput, amount: number, unit: TimeUnit): Date | null {
    return addTime(date, amount, unit);
  }

  subtract(date: DateInput, amount: number, unit: TimeUnit): Date | null {
    return subtractTime(date, amount, unit);
  }

  /**
   * Format date for cron expressions
   */
  formatForCron(date: DateInput): {
    minute: number;
    hour: number;
    dayOfMonth: number;
    month: number;
    dayOfWeek: number;
  } | null {
    const normalized = normalizeDate(date);
    if (!normalized) return null;

    return {
      minute: normalized.getMinutes(),
      hour: normalized.getHours(),
      dayOfMonth: normalized.getDate(),
      month: normalized.getMonth() + 1, // cron uses 1-12
      dayOfWeek: normalized.getDay(), // 0-6 (Sunday-Saturday)
    };
  }

  /**
   * Create standardized timestamp object for responses
   */
  createTimestamps(
    createdAt?: DateInput,
    updatedAt?: DateInput
  ): {
    created_at: string;
    updated_at: string;
    created_at_formatted?: string;
    updated_at_formatted?: string;
  } {
    const created = normalizeDate(createdAt) || new Date();
    const updated = normalizeDate(updatedAt) || created;

    return {
      created_at: this.formatForResponse(created),
      updated_at: this.formatForResponse(updated),
      created_at_formatted: this.formatWithLocale(created, this.config.defaultLocale),
      updated_at_formatted: this.formatWithLocale(updated, this.config.defaultLocale),
    };
  }

  /**
   * Get service configuration
   */
  getConfig(): BackendDateServiceConfig {
    return { ...this.config };
  }
}

// Create and export singleton instance
export const dateService = new BackendDateService();

// Export types for convenience
export type {
  DateInput,
  TimeUnit,
} from '@spheroseg/shared/utils/dateUtils.unified';

// Export commonly used functions directly
export {
  isValidDate,
  parseDate,
  formatForAPI,
  normalizeDate,
} from '@spheroseg/shared/utils/dateUtils.unified';

// Export constants
export { DATE_FORMATS, FORMAT_PRESETS } from '@spheroseg/shared/utils/dateUtils.unified';

export default dateService;