# A/B Testing Framework Documentation

This document describes the comprehensive A/B testing framework implementation for SpherosegV4.

## Overview

The A/B testing framework provides:
- Feature flag management
- Experiment design and execution
- User segmentation and targeting
- Metric tracking and analytics
- React integration with hooks and components

## Architecture

### Core Components

1. **ABTestingService** (`src/services/abTesting/abTestingService.ts`)
   - Main service for experiment management
   - User assignment and variant selection
   - Metric tracking and analytics

2. **React Hooks** (`src/hooks/useABTesting.ts`)
   - `useFeatureFlag`: Get feature flag values
   - `useExperiment`: Get experiment variants
   - `useABTestingMetrics`: Track events and conversions

3. **React Components** (`src/components/ABTesting.tsx`)
   - `<FeatureFlag>`: Conditional rendering based on flags
   - `<Experiment>`: Render different variants
   - `<TrackEvent>`: Event tracking wrapper

4. **Context Provider** (`src/contexts/ABTestingContext.tsx`)
   - Global A/B testing state management
   - Automatic initialization with user context

## Getting Started

### 1. Setup

Add the ABTestingProvider to your app:

```typescript
import { ABTestingProvider } from '@/contexts/ABTestingContext';

function App() {
  return (
    <ABTestingProvider 
      config={{
        analyticsEndpoint: '/api/analytics',
        apiKey: process.env.VITE_ANALYTICS_API_KEY,
        debugMode: true
      }}
    >
      <YourApp />
    </ABTestingProvider>
  );
}
```

### 2. Basic Usage

#### Feature Flags
```typescript
// Using hooks
function MyComponent() {
  const showNewFeature = useFeatureFlag('feature.new-ui', false);
  
  return showNewFeature ? <NewUI /> : <OldUI />;
}

// Using components
function MyComponent() {
  return (
    <FeatureFlag flag="feature.new-ui" fallback={<OldUI />}>
      <NewUI />
    </FeatureFlag>
  );
}
```

#### Experiments
```typescript
// Using hooks
function PricingPage() {
  const { variant, features } = useVariants('pricing-experiment');
  
  switch (variant) {
    case 'cards':
      return <CardLayout {...features} />;
    case 'table':
      return <TableLayout {...features} />;
    default:
      return <DefaultLayout />;
  }
}

// Using components
function PricingPage() {
  return (
    <Experiment experimentId="pricing-experiment">
      {(variant, features) => {
        switch (variant) {
          case 'cards':
            return <CardLayout {...features} />;
          case 'table':
            return <TableLayout {...features} />;
          default:
            return <DefaultLayout />;
        }
      }}
    </Experiment>
  );
}
```

## Experiment Configuration

### Define Experiments (`src/config/experiments.ts`)

```typescript
export const experiments: Experiment[] = [
  {
    id: 'new-onboarding-flow',
    name: 'New Onboarding Flow',
    status: 'running',
    variants: [
      {
        id: 'control',
        name: 'Current Flow',
        weight: 50,
        isControl: true,
        features: {
          'onboarding.steps': 5,
          'onboarding.skip': false
        }
      },
      {
        id: 'simplified',
        name: 'Simplified Flow',
        weight: 50,
        features: {
          'onboarding.steps': 3,
          'onboarding.skip': true,
          'onboarding.tooltips': true
        }
      }
    ],
    targeting: {
      segments: [{
        id: 'new-users',
        name: 'New Users',
        conditions: [{
          property: 'accountAge',
          operator: 'less_than',
          value: 7
        }]
      }],
      percentage: 100
    },
    metrics: {
      primary: [{
        id: 'onboarding-completion',
        name: 'Onboarding Completion',
        type: 'conversion',
        goal: 'increase'
      }]
    },
    allocation: {
      type: 'sticky',
      seed: 'onboarding-2024'
    }
  }
];
```

## User Targeting

### Segmentation Options

1. **User Properties**
   ```typescript
   segments: [{
     conditions: [
       { property: 'plan', operator: 'equals', value: 'free' },
       { property: 'projectCount', operator: 'greater_than', value: 5 }
     ]
   }]
   ```

2. **Geographic Targeting**
   ```typescript
   geoTargeting: {
     countries: ['US', 'CA'],
     regions: ['California', 'New York']
   }
   ```

3. **Device Targeting**
   ```typescript
   deviceTargeting: {
     types: ['mobile', 'tablet'],
     browsers: ['chrome', 'safari']
   }
   ```

4. **Percentage Rollout**
   ```typescript
   targeting: {
     percentage: 10 // Start with 10% of users
   }
   ```

## Metric Tracking

### Event Tracking
```typescript
// Using hooks
const { trackEvent } = useABTestingMetrics();

function handleClick() {
  trackEvent('button_clicked', {
    button: 'upgrade',
    location: 'header'
  });
}

// Using components
<TrackEvent event="page_viewed" properties={{ page: 'pricing' }} trigger="mount">
  <PricingPage />
</TrackEvent>
```

### Conversion Tracking
```typescript
// Using hooks
const { trackConversion } = useABTestingMetrics();

function handlePurchase() {
  trackConversion('purchase_completed', 29.99);
}

// Using components
<TrackConversion name="signup_completed" trigger="click">
  <Button>Sign Up</Button>
</TrackConversion>
```

## Advanced Features

### 1. Multi-Variant Testing
```typescript
<VariantSwitch experimentId="ui-experiment">
  <Variant experimentId="ui-experiment" variantId="control">
    <ClassicUI />
  </Variant>
  <Variant experimentId="ui-experiment" variantId="modern">
    <ModernUI />
  </Variant>
  <Variant experimentId="ui-experiment" variantId="minimal">
    <MinimalUI />
  </Variant>
</VariantSwitch>
```

### 2. Performance Optimization
```typescript
// Memoized feature flags
const isEnabled = useOptimizedFeatureFlag(
  'expensive-feature',
  false,
  [dependency1, dependency2]
);
```

### 3. Debug Panel
```typescript
// Show debug panel in development
<ABTestDebugPanel show={process.env.NODE_ENV === 'development'} />
```

### 4. Server-Side Rendering Support
```typescript
// Initialize with server context
const abService = new ABTestingService({
  analyticsEndpoint: config.analyticsEndpoint,
  apiKey: config.apiKey
});

await abService.initialize({
  userId: req.user.id,
  sessionId: req.sessionID,
  device: parseUserAgent(req.headers['user-agent']),
  geo: await getGeoIP(req.ip)
});
```

## Best Practices

### 1. Experiment Design
- Start with clear hypotheses
- Define success metrics upfront
- Use control groups
- Run experiments for statistical significance

### 2. Implementation
- Use semantic experiment and variant names
- Keep feature flags granular
- Clean up completed experiments
- Document experiment purposes

### 3. Performance
- Lazy load experiment configurations
- Cache variant assignments
- Batch analytics events
- Use memoization for expensive checks

### 4. Testing
```typescript
// Mock A/B testing in tests
jest.mock('@/hooks/useABTesting', () => ({
  useFeatureFlag: (flag: string, defaultValue: any) => defaultValue,
  useExperiment: () => ({ variant: 'control', features: {} })
}));
```

## Analytics Integration

### Event Schema
```typescript
{
  id: 'uuid',
  timestamp: '2024-01-01T00:00:00Z',
  userId: 'user123',
  sessionId: 'session456',
  eventName: 'button_clicked',
  properties: {
    button: 'upgrade',
    experiments: {
      'pricing-experiment': 'cards',
      'ui-experiment': 'modern'
    }
  },
  context: {
    device: { type: 'desktop', browser: 'chrome' },
    geo: { country: 'US', city: 'San Francisco' }
  }
}
```

### Metrics Dashboard
- Real-time experiment performance
- Conversion funnel analysis
- Statistical significance testing
- Cohort comparisons

## Troubleshooting

### Common Issues

1. **Variant Not Showing**
   - Check targeting rules
   - Verify experiment status is 'running'
   - Check user segmentation

2. **Metrics Not Tracking**
   - Ensure analytics endpoint is configured
   - Check network requests in browser
   - Verify event names match

3. **Inconsistent Assignments**
   - Use 'sticky' allocation type
   - Check localStorage for assignments
   - Ensure user ID is consistent

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('ab_testing_debug', 'true');

// View current assignments
const service = getABTestingInstance();
console.log(service.getAllFeatureFlags());
```

## Examples

See `/src/examples/ABTestingExample.tsx` for complete implementation examples including:
- Feature flag toggles
- Multi-variant experiments
- Conversion tracking
- Performance optimizations
- Complex UI experiments

## Future Enhancements

1. **Machine Learning Integration**: Automated variant selection
2. **Visual Editor**: No-code experiment creation
3. **Advanced Analytics**: Cohort analysis and retention metrics
4. **Personalization Engine**: User-specific experiences
5. **Cross-Platform Support**: Mobile SDK integration