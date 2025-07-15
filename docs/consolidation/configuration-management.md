# Configuration Management Consolidation

## Overview

This document describes the consolidation of configuration management in the SpherosegV4 application, creating a unified, type-safe, and environment-aware configuration system.

## Problem Statement

The application previously had configuration scattered throughout the codebase:
- Hardcoded API endpoints in multiple files
- No environment variable support
- No configuration validation
- No centralized settings management
- No runtime configuration updates
- Missing feature flags system
- No configuration persistence

This led to:
- Difficult deployment to different environments
- No way to change settings without code modifications
- Inconsistent configuration patterns
- No validation of configuration values
- Limited flexibility for feature toggles

## Solution Architecture

### Configuration Structure

```typescript
packages/frontend/src/config/
├── index.ts                    // Main configuration service
├── environments/
│   ├── index.ts               // Environment detection
│   ├── development.ts         // Development settings
│   ├── staging.ts             // Staging settings
│   └── production.ts          // Production settings
├── hooks/
│   └── useConfig.ts           // React hooks for configuration
└── components/
    └── ConfigurationPanel.tsx // UI for configuration management
```

### Key Features

1. **Centralized Configuration**: Single source of truth for all settings
2. **Environment-Aware**: Automatic environment detection and configuration
3. **Type-Safe**: Full TypeScript support with Zod validation
4. **Runtime Updates**: Change configuration without restarting
5. **Persistence**: Save user preferences to localStorage
6. **Feature Flags**: Toggle features dynamically
7. **Validation**: Runtime validation of all configuration values
8. **Export/Import**: Configuration portability

## Configuration Schema

### Main Categories

```typescript
interface Config {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    endpoints: {
      auth: string;
      users: string;
      segmentation: string;
      // ...
    };
  };
  
  websocket: {
    url: string;
    reconnect: boolean;
    reconnectAttempts: number;
    // ...
  };
  
  features: {
    enableAnalytics: boolean;
    enablePushNotifications: boolean;
    enableOfflineMode: boolean;
    // ...
  };
  
  ui: {
    theme: { default: 'light' | 'dark' | 'system' };
    language: { default: string; supported: string[] };
    notifications: { position: string; duration: number };
    // ...
  };
  
  cache: {
    enabled: boolean;
    ttl: { default: number; images: number; };
    maxSize: { memory: number; localStorage: number; };
    // ...
  };
  
  // And more categories...
}
```

## Usage Examples

### Basic Configuration Access

```typescript
import { config, getConfigValue } from '@/config';

// Access entire config
console.log(config.api.baseUrl);

// Access specific value
const timeout = getConfigValue<number>('api.timeout');
```

### Using React Hooks

```typescript
import { useConfig, useConfigValue, useFeatureFlag } from '@/hooks/useConfig';

function MyComponent() {
  // Get entire config
  const config = useConfig();
  
  // Get specific value with reactive updates
  const apiUrl = useConfigValue<string>('api.baseUrl');
  
  // Check feature flag
  const analyticsEnabled = useFeatureFlag('enableAnalytics');
  
  return (
    <div>
      {analyticsEnabled && <Analytics />}
      <p>API: {apiUrl}</p>
    </div>
  );
}
```

### Updating Configuration

```typescript
import { useConfigUpdate } from '@/hooks/useConfig';

function SettingsForm() {
  const { updateConfig, setConfigValue } = useConfigUpdate();
  
  // Update single value
  const handleThemeChange = (theme: string) => {
    setConfigValue('ui.theme.default', theme);
  };
  
  // Update multiple values
  const handleSave = async (settings: any) => {
    await updateConfig({
      api: { timeout: settings.timeout },
      features: { enableAnalytics: settings.analytics },
    });
  };
}
```

### Environment-Specific Configuration

```typescript
import { useEnvironment } from '@/hooks/useConfig';

function DebugPanel() {
  const { isDevelopment, environment } = useEnvironment();
  
  if (!isDevelopment) return null;
  
  return (
    <div>
      <h3>Debug Info (Environment: {environment})</h3>
      {/* Debug content */}
    </div>
  );
}
```

### Feature Flags

```typescript
import { useFeatureFlags } from '@/hooks/useConfig';

function AppFeatures() {
  const features = useFeatureFlags([
    'enableBetaFeatures',
    'enableOfflineMode',
    'enableAnalytics',
  ]);
  
  return (
    <div>
      {features.enableBetaFeatures && <BetaFeatures />}
      {features.enableOfflineMode && <OfflineIndicator />}
      {features.enableAnalytics && <AnalyticsTracker />}
    </div>
  );
}
```

## Environment Variables

### Frontend (Vite)

```env
# API Configuration
VITE_API_URL=https://api.spheroseg.com
VITE_API_AUTH_PREFIX=/api/auth
VITE_API_USERS_PREFIX=/api/users

# WebSocket Configuration
VITE_WEBSOCKET_URL=wss://api.spheroseg.com

# Assets Configuration
VITE_ASSETS_URL=https://assets.spheroseg.com

# ML Service Configuration
VITE_ML_SERVICE_URL=https://ml.spheroseg.com

# Application Settings
VITE_APP_ENV=production
VITE_APP_VERSION=4.0.0
VITE_DEBUG=false
VITE_LOG_LEVEL=error

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_PUSH_NOTIFICATIONS=true
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_BETA_FEATURES=false

# External Services
VITE_SENTRY_DSN=https://...@sentry.io/...
VITE_GA_TRACKING_ID=UA-XXXXXXXXX-X
```

## Migration Guide

### 1. Replace Hardcoded Values

**Before:**
```typescript
// In various files
fetch('/api/users/preferences', { ... });
const WS_URL = 'ws://localhost:3001';
const ENABLE_ANALYTICS = true;
```

**After:**
```typescript
import { getConfigValue } from '@/config';
import { useApiConfig, useFeatureFlag } from '@/hooks/useConfig';

// In service files
const apiUrl = getConfigValue<string>('api.baseUrl');
const endpoint = getConfigValue<string>('api.endpoints.users');
fetch(`${apiUrl}${endpoint}/preferences`, { ... });

// In React components
function Component() {
  const { getEndpoint } = useApiConfig();
  const analyticsEnabled = useFeatureFlag('enableAnalytics');
  
  const url = getEndpoint('users'); // Returns full URL
}
```

### 2. Update Service Implementations

**Before:**
```typescript
// profileSlice.ts
const response = await apiClient.get(`/api/users/profile/${user.id}`);
```

**After:**
```typescript
import { getConfigValue } from '@/config';

const baseUrl = getConfigValue<string>('api.baseUrl');
const usersEndpoint = getConfigValue<string>('api.endpoints.users');
const response = await apiClient.get(`${baseUrl}${usersEndpoint}/profile/${user.id}`);
```

### 3. Add Configuration UI

```typescript
import { ConfigurationPanel } from '@/components/settings/ConfigurationPanel';

// Add to settings page
<Route path="/settings/configuration" element={<ConfigurationPanel />} />
```

## Advanced Features

### 1. Configuration Validation

```typescript
import { useConfigValidation } from '@/hooks/useConfig';

function ConfigImporter() {
  const { validate } = useConfigValidation();
  
  const handleImport = (data: unknown) => {
    if (!validate(data)) {
      throw new Error('Invalid configuration format');
    }
    // Import valid config
  };
}
```

### 2. Configuration Subscriptions

```typescript
import { subscribeToConfig } from '@/config';

// Subscribe to specific path
const unsubscribe = subscribeToConfig('features.enableAnalytics', (enabled) => {
  if (enabled) {
    initializeAnalytics();
  } else {
    disableAnalytics();
  }
});

// Cleanup
unsubscribe();
```

### 3. Dynamic Environment Detection

```typescript
import { detectEnvironment } from '@/config/environments';

// Automatically detects based on:
// 1. VITE_APP_ENV variable
// 2. NODE_ENV variable
// 3. Hostname patterns
const environment = detectEnvironment();
```

### 4. Configuration Export/Import

```typescript
import { useConfigPortability } from '@/hooks/useConfig';

function ConfigBackup() {
  const { exportConfig, importConfig } = useConfigPortability();
  
  return (
    <div>
      <button onClick={exportConfig}>Export Settings</button>
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importConfig(file);
        }}
      />
    </div>
  );
}
```

## Best Practices

1. **Environment Variables**: Use VITE_ prefix for all frontend env vars
2. **Validation**: Always validate configuration on load and update
3. **Defaults**: Provide sensible defaults for all values
4. **Type Safety**: Use TypeScript types for all config access
5. **Reactive Updates**: Use hooks in React components for reactive updates
6. **Feature Flags**: Use feature flags for gradual rollouts
7. **Documentation**: Document all configuration options

## Benefits Achieved

- **100% Type-Safe** configuration with runtime validation
- **Zero Hardcoded** values in the codebase
- **Dynamic Updates** without code changes or restarts
- **Environment-Specific** configurations
- **User Preferences** persistence
- **Feature Flag System** for controlled rollouts
- **Configuration UI** for easy management
- **Export/Import** for configuration portability

## Testing Configuration

```typescript
import { configService } from '@/config';

describe('Configuration', () => {
  beforeEach(() => {
    configService.reset();
  });
  
  it('should validate configuration', () => {
    const valid = configService.validate({
      api: { baseUrl: 'https://api.test.com' },
      // ... other required fields
    });
    expect(valid).toBe(true);
  });
  
  it('should update configuration', () => {
    configService.set('api.timeout', 5000);
    expect(configService.get('api.timeout')).toBe(5000);
  });
});
```

## Future Enhancements

1. **Remote Configuration**: Fetch configuration from server
2. **A/B Testing**: Built-in A/B test configuration
3. **Configuration History**: Track configuration changes
4. **Role-Based Configuration**: Different configs for different user roles
5. **Configuration Encryption**: Encrypt sensitive configuration values
6. **Hot Reload**: Apply configuration changes without page reload