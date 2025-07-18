# Analytics Tools Consolidation

## Overview

The analytics tools consolidation provides a comprehensive analytics tracking and reporting system for the SpherosegV4 application. This system supports multiple analytics providers, real-time tracking, performance monitoring, and detailed analytics dashboards.

## Problem Statement

Previously, analytics implementation was fragmented:
- No centralized analytics tracking
- Limited performance monitoring
- No user behavior tracking
- Missing error tracking and reporting
- No analytics dashboard for insights
- Inconsistent event tracking across features

## Solution Architecture

### Core Components

1. **AnalyticsService** (`/packages/frontend/src/services/analyticsService.ts`)
   - Multi-provider support (Google Analytics, Mixpanel, Console)
   - Event tracking with categories and actions
   - Page view tracking
   - Performance metrics collection
   - User properties management
   - Error tracking
   - Custom metrics support
   - Automatic session management

2. **React Hooks** (`/packages/frontend/src/hooks/useAnalytics.ts`)
   - `useAnalytics` - Initialize and configure analytics
   - `useTrackEvent` - Track custom events
   - `usePerformanceTracking` - Monitor performance metrics
   - `useMetrics` - Track custom metrics
   - `useSegmentationAnalytics` - Segmentation-specific tracking
   - `useExportAnalytics` - Export operation tracking
   - `useInteractionTracking` - User interaction tracking
   - `useAPITracking` - API performance monitoring

3. **UI Components**
   - **AnalyticsDashboard** (`/packages/frontend/src/components/analytics/AnalyticsDashboard.tsx`)
     - Real-time analytics visualization
     - Multiple chart types (line, bar, pie, area)
     - Time range selection
     - Performance metrics display
     - Error tracking dashboard
     - Export analytics

## Key Features

### 1. Event Categories and Actions

```typescript
enum EventCategory {
  USER = 'user',
  PROJECT = 'project',
  IMAGE = 'image',
  SEGMENTATION = 'segmentation',
  EXPORT = 'export',
  SYSTEM = 'system',
  PERFORMANCE = 'performance',
  ERROR = 'error',
}

enum EventAction {
  LOGIN = 'login',
  PROJECT_CREATE = 'project_create',
  SEGMENTATION_START = 'segmentation_start',
  EXPORT_COMPLETE = 'export_complete',
  // ... and many more
}
```

### 2. Multi-Provider Support

```typescript
// Configure multiple analytics providers
const config = {
  providers: {
    google: {
      enabled: true,
      measurementId: 'G-XXXXXXXXXX'
    },
    mixpanel: {
      enabled: true,
      token: 'your-mixpanel-token'
    }
  },
  debug: true, // Enable console logging
  anonymizeIp: true,
  sessionTimeout: 30 * 60 * 1000 // 30 minutes
};
```

### 3. Performance Tracking

```typescript
// Track performance with timing
const { startTimer, endTimer, measureAsync } = usePerformanceTracking();

// Manual timing
startTimer('image_processing');
// ... do work
endTimer('image_processing', { imageSize: 'large' });

// Automatic async timing
const result = await measureAsync('api_call', async () => {
  return await fetch('/api/data');
}, { endpoint: '/api/data' });
```

### 4. User Behavior Tracking

```typescript
// Track user interactions
const { trackClick, trackFormSubmit, trackSearch } = useInteractionTracking();

// Track button clicks
trackClick('export_button', { format: 'csv' });

// Track form submissions
trackFormSubmit('settings_form', true, { changes: 3 });

// Track searches
trackSearch('cancer cells', 15, { filter: 'recent' });
```

### 5. Segmentation Analytics

```typescript
// Track segmentation operations
const { measureSegmentation } = useSegmentationAnalytics();

const result = await measureSegmentation(
  imageId,
  'resunet',
  async () => {
    const segmentation = await runSegmentation(image);
    return { ...segmentation, cellCount: segmentation.cells.length };
  }
);
```

### 6. Error Tracking

```typescript
// Automatic error tracking
window.addEventListener('error', (event) => {
  analyticsService.trackError(new Error(event.message), {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

// Manual error tracking
try {
  await riskyOperation();
} catch (error) {
  trackError(error, { operation: 'risky_operation' });
}
```

## Usage Examples

### Basic Setup

```tsx
import { useAnalytics } from '@/hooks/useAnalytics';

function App() {
  // Initialize analytics on app mount
  useAnalytics();
  
  return <YourApp />;
}
```

### Track Feature Usage

```tsx
import { useTrackEvent } from '@/hooks/useAnalytics';

function SegmentationButton({ image }) {
  const { trackFeatureUsage } = useTrackEvent();
  
  const handleSegment = () => {
    trackFeatureUsage('segmentation_manual', {
      imageId: image.id,
      algorithm: 'resunet'
    });
    
    // Perform segmentation
  };
  
  return <Button onClick={handleSegment}>Segment</Button>;
}
```

### Performance Monitoring

```tsx
import { usePerformanceTracking } from '@/hooks/useAnalytics';

function ImageUploader() {
  const { measureAsync } = usePerformanceTracking();
  
  const uploadImage = async (file: File) => {
    return measureAsync('image_upload', async () => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      return response.json();
    }, {
      fileSize: file.size.toString(),
      fileType: file.type
    });
  };
  
  return <FileUpload onUpload={uploadImage} />;
}
```

### Analytics Dashboard

```tsx
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

function AdminPanel() {
  return (
    <div>
      <h1>Analytics Overview</h1>
      <AnalyticsDashboard />
    </div>
  );
}
```

### Custom Metrics

```tsx
import { useMetrics } from '@/hooks/useAnalytics';

function CellCounter({ cells }) {
  const { trackGauge, trackHistogram } = useMetrics();
  
  useEffect(() => {
    // Track current cell count
    trackGauge('cell_count', cells.length, {
      imageId: currentImageId
    });
    
    // Track cell size distribution
    cells.forEach(cell => {
      trackHistogram('cell_size', cell.area, {
        cellType: cell.type
      });
    });
  }, [cells]);
  
  return <div>Cells: {cells.length}</div>;
}
```

## Configuration

### Environment Variables

```env
# Google Analytics
VITE_ANALYTICS_GA_ID=G-XXXXXXXXXX

# Mixpanel
VITE_ANALYTICS_MIXPANEL_TOKEN=your-token

# Analytics Settings
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_DEBUG=false
VITE_ANALYTICS_ANONYMIZE_IP=true
```

### Custom Configuration

```typescript
// config/analytics.ts
export const analyticsConfig = {
  enabled: import.meta.env.PROD, // Only in production
  providers: {
    google: {
      enabled: true,
      measurementId: import.meta.env.VITE_ANALYTICS_GA_ID,
    },
    mixpanel: {
      enabled: false,
      token: import.meta.env.VITE_ANALYTICS_MIXPANEL_TOKEN,
    },
  },
  excludePaths: ['/admin', '/debug'], // Don't track these paths
  customDimensions: {
    organization: 'dimension1',
    userRole: 'dimension2',
  },
};
```

## Performance Considerations

1. **Batching**: Events are automatically batched to reduce network requests
2. **Debouncing**: Rapid events (like scroll) are debounced
3. **Lazy Loading**: Analytics scripts are loaded asynchronously
4. **Queue System**: Events are queued if analytics isn't initialized
5. **Error Boundaries**: Provider errors don't affect app functionality

## Privacy and Compliance

1. **IP Anonymization**: IP addresses are anonymized by default
2. **User Consent**: Implement consent management before tracking
3. **Data Retention**: Configure data retention policies in providers
4. **GDPR Compliance**: Support for user data deletion requests
5. **Cookie Policy**: Inform users about analytics cookies

## Best Practices

1. **Consistent Naming**: Use standardized event names and categories
2. **Meaningful Labels**: Provide descriptive labels for events
3. **Context Metadata**: Include relevant context in event metadata
4. **Performance Budget**: Set limits for analytics impact on performance
5. **Error Context**: Include stack traces and user actions in error tracking
6. **Regular Review**: Review analytics data to improve tracking

## Migration Guide

### 1. Replace Custom Tracking

Before:
```typescript
// Old custom tracking
console.log('User clicked export');
localStorage.setItem('last_export', Date.now());
```

After:
```typescript
// New analytics tracking
import { useTrackEvent } from '@/hooks/useAnalytics';

const { trackEvent } = useTrackEvent();
trackEvent(EventCategory.EXPORT, EventAction.EXPORT_START, 'csv');
```

### 2. Add Performance Monitoring

```typescript
// Wrap async operations
import { usePerformanceTracking } from '@/hooks/useAnalytics';

const { measureAsync } = usePerformanceTracking();

// Old
const data = await fetchData();

// New
const data = await measureAsync('fetch_data', () => fetchData());
```

### 3. Implement Error Tracking

```typescript
// Add to error boundaries
import { useTrackEvent } from '@/hooks/useAnalytics';

class ErrorBoundary extends Component {
  componentDidCatch(error, errorInfo) {
    const { trackError } = this.props;
    trackError(error, errorInfo);
  }
}
```

## Future Enhancements

1. **Real-time Analytics**: WebSocket-based real-time dashboard
2. **A/B Testing**: Built-in experimentation framework
3. **Funnel Analysis**: Track user journeys through features
4. **Cohort Analysis**: Group users by behavior patterns
5. **Custom Dashboards**: User-configurable analytics views
6. **ML Insights**: Machine learning for anomaly detection
7. **Data Export**: Export analytics data for external analysis
8. **Mobile Analytics**: SDK for mobile app tracking