/**
 * Frontend Date Service
 * 
 * Integration of the unified date utilities for frontend use.
 * Provides locale-aware date formatting with user preferences.
 */

import {
  formatDate,
  formatRelativeTime,
  formatTimeAgo,
  safeFormatDate,
  parseDate,
  isValidDate,
  getDisplayDate,
  getDisplayTime,
  getDisplayDateTime,
  formatForAPI,
  formatForFileName,
  formatDateRange,
  getDateDifference,
  addTime,
  subtractTime,
  DATE_FORMATS,
  FORMAT_PRESETS,
  type DateInput,
  type FormatOptions,
  type TimeUnit,
  type FormatStyle,
} from '@spheroseg/shared/utils/dateUtils.unified';

import {
  getDateLocale,
  getLocaleMetadata,
  getBrowserLocale,
  getFormatOptions,
  type Locale,
} from '@spheroseg/shared/utils/dateLocales';

// Service configuration
interface DateServiceConfig {
  locale?: string;
  use24HourTime?: boolean;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  timezone?: string;
}

class DateService {
  private config: DateServiceConfig = {
    locale: getBrowserLocale(),
    use24HourTime: false,
    weekStartsOn: 0, // Sunday
  };

  /**
   * Initialize the service with user preferences
   */
  initialize(config: Partial<DateServiceConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update weekStartsOn based on locale if not explicitly set
    if (config.locale && !config.weekStartsOn) {
      const metadata = getLocaleMetadata(config.locale);
      this.config.weekStartsOn = metadata.firstDayOfWeek;
    }
  }

  /**
   * Update locale
   */
  setLocale(locale: string): void {
    this.config.locale = locale;
    const metadata = getLocaleMetadata(locale);
    this.config.weekStartsOn = metadata.firstDayOfWeek;
  }

  /**
   * Get current locale
   */
  getLocale(): string {
    return this.config.locale || getBrowserLocale();
  }

  /**
   * Get format options with current locale
   */
  private getOptions(overrides?: FormatOptions): FormatOptions {
    return {
      ...getFormatOptions(this.config.locale),
      weekStartsOn: this.config.weekStartsOn,
      ...overrides,
    };
  }

  /**
   * Format date with current locale
   */
  format(
    date: DateInput,
    pattern: string = DATE_FORMATS.DATE_MEDIUM
  ): string {
    return formatDate(date, pattern, this.getOptions());
  }

  /**
   * Format relative time with current locale
   */
  formatRelative(
    date: DateInput,
    baseDate?: DateInput
  ): string {
    return formatRelativeTime(date, baseDate, this.getOptions({ addSuffix: true }));
  }

  /**
   * Format time ago from now
   */
  formatAgo(date: DateInput): string {
    return formatTimeAgo(date, this.getOptions({ addSuffix: true }));
  }

  /**
   * Safe format with fallback
   */
  safeFormat(
    date: DateInput,
    pattern?: string,
    fallback: string = '-'
  ): string {
    return safeFormatDate(date, pattern, fallback, this.getOptions());
  }

  /**
   * Parse date string
   */
  parse(dateString: string, formats?: string[]): Date | null {
    return parseDate(dateString, formats, this.getOptions());
  }

  /**
   * Display formatters
   */
  displayDate(date: DateInput, style: FormatStyle = 'medium'): string {
    return getDisplayDate(date, style, this.getOptions());
  }

  displayTime(date: DateInput, style: FormatStyle = 'short'): string {
    return getDisplayTime(date, style, this.config.use24HourTime || false, this.getOptions());
  }

  displayDateTime(date: DateInput, style: FormatStyle = 'medium'): string {
    return getDisplayDateTime(date, style, this.getOptions());
  }

  /**
   * Special formatters
   */
  forAPI(date: DateInput): string {
    return formatForAPI(date);
  }

  forFileName(date: DateInput, includeTime: boolean = false): string {
    return formatForFileName(date, includeTime);
  }

  formatRange(startDate: DateInput, endDate: DateInput): string {
    return formatDateRange(startDate, endDate, this.getOptions());
  }

  /**
   * Get smart display format based on date distance
   */
  smartFormat(date: DateInput): string {
    const normalized = new Date(date as any);
    if (!isValidDate(normalized)) return '-';

    const now = new Date();
    const diff = getDateDifference(normalized, now);
    
    if (!diff) return '-';

    // Today: show time only
    if (diff.days === 0) {
      return this.displayTime(normalized, 'short');
    }

    // This week: show day and time
    if (diff.days < 7) {
      return this.format(normalized, 'EEEE, h:mm a');
    }

    // This year: show month and day
    if (diff.years === 0) {
      return this.format(normalized, 'MMM d');
    }

    // Older: show full date
    return this.displayDate(normalized, 'medium');
  }

  /**
   * Format for specific contexts
   */
  formatForTable(date: DateInput): string {
    return this.format(date, this.config.use24HourTime 
      ? 'MM/dd/yyyy HH:mm' 
      : 'MM/dd/yyyy h:mm a'
    );
  }

  formatForForm(date: DateInput): string {
    return this.format(date, FORMAT_PRESETS.form.date);
  }

  formatForTimestamp(date: DateInput): string {
    return this.format(date, FORMAT_PRESETS.file.timestamp);
  }

  /**
   * Utility methods
   */
  isValid(date: DateInput): boolean {
    return isValidDate(date);
  }

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
   * Get locale-specific format patterns
   */
  getLocalizedFormats() {
    const metadata = getLocaleMetadata(this.config.locale);
    return {
      date: metadata.dateFormat,
      time: metadata.timeFormat,
      dateTime: `${metadata.dateFormat} ${metadata.timeFormat}`,
    };
  }

  /**
   * Get all available format presets
   */
  getFormatPresets() {
    return FORMAT_PRESETS;
  }

  /**
   * Get all date format constants
   */
  getDateFormats() {
    return DATE_FORMATS;
  }
}

// Create and export singleton instance
export const dateService = new DateService();

// Export types for convenience
export type {
  DateInput,
  FormatOptions,
  TimeUnit,
  FormatStyle,
} from '@spheroseg/shared/utils/dateUtils.unified';

// Export commonly used functions directly
export {
  isValidDate,
  parseDate,
  formatForAPI,
} from '@spheroseg/shared/utils/dateUtils.unified';

// Export constants
export { DATE_FORMATS, FORMAT_PRESETS } from '@spheroseg/shared/utils/dateUtils.unified';

export default dateService;