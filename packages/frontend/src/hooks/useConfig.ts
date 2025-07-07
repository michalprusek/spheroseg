import { useEffect, useState, useCallback, useMemo } from 'react';
import { configService, type Config } from '@/config';
import { useStore } from '@/store';

/**
 * Hook for accessing and managing configuration
 */
export function useConfig() {
  const [config, setConfig] = useState<Config>(configService.getConfig());

  useEffect(() => {
    // Subscribe to all config changes
    const unsubscribe = configService.subscribe('', (newConfig) => {
      setConfig(newConfig);
    });

    return unsubscribe;
  }, []);

  return config;
}

/**
 * Hook for accessing specific configuration value
 */
export function useConfigValue<T = any>(path: string): T {
  const [value, setValue] = useState<T>(configService.get<T>(path));

  useEffect(() => {
    // Subscribe to specific path changes
    const unsubscribe = configService.subscribe(path, (newValue) => {
      setValue(newValue);
    });

    // Set initial value
    setValue(configService.get<T>(path));

    return unsubscribe;
  }, [path]);

  return value;
}

/**
 * Hook for updating configuration values
 */
export function useConfigUpdate() {
  const addNotification = useStore((state) => state.addNotification);

  const updateConfig = useCallback(
    async (updates: Partial<Config>) => {
      try {
        configService.update(updates);
        addNotification({
          type: 'success',
          title: 'Configuration Updated',
          message: 'Settings have been saved successfully',
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Configuration Error',
          message: error instanceof Error ? error.message : 'Failed to update configuration',
        });
        throw error;
      }
    },
    [addNotification]
  );

  const setConfigValue = useCallback(
    async (path: string, value: any) => {
      try {
        configService.set(path, value);
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Configuration Error',
          message: `Failed to update ${path}`,
        });
        throw error;
      }
    },
    [addNotification]
  );

  const resetConfig = useCallback(async () => {
    try {
      configService.reset();
      addNotification({
        type: 'info',
        title: 'Configuration Reset',
        message: 'All settings have been reset to defaults',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Reset Error',
        message: 'Failed to reset configuration',
      });
      throw error;
    }
  }, [addNotification]);

  return {
    updateConfig,
    setConfigValue,
    resetConfig,
  };
}

/**
 * Hook for feature flags
 */
export function useFeatureFlag(flagName: keyof Config['features']): boolean {
  return useConfigValue<boolean>(`features.${flagName}`);
}

/**
 * Hook for API configuration
 */
export function useApiConfig() {
  const apiConfig = useConfigValue<Config['api']>('api');
  
  const getEndpoint = useCallback(
    (endpoint: keyof Config['api']['endpoints']) => {
      return `${apiConfig.baseUrl}${apiConfig.endpoints[endpoint]}`;
    },
    [apiConfig]
  );

  return {
    ...apiConfig,
    getEndpoint,
  };
}

/**
 * Hook for UI configuration
 */
export function useUIConfig() {
  return useConfigValue<Config['ui']>('ui');
}

/**
 * Hook for cache configuration
 */
export function useCacheConfig() {
  return useConfigValue<Config['cache']>('cache');
}

/**
 * Hook for environment-specific configuration
 */
export function useEnvironment() {
  const config = useConfig();
  
  return useMemo(
    () => ({
      isDevelopment: config.app.environment === 'development',
      isStaging: config.app.environment === 'staging',
      isProduction: config.app.environment === 'production',
      environment: config.app.environment,
      debug: config.app.debug,
      version: config.app.version,
    }),
    [config.app]
  );
}

/**
 * Hook for checking multiple feature flags
 */
export function useFeatureFlags<K extends keyof Config['features']>(
  flags: K[]
): Record<K, boolean> {
  const features = useConfigValue<Config['features']>('features');
  
  return useMemo(
    () =>
      flags.reduce((acc, flag) => {
        acc[flag] = features[flag] as boolean;
        return acc;
      }, {} as Record<K, boolean>),
    [features, flags]
  );
}

/**
 * Hook for configuration validation
 */
export function useConfigValidation() {
  const validate = useCallback((config: unknown): config is Config => {
    return configService.validate(config);
  }, []);

  const getSchema = useCallback(() => {
    return configService.getSchema();
  }, []);

  return {
    validate,
    getSchema,
  };
}

/**
 * Hook for configuration export/import
 */
export function useConfigPortability() {
  const addNotification = useStore((state) => state.addNotification);

  const exportConfig = useCallback(() => {
    try {
      const config = configService.export();
      const blob = new Blob([JSON.stringify(config, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spheroseg-config-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      addNotification({
        type: 'success',
        title: 'Configuration Exported',
        message: 'Configuration has been downloaded',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Export Error',
        message: 'Failed to export configuration',
      });
    }
  }, [addNotification]);

  const importConfig = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        
        if (!configService.validate(config)) {
          throw new Error('Invalid configuration format');
        }
        
        configService.import(config);
        
        addNotification({
          type: 'success',
          title: 'Configuration Imported',
          message: 'Settings have been updated from the imported file',
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Import Error',
          message: error instanceof Error ? error.message : 'Failed to import configuration',
        });
        throw error;
      }
    },
    [addNotification]
  );

  return {
    exportConfig,
    importConfig,
  };
}