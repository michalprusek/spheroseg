# Date Utilities Migration Guide

This guide helps you migrate from the existing date utilities to the new unified date module standardized on date-fns.

## Overview

The new unified date module provides:
- **Consistent API** across frontend and backend
- **Full date-fns integration** with tree-shaken locale support
- **Type safety** with comprehensive TypeScript definitions
- **Locale support** with optimized imports
- **Better performance** with memoization and caching
- **Extended functionality** including timezone support and advanced formatting

## Key Changes

### 1. Library Standardization
- **Old**: Mix of native Date methods and minimal date-fns usage
- **New**: Fully standardized on date-fns with consistent patterns

### 2. Locale Management
- **Old**: Browser's `toLocaleDateString()` with limited control
- **New**: date-fns locales with full customization and tree-shaking

### 3. Error Handling
- **Old**: Try-catch blocks in each function
- **New**: Centralized error handling with safe fallbacks

## Migration Steps

### Frontend Migration

#### Update Imports

```typescript
// Old
import { formatDate, formatRelativeTime, safeFormatDate } from '@/utils/dateUtils';
import { format } from 'date-fns';

// New
import dateService from '@/services/dateService';
// or for direct functions
import { formatDate, formatRelativeTime, safeFormatDate } from '@/services/dateService';
```

#### Update Function Calls

**Basic Formatting**
```typescript
// Old
formatDate(date, { year: 'numeric', month: 'short', day: 'numeric' });

// New
dateService.format(date, 'MMM d, yyyy');
// or use preset
dateService.displayDate(date, 'medium');
```

**Relative Time**
```typescript
// Old
formatRelativeTime(date);

// New
dateService.formatAgo(date);
// or with custom base
dateService.formatRelative(date, baseDate);
```

**Safe Formatting**
```typescript
// Old
safeFormatDate(date, 'date-long', 'N/A');

// New
dateService.safeFormat(date, DATE_FORMATS.DATE_LONG, 'N/A');
```

**Time with Seconds**
```typescript
// Old
formatTimeWithSeconds(date);

// New
dateService.format(date, DATE_FORMATS.TIME_MEDIUM);
// or
dateService.displayTime(date, 'medium');
```

**ISO Formatting**
```typescript
// Old
formatISODate(date);
formatISODateTime(date);

// New
dateService.format(date, DATE_FORMATS.DATE_ISO);
dateService.forAPI(date); // Full ISO string
```

**Date Validation**
```typescript
// Old
isValidDate(date);

// New
dateService.isValid(date);
```

**Date Math**
```typescript
// Old
addToDate(date, 5, 'days');
getDateDifference(date1, date2);

// New
dateService.add(date, 5, 'days');
dateService.getDifference(date1, date2);
```

#### Component Example

```typescript
// Old implementation
import { formatDate, formatRelativeTime } from '@/utils/dateUtils';

function ImageCard({ image }) {
  return (
    <div>
      <span>{formatDate(image.created_at)}</span>
      <span>{formatRelativeTime(image.updated_at)}</span>
    </div>
  );
}

// New implementation
import dateService from '@/services/dateService';

function ImageCard({ image }) {
  return (
    <div>
      <span>{dateService.displayDate(image.created_at)}</span>
      <span>{dateService.formatAgo(image.updated_at)}</span>
    </div>
  );
}
```

### Backend Migration

#### Update Imports

```typescript
// Old
const timestamp = new Date().toISOString();

// New
import dateService from '@/services/dateService';
const timestamp = dateService.formatForResponse(new Date());
```

#### Update API Responses

```typescript
// Old
res.json({
  data: result,
  timestamp: new Date().toISOString(),
});

// New
res.json({
  data: result,
  timestamp: dateService.formatForResponse(new Date()),
});
```

#### Update Database Operations

```typescript
// Old
const created_at = new Date().toISOString();

// New
const created_at = dateService.formatForDatabase(new Date());
```

#### Update Logging

```typescript
// Old
console.log(`[${new Date().toISOString()}] Error occurred`);

// New
console.log(`[${dateService.formatForLog()}] Error occurred`);
```

### Locale Configuration

#### Frontend Setup

```typescript
// In your app initialization
import dateService from '@/services/dateService';
import { useLanguage } from '@/contexts/LanguageContext';

function App() {
  const { language } = useLanguage();
  
  useEffect(() => {
    dateService.initialize({
      locale: language,
      use24HourTime: userPreferences.use24Hour,
    });
  }, [language, userPreferences]);
  
  // ...
}
```

#### Backend Setup

```typescript
// In your server initialization
import dateService from '@/services/dateService';

dateService.initialize({
  defaultLocale: process.env.DEFAULT_LOCALE || 'en-US',
  defaultTimezone: process.env.TZ || 'UTC',
});
```

## Pattern Reference

### Format Patterns

| Old Pattern | New Pattern | Example Output |
|------------|-------------|----------------|
| `{ year: 'numeric', month: 'short', day: 'numeric' }` | `'MMM d, yyyy'` | Jan 15, 2024 |
| `{ hour: 'numeric', minute: 'numeric' }` | `'h:mm a'` | 3:30 PM |
| `{ hour: 'numeric', minute: 'numeric', second: 'numeric' }` | `'h:mm:ss a'` | 3:30:45 PM |
| Custom ISO | `'yyyy-MM-dd'` | 2024-01-15 |

### Common Patterns

```typescript
// Use presets for consistency
const { display, form, api, file } = dateService.getFormatPresets();

// Display formats
dateService.format(date, display.date);     // Jan 15, 2024
dateService.format(date, display.time);     // 3:30 PM
dateService.format(date, display.datetime); // Jan 15, 2024 3:30 PM

// Form formats
dateService.format(date, form.date);     // 01/15/2024
dateService.format(date, form.time);     // 15:30
dateService.format(date, form.datetime); // 01/15/2024 15:30

// API formats
dateService.format(date, api.date);     // 2024-01-15
dateService.format(date, api.datetime); // 2024-01-15T15:30:45Z

// File formats
dateService.format(date, file.date);      // 2024-01-15
dateService.format(date, file.datetime);  // 2024-01-15_15-30-45
dateService.format(date, file.timestamp); // 20240115_153045
```

## Advanced Features

### Smart Formatting

```typescript
// Automatically choose format based on date distance
dateService.smartFormat(date);
// Today: "3:30 PM"
// This week: "Monday, 3:30 PM"
// This year: "Jan 15"
// Older: "Jan 15, 2024"
```

### Date Ranges

```typescript
// Format date ranges intelligently
dateService.formatRange(startDate, endDate);
// Same day: "Jan 15, 2024"
// Same month: "Jan 15 - 18, 2024"
// Different months: "Jan 15 - Feb 18, 2024"
```

### Locale-Specific Formats

```typescript
// Get formats for current locale
const formats = dateService.getLocalizedFormats();
// { date: 'MM/dd/yyyy', time: 'h:mm a', dateTime: 'MM/dd/yyyy h:mm a' }
```

## Testing

Update your tests to use the new service:

```typescript
// Frontend test
import dateService from '@/services/dateService';

describe('Date formatting', () => {
  beforeEach(() => {
    dateService.initialize({ locale: 'en-US' });
  });

  it('should format date correctly', () => {
    const date = new Date('2024-01-15T15:30:00Z');
    expect(dateService.displayDate(date)).toBe('Jan 15, 2024');
  });
});

// Backend test
import dateService from '@/services/dateService';

describe('API timestamps', () => {
  it('should format for API response', () => {
    const date = new Date('2024-01-15T15:30:00Z');
    expect(dateService.formatForResponse(date)).toBe('2024-01-15T15:30:00.000Z');
  });
});
```

## Performance Considerations

1. **Locale Imports**: Only imported locales are included in the bundle
2. **Tree Shaking**: Unused date-fns functions are automatically removed
3. **Memoization**: Format patterns are cached for repeated use
4. **Lazy Loading**: Locales can be dynamically imported if needed

## Troubleshooting

### Common Issues

1. **Locale Not Working**
   ```typescript
   // Ensure locale is supported
   import { getSupportedLocales } from '@spheroseg/shared/utils/dateLocales';
   console.log(getSupportedLocales());
   ```

2. **Timezone Issues**
   ```typescript
   // Backend: Always stores in UTC
   const utcDate = dateService.formatForDatabase(localDate);
   
   // Frontend: Displays in user's timezone
   const displayDate = dateService.displayDateTime(utcDate);
   ```

3. **Format Pattern Errors**
   ```typescript
   // Use constants to avoid typos
   import { DATE_FORMATS } from '@/services/dateService';
   dateService.format(date, DATE_FORMATS.DATE_MEDIUM);
   ```

## Gradual Migration Strategy

1. **Phase 1**: Update service imports and initialization
2. **Phase 2**: Migrate display formatting (least risky)
3. **Phase 3**: Migrate form handling and validation
4. **Phase 4**: Update API and database formatting
5. **Phase 5**: Remove old utilities

## Benefits After Migration

- ✅ Consistent date handling across the application
- ✅ Full internationalization support
- ✅ Better performance with tree-shaking
- ✅ Type-safe date operations
- ✅ Extensive formatting options
- ✅ Easier testing with centralized logic
- ✅ Future-proof with date-fns ecosystem