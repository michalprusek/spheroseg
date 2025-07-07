import React, { useState } from 'react';
import {
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useConfig, useConfigUpdate, useConfigPortability, useEnvironment } from '@/hooks/useConfig';
import { useUI } from '@/store';

interface ConfigSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const configSections: ConfigSection[] = [
  {
    id: 'api',
    title: 'API Configuration',
    icon: Cog6ToothIcon,
    description: 'Configure API endpoints and connection settings',
  },
  {
    id: 'features',
    title: 'Feature Flags',
    icon: CheckCircleIcon,
    description: 'Enable or disable application features',
  },
  {
    id: 'ui',
    title: 'User Interface',
    icon: Cog6ToothIcon,
    description: 'Customize appearance and behavior',
  },
  {
    id: 'cache',
    title: 'Cache Settings',
    icon: ArrowPathIcon,
    description: 'Configure caching behavior and limits',
  },
];

export function ConfigurationPanel() {
  const config = useConfig();
  const { updateConfig, resetConfig } = useConfigUpdate();
  const { exportConfig, importConfig } = useConfigPortability();
  const { isDevelopment, isStaging, environment } = useEnvironment();
  const { openModal } = useUI();
  const [activeSection, setActiveSection] = useState('features');
  const [localConfig, setLocalConfig] = useState(config);

  const handleSave = async () => {
    try {
      await updateConfig(localConfig);
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  };

  const handleReset = () => {
    openModal({
      type: 'confirm',
      title: 'Reset Configuration',
      content: 'Are you sure you want to reset all settings to their default values? This action cannot be undone.',
      actions: [
        {
          label: 'Cancel',
          variant: 'secondary',
          onClick: () => {},
        },
        {
          label: 'Reset',
          variant: 'danger',
          onClick: async () => {
            await resetConfig();
            setLocalConfig(config);
          },
        },
      ],
    });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importConfig(file).then(() => {
        setLocalConfig(config);
      });
    }
  };

  const renderFeatureFlags = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Feature Flags</h3>
      
      {Object.entries(config.features).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between py-2">
          <div>
            <label htmlFor={key} className="font-medium">
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
            </label>
            <p className="text-sm text-gray-500">
              {getFeatureDescription(key)}
            </p>
          </div>
          <input
            id={key}
            type="checkbox"
            checked={localConfig.features[key as keyof typeof config.features] as boolean}
            onChange={(e) => {
              setLocalConfig({
                ...localConfig,
                features: {
                  ...localConfig.features,
                  [key]: e.target.checked,
                },
              });
            }}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        </div>
      ))}
    </div>
  );

  const renderApiConfig = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
      
      <div>
        <label className="block text-sm font-medium mb-1">Base URL</label>
        <input
          type="text"
          value={localConfig.api.baseUrl}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              api: {
                ...localConfig.api,
                baseUrl: e.target.value,
              },
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Timeout (ms)</label>
        <input
          type="number"
          value={localConfig.api.timeout}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              api: {
                ...localConfig.api,
                timeout: parseInt(e.target.value, 10),
              },
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Retry Attempts</label>
        <input
          type="number"
          value={localConfig.api.retryAttempts}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              api: {
                ...localConfig.api,
                retryAttempts: parseInt(e.target.value, 10),
              },
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  const renderUIConfig = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">User Interface Settings</h3>
      
      <div>
        <label className="block text-sm font-medium mb-1">Default Theme</label>
        <select
          value={localConfig.ui.theme.default}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              ui: {
                ...localConfig.ui,
                theme: {
                  ...localConfig.ui.theme,
                  default: e.target.value as any,
                },
              },
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Default Language</label>
        <select
          value={localConfig.ui.language.default}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              ui: {
                ...localConfig.ui,
                language: {
                  ...localConfig.ui.language,
                  default: e.target.value,
                },
              },
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {localConfig.ui.language.supported.map((lang) => (
            <option key={lang} value={lang}>
              {getLanguageName(lang)}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Notification Duration (ms)</label>
        <input
          type="number"
          value={localConfig.ui.notifications.defaultDuration}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              ui: {
                ...localConfig.ui,
                notifications: {
                  ...localConfig.ui.notifications,
                  defaultDuration: parseInt(e.target.value, 10),
                },
              },
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  const renderCacheConfig = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Cache Configuration</h3>
      
      <div className="flex items-center justify-between py-2">
        <label htmlFor="cacheEnabled" className="font-medium">
          Enable Caching
        </label>
        <input
          id="cacheEnabled"
          type="checkbox"
          checked={localConfig.cache.enabled}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              cache: {
                ...localConfig.cache,
                enabled: e.target.checked,
              },
            });
          }}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Default TTL (minutes)</label>
        <input
          type="number"
          value={localConfig.cache.ttl.default / 60000}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              cache: {
                ...localConfig.cache,
                ttl: {
                  ...localConfig.cache.ttl,
                  default: parseInt(e.target.value, 10) * 60000,
                },
              },
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Memory Cache Size (MB)</label>
        <input
          type="number"
          value={localConfig.cache.maxSize.memory / (1024 * 1024)}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              cache: {
                ...localConfig.cache,
                maxSize: {
                  ...localConfig.cache.maxSize,
                  memory: parseInt(e.target.value, 10) * 1024 * 1024,
                },
              },
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'features':
        return renderFeatureFlags();
      case 'api':
        return renderApiConfig();
      case 'ui':
        return renderUIConfig();
      case 'cache':
        return renderCacheConfig();
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Configuration Settings</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Environment:</span>
          <span className={`font-medium ${
            isDevelopment ? 'text-green-600' : 
            isStaging ? 'text-yellow-600' : 
            'text-blue-600'
          }`}>
            {environment.toUpperCase()}
          </span>
          {(isDevelopment || isStaging) && (
            <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <nav className="space-y-1">
            {configSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 space-y-2">
            <button
              onClick={exportConfig}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export Config
            </button>
            
            <label className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer dark:text-gray-300 dark:hover:bg-gray-800">
              <ArrowUpTrayIcon className="h-4 w-4" />
              Import Config
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            
            <button
              onClick={handleReset}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Reset to Defaults
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {renderSection()}
            
            <div className="mt-6 pt-6 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setLocalConfig(config)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getFeatureDescription(feature: string): string {
  const descriptions: Record<string, string> = {
    enableAnalytics: 'Track user interactions and usage patterns',
    enablePushNotifications: 'Send browser push notifications for important events',
    enableOfflineMode: 'Allow application to work without internet connection',
    enableBetaFeatures: 'Access experimental features that may be unstable',
    enableDebugTools: 'Show development and debugging tools',
    enablePerformanceMonitoring: 'Monitor application performance metrics',
    enableErrorReporting: 'Automatically report errors to improve the application',
    maxConcurrentUploads: 'Maximum number of files that can be uploaded simultaneously',
    autoSaveInterval: 'How often to automatically save user work',
  };
  return descriptions[feature] || 'No description available';
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    cs: 'Čeština',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    ja: '日本語',
    ko: '한국어',
    pl: 'Polski',
    pt: 'Português',
    ru: 'Русский',
    zh: '中文',
  };
  return languages[code] || code.toUpperCase();
}