# Date Utilities Consolidation

## Overview

This document details the consolidation of date formatting and manipulation utilities across the application.

## Problem Statement

The application had:
- Multiple approaches to date formatting (native JS methods vs date-fns)
- Direct use of `toLocaleString()`, `toLocaleTimeString()` in components
- Inconsistent date formatting patterns
- date-fns library installed but only used in one file
- No centralized date manipulation utilities

## Solution

Enhanced the existing `dateUtils.ts` module to provide:
1. **Centralized formatting functions** with consistent API
2. **Predefined format constants** for common patterns
3. **Additional utility functions** for date manipulation
4. **Type-safe implementations** with proper error handling

## Architecture

### Date Formatting Functions

```typescript
// Core formatting functions
formatDate(date, options?)          // Localized date
formatTime(date, options?)          // Localized time
formatDateTime(date, options?)      // Localized date & time
formatRelativeTime(date)            // "5 minutes ago"
formatTimeWithSeconds(date)         // Time with seconds
formatISODate(date)                 // yyyy-mm-dd
formatISODateTime(date)             // Full ISO string

// Safe formatting with fallback
safeFormatDate(date, formatType?, fallback?)
```

### Predefined Formats

```typescript
DATE_FORMATS = {
  DATE_ONLY: { year: 'numeric', month: 'short', day: 'numeric' },
  DATE_LONG: { year: 'numeric', month: 'long', day: 'numeric' },
  TIME_ONLY: { hour: 'numeric', minute: 'numeric' },
  TIME_WITH_SECONDS: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
  DATE_TIME: { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' },
  FULL_DATE_TIME: { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }
}
```

### Utility Functions

```typescript
// Validation
isValidDate(date)                   // Check if date is valid

// Date math
getDateDifference(date1, date2?)    // Get difference in various units
addToDate(date, amount, unit)       // Add time to date
```

## Usage Examples

### Basic Formatting

```typescript
import { formatDate, formatTime, formatRelativeTime } from '@/utils/dateUtils';

// Format dates
formatDate(new Date())              // "Nov 29, 2025"
formatTime(new Date())              // "3:45 PM"
formatRelativeTime(date)            // "5 minutes ago"
```

### Safe Formatting

```typescript
import { safeFormatDate } from '@/utils/dateUtils';

// Handle potentially invalid dates
safeFormatDate(image.createdAt, 'date', 'No date')
safeFormatDate(timestamp, 'time', '-')
safeFormatDate(lastUpdate, 'relative', 'Never')
```

### Date Calculations

```typescript
import { getDateDifference, addToDate } from '@/utils/dateUtils';

// Get time elapsed
const diff = getDateDifference(startDate, endDate);
console.log(`${diff.hours} hours elapsed`);

// Add time
const tomorrow = addToDate(new Date(), 1, 'days');
const nextHour = addToDate(new Date(), 1, 'hours');
```

## Migration Status

### Completed Updates

1. **SegmentationQueueIndicator.tsx**
   - Replaced `toLocaleTimeString()` with `formatTime()`
   - Lines 361, 378

2. **Enhanced dateUtils.ts**
   - Added predefined format constants
   - Added utility functions for date manipulation
   - Improved `safeFormatDate` with format types
   - Added ISO date formatting

### Pending Migrations

1. **Replace date-fns usage**
   - `/pages/export/hooks/useExportFunctions.ts` uses `format` from date-fns
   - Should migrate to use our centralized utilities

2. **Direct date formatting in components**
   - Search and replace remaining `toLocaleString()` calls
   - Ensure all date formatting uses centralized utilities

## Benefits Achieved

1. **Consistency**: All date formatting follows same patterns
2. **Localization**: Automatic locale support via Intl API
3. **Type Safety**: TypeScript types for all functions
4. **Error Handling**: Safe formatting with fallbacks
5. **Performance**: No external library overhead (except date-fns)
6. **Maintainability**: Single source of truth for date logic

## Recommendations

1. **Remove date-fns dependency**
   - The native Intl API provides sufficient functionality
   - Our utilities cover all current use cases
   - Would reduce bundle size

2. **Add more format presets**
   - Add common formats like "MMM DD" or "YYYY-MM-DD"
   - Consider adding format for file names

3. **Internationalization**
   - Integrate with i18n system for format preferences
   - Allow users to select date format preferences

4. **Testing**
   - Add comprehensive unit tests for all utilities
   - Test edge cases (invalid dates, timezones)

## Future Improvements

1. **Timezone Support**
   - Add timezone conversion utilities
   - Display times in user's local timezone

2. **Custom Format Strings**
   - Support format strings like "YYYY-MM-DD HH:mm"
   - Build a simple format parser

3. **Business Logic**
   - Add business day calculations
   - Add holiday support

4. **Caching**
   - Cache formatted strings for performance
   - Especially useful for relative time updates