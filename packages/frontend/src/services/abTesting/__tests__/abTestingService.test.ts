import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ABTestingService } from '../abTestingService';
import type { Experiment, ExperimentVariant, User } from '../types';

// Mock config
vi.mock('../../../config/app.config', () => ({
  default: {
    analytics: {
      enabled: true,
      trackingId: 'test-tracking-id',
      apiEndpoint: 'https://analytics.test.com',
    },
  },
}));

describe('ABTestingService', () => {
  let service: ABTestingService;
  let mockUser: User;

  beforeEach(() => {
    service = new ABTestingService();
    mockUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      properties: {
        country: 'US',
        language: 'en',
        plan: 'premium',
      },
    };

    // Clear localStorage
    localStorage.clear();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('experiment management', () => {
    it('should create and retrieve experiments', () => {
      const experiment: Experiment = {
        id: 'test-experiment',
        name: 'Test Experiment',
        description: 'Testing experiment creation',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'active',
        startDate: new Date().toISOString(),
        targeting: {},
      };

      service.createExperiment(experiment);
      const retrieved = service.getExperiment('test-experiment');

      expect(retrieved).toEqual(experiment);
    });

    it('should update experiment status', () => {
      const experiment: Experiment = {
        id: 'status-test',
        name: 'Status Test',
        variants: [{ id: 'control', name: 'Control', weight: 100 }],
        status: 'draft',
        startDate: new Date().toISOString(),
        targeting: {},
      };

      service.createExperiment(experiment);
      service.updateExperimentStatus('status-test', 'active');

      const updated = service.getExperiment('status-test');
      expect(updated?.status).toBe('active');
    });

    it('should list all experiments', () => {
      const experiments: Experiment[] = [
        {
          id: 'exp-1',
          name: 'Experiment 1',
          variants: [{ id: 'control', name: 'Control', weight: 100 }],
          status: 'active',
          startDate: new Date().toISOString(),
          targeting: {},
        },
        {
          id: 'exp-2',
          name: 'Experiment 2',
          variants: [{ id: 'control', name: 'Control', weight: 100 }],
          status: 'paused',
          startDate: new Date().toISOString(),
          targeting: {},
        },
      ];

      experiments.forEach((exp) => service.createExperiment(exp));
      const allExperiments = service.getAllExperiments();

      expect(allExperiments).toHaveLength(2);
      expect(allExperiments.map((e) => e.id)).toEqual(['exp-1', 'exp-2']);
    });
  });

  describe('variant assignment', () => {
    it('should assign user to variant based on weights', () => {
      const experiment: Experiment = {
        id: 'weight-test',
        name: 'Weight Test',
        variants: [
          { id: 'control', name: 'Control', weight: 70 },
          { id: 'variant-a', name: 'Variant A', weight: 30 },
        ],
        status: 'active',
        startDate: new Date().toISOString(),
        targeting: {},
      };

      service.createExperiment(experiment);
      service.setUser(mockUser);

      const variant = service.getVariant('weight-test');
      expect(['control', 'variant-a']).toContain(variant);
    });

    it('should return control for inactive experiments', () => {
      const experiment: Experiment = {
        id: 'inactive-test',
        name: 'Inactive Test',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'paused',
        startDate: new Date().toISOString(),
        targeting: {},
      };

      service.createExperiment(experiment);
      service.setUser(mockUser);

      const variant = service.getVariant('inactive-test');
      expect(variant).toBe('control');
    });

    it('should persist variant assignments', () => {
      const experiment: Experiment = {
        id: 'persist-test',
        name: 'Persist Test',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'active',
        startDate: new Date().toISOString(),
        targeting: {},
      };

      service.createExperiment(experiment);
      service.setUser(mockUser);

      const firstAssignment = service.getVariant('persist-test');
      const secondAssignment = service.getVariant('persist-test');

      expect(firstAssignment).toBe(secondAssignment);
    });

    it('should handle forced variants', () => {
      const experiment: Experiment = {
        id: 'force-test',
        name: 'Force Test',
        variants: [
          { id: 'control', name: 'Control', weight: 100 },
          { id: 'variant-a', name: 'Variant A', weight: 0 },
        ],
        status: 'active',
        startDate: new Date().toISOString(),
        targeting: {},
      };

      service.createExperiment(experiment);
      service.setUser(mockUser);
      service.forceVariant('force-test', 'variant-a');

      const variant = service.getVariant('force-test');
      expect(variant).toBe('variant-a');
    });
  });

  describe('targeting', () => {
    it('should respect user property targeting', () => {
      const experiment: Experiment = {
        id: 'targeting-test',
        name: 'Targeting Test',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'active',
        startDate: new Date().toISOString(),
        targeting: {
          userProperties: {
            plan: ['premium', 'enterprise'],
          },
        },
      };

      service.createExperiment(experiment);

      // Premium user should be included
      service.setUser(mockUser);
      const premiumVariant = service.getVariant('targeting-test');
      expect(['control', 'variant-a']).toContain(premiumVariant);

      // Free user should get control
      service.setUser({
        ...mockUser,
        properties: { ...mockUser.properties, plan: 'free' },
      });
      const freeVariant = service.getVariant('targeting-test');
      expect(freeVariant).toBe('control');
    });

    it('should respect percentage targeting', () => {
      const experiment: Experiment = {
        id: 'percentage-test',
        name: 'Percentage Test',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'active',
        startDate: new Date().toISOString(),
        targeting: {
          percentage: 50, // Only 50% of users should be in experiment
        },
      };

      service.createExperiment(experiment);

      // Test with multiple users
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        service.setUser({
          id: `user-${i}`,
          email: `user${i}@example.com`,
          properties: {},
        });
        results.add(service.getVariant('percentage-test'));
      }

      // Some users should get control due to percentage targeting
      expect(results.has('control')).toBe(true);
    });

    it('should handle date-based targeting', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const futureExperiment: Experiment = {
        id: 'future-test',
        name: 'Future Test',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'active',
        startDate: futureDate.toISOString(),
        targeting: {},
      };

      const pastExperiment: Experiment = {
        id: 'past-test',
        name: 'Past Test',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'active',
        startDate: pastDate.toISOString(),
        endDate: pastDate.toISOString(),
        targeting: {},
      };

      service.createExperiment(futureExperiment);
      service.createExperiment(pastExperiment);
      service.setUser(mockUser);

      // Future experiment should return control
      expect(service.getVariant('future-test')).toBe('control');

      // Past experiment should return control
      expect(service.getVariant('past-test')).toBe('control');
    });
  });

  describe('event tracking', () => {
    it('should track events for experiments', () => {
      const experiment: Experiment = {
        id: 'tracking-test',
        name: 'Tracking Test',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'active',
        startDate: new Date().toISOString(),
        targeting: {},
      };

      service.createExperiment(experiment);
      service.setUser(mockUser);

      const variant = service.getVariant('tracking-test');
      service.trackEvent('button_click', { buttonId: 'cta' });

      const events = service.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventName: 'button_click',
        userId: mockUser.id,
        experiments: {
          'tracking-test': variant,
        },
        properties: { buttonId: 'cta' },
      });
    });

    it('should track conversion events', () => {
      const experiment: Experiment = {
        id: 'conversion-test',
        name: 'Conversion Test',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'active',
        startDate: new Date().toISOString(),
        targeting: {},
      };

      service.createExperiment(experiment);
      service.setUser(mockUser);

      service.getVariant('conversion-test');
      service.trackConversion('purchase', 99.99);

      const events = service.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventName: 'conversion',
        properties: {
          conversionType: 'purchase',
          value: 99.99,
        },
      });
    });
  });

  describe('feature flags', () => {
    it('should handle boolean feature flags', () => {
      service.setFeatureFlag('new-feature', true);
      expect(service.isFeatureEnabled('new-feature')).toBe(true);

      service.setFeatureFlag('new-feature', false);
      expect(service.isFeatureEnabled('new-feature')).toBe(false);
    });

    it('should handle feature flags with values', () => {
      service.setFeatureFlag('button-color', 'blue');
      expect(service.getFeatureFlagValue('button-color')).toBe('blue');

      service.setFeatureFlag('max-items', 10);
      expect(service.getFeatureFlagValue('max-items')).toBe(10);
    });

    it('should return defaults for missing flags', () => {
      expect(service.isFeatureEnabled('non-existent')).toBe(false);
      expect(service.getFeatureFlagValue('non-existent', 'default')).toBe('default');
    });
  });

  describe('persistence', () => {
    it('should persist assignments to localStorage', () => {
      const experiment: Experiment = {
        id: 'storage-test',
        name: 'Storage Test',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant-a', name: 'Variant A', weight: 50 },
        ],
        status: 'active',
        startDate: new Date().toISOString(),
        targeting: {},
      };

      service.createExperiment(experiment);
      service.setUser(mockUser);

      const variant = service.getVariant('storage-test');

      const stored = localStorage.getItem(`ab_assignment_${mockUser.id}_storage-test`);
      expect(stored).toBe(variant);
    });

    it('should persist feature flags to localStorage', () => {
      service.setFeatureFlag('persisted-flag', 'test-value');

      const stored = localStorage.getItem('ab_feature_flags');
      const flags = JSON.parse(stored || '{}');
      expect(flags['persisted-flag']).toBe('test-value');
    });
  });

  describe('integration with analytics', () => {
    it('should track all active experiments', () => {
      const experiments: Experiment[] = [
        {
          id: 'exp-1',
          name: 'Experiment 1',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant-a', name: 'Variant A', weight: 50 },
          ],
          status: 'active',
          startDate: new Date().toISOString(),
          targeting: {},
        },
        {
          id: 'exp-2',
          name: 'Experiment 2',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant-b', name: 'Variant B', weight: 50 },
          ],
          status: 'active',
          startDate: new Date().toISOString(),
          targeting: {},
        },
      ];

      experiments.forEach((exp) => service.createExperiment(exp));
      service.setUser(mockUser);

      // Get variants to establish assignments
      service.getVariant('exp-1');
      service.getVariant('exp-2');

      const activeExperiments = service.getActiveExperiments();
      expect(Object.keys(activeExperiments)).toHaveLength(2);
      expect(activeExperiments).toHaveProperty('exp-1');
      expect(activeExperiments).toHaveProperty('exp-2');
    });
  });
});
