/**
 * A/B Testing Context Provider
 *
 * Provides global A/B testing state and configuration
 */

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  initializeABTesting,
  getABTestingInstance,
  ABTestingService,
  UserContext,
  FeatureFlag,
  ExperimentResult,
} from '@/services/abTesting/abTestingService';

// Types
interface ABTestingContextValue {
  isInitialized: boolean;
  service: ABTestingService | null;
  activeExperiments: FeatureFlag[];
  getFeatureFlag: <T = boolean>(key: string, defaultValue?: T) => T;
  getExperiment: (experimentId: string) => ExperimentResult | null;
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  trackConversion: (conversionName: string, value?: number) => void;
  refreshExperiments: () => Promise<void>;
}

interface ABTestingProviderProps {
  children: ReactNode;
  config?: {
    analyticsEndpoint?: string;
    apiKey?: string;
    debugMode?: boolean;
  };
}

// Create context
const ABTestingContext = createContext<ABTestingContextValue | undefined>(undefined);

// Provider component
export function ABTestingProvider({ children, config = {} }: ABTestingProviderProps) {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [service, setService] = useState<ABTestingService | null>(null);
  const [activeExperiments, setActiveExperiments] = useState<FeatureFlag[]>([]);

  // Initialize service
  useEffect(() => {
    if (!user) {
      setIsInitialized(false);
      setService(null);
      return;
    }

    const initService = async () => {
      try {
        const abConfig = {
          analyticsEndpoint: config.analyticsEndpoint || import.meta.env.VITE_ANALYTICS_ENDPOINT || '/api/analytics',
          apiKey: config.apiKey || import.meta.env.VITE_ANALYTICS_API_KEY || '',
        };

        const abService = initializeABTesting(abConfig);

        const userContext: UserContext = {
          userId: user.id,
          sessionId: getOrCreateSessionId(),
          properties: {
            email: user.email,
            plan: user.plan || 'free',
            createdAt: user.createdAt,
            role: user.role,
            // Add custom properties
            ...getUserProperties(user),
          },
        };

        await abService.initialize(userContext);

        setService(abService);
        setIsInitialized(true);

        // Load active experiments
        const flags = abService.getAllFeatureFlags();
        setActiveExperiments(flags);

        // Debug mode
        if (config.debugMode || import.meta.env.DEV) {
          console.log('A/B Testing initialized:', {
            user: userContext.userId,
            experiments: flags,
          });
        }
      } catch (error) {
        console.error('Failed to initialize A/B testing:', error);
        setIsInitialized(false);
      }
    };

    initService();

    // Cleanup
    return () => {
      const currentService = getABTestingInstance();
      if (currentService) {
        currentService.destroy();
      }
    };
  }, [user, config]);

  // Context value methods
  const getFeatureFlag = <T = boolean,>(key: string, defaultValue?: T): T => {
    if (!service) return defaultValue as T;
    return service.getFeatureFlag(key, defaultValue);
  };

  const getExperiment = (experimentId: string): ExperimentResult | null => {
    if (!service) return null;
    return service.getVariant(experimentId);
  };

  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    if (!service) return;
    service.trackEvent(eventName, properties);
  };

  const trackConversion = (conversionName: string, value?: number) => {
    if (!service) return;
    service.trackConversion(conversionName, value);
  };

  const refreshExperiments = async () => {
    if (!service) return;

    // Re-initialize to reload experiments
    if (user) {
      const userContext: UserContext = {
        userId: user.id,
        sessionId: getOrCreateSessionId(),
        properties: getUserProperties(user),
      };

      await service.initialize(userContext);
      const flags = service.getAllFeatureFlags();
      setActiveExperiments(flags);
    }
  };

  const value: ABTestingContextValue = {
    isInitialized,
    service,
    activeExperiments,
    getFeatureFlag,
    getExperiment,
    trackEvent,
    trackConversion,
    refreshExperiments,
  };

  return <ABTestingContext.Provider value={value}>{children}</ABTestingContext.Provider>;
}

// Hook to use A/B testing context
export function useABTesting() {
  const context = useContext(ABTestingContext);

  if (context === undefined) {
    throw new Error('useABTesting must be used within an ABTestingProvider');
  }

  return context;
}

// Helper functions
function getOrCreateSessionId(): string {
  const key = 'ab_session_id';
  let sessionId = sessionStorage.getItem(key);

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }

  return sessionId;
}

function getUserProperties(user: any): Record<string, any> {
  return {
    // User demographics
    accountAge: getAccountAge(user.createdAt),

    // Usage metrics
    lastActiveAt: user.lastActiveAt || new Date().toISOString(),
    totalProjects: user.totalProjects || 0,
    totalImages: user.totalImages || 0,

    // Engagement
    hasCompletedOnboarding: user.hasCompletedOnboarding || false,
    hasUsedSegmentation: user.hasUsedSegmentation || false,
    hasExportedData: user.hasExportedData || false,

    // Technical
    preferredLanguage: user.language || 'en',
    theme: user.theme || 'light',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    // Custom properties can be added here
  };
}

function getAccountAge(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Export everything
export default ABTestingContext;
