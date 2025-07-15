/**
 * A/B Testing Experiments Configuration
 *
 * Defines all experiments and feature flags for the application
 */

import { Experiment } from '@/services/abTesting/abTestingService';

// Experiment definitions
export const experiments: Experiment[] = [
  {
    id: 'new-ui-design-2024',
    name: 'New UI Design',
    description: 'Testing modern UI design with improved accessibility',
    status: 'running',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    variants: [
      {
        id: 'control',
        name: 'Current Design',
        weight: 50,
        isControl: true,
        features: {
          'ui.design': 'classic',
          'ui.theme': 'light',
          'ui.animations': false,
        },
      },
      {
        id: 'modern',
        name: 'Modern Design',
        weight: 50,
        features: {
          'ui.design': 'modern',
          'ui.theme': 'auto',
          'ui.animations': true,
          'ui.glassmorphism': true,
          'ui.microInteractions': true,
        },
      },
    ],
    targeting: {
      percentage: 100,
      segments: [
        {
          id: 'new-users',
          name: 'New Users',
          conditions: [
            {
              property: 'accountAge',
              operator: 'less_than',
              value: 30,
            },
          ],
        },
      ],
    },
    metrics: {
      primary: [
        {
          id: 'engagement',
          name: 'User Engagement',
          type: 'engagement',
          goal: 'increase',
        },
        {
          id: 'task-completion',
          name: 'Task Completion Rate',
          type: 'conversion',
          goal: 'increase',
        },
      ],
    },
    allocation: {
      type: 'sticky',
      seed: 'ui-design-2024',
    },
  },

  {
    id: 'onboarding-flow-optimization',
    name: 'Onboarding Flow Optimization',
    description: 'Testing different onboarding experiences',
    status: 'running',
    variants: [
      {
        id: 'control',
        name: 'Standard Flow',
        weight: 33,
        isControl: true,
        features: {
          'onboarding.type': 'standard',
          'onboarding.steps': 5,
        },
      },
      {
        id: 'guided',
        name: 'Guided Tutorial',
        weight: 33,
        features: {
          'onboarding.type': 'guided',
          'onboarding.steps': 7,
          'onboarding.tooltips': true,
          'onboarding.interactive': true,
        },
      },
      {
        id: 'video',
        name: 'Video Onboarding',
        weight: 34,
        features: {
          'onboarding.type': 'video',
          'onboarding.videoUrl': '/onboarding/welcome.mp4',
          'onboarding.skipEnabled': true,
        },
      },
    ],
    targeting: {
      segments: [
        {
          id: 'first-time-users',
          name: 'First Time Users',
          conditions: [
            {
              property: 'hasCompletedOnboarding',
              operator: 'equals',
              value: false,
            },
          ],
        },
      ],
    },
    metrics: {
      primary: [
        {
          id: 'onboarding-completion',
          name: 'Onboarding Completion',
          type: 'conversion',
          goal: 'increase',
          threshold: 80,
        },
      ],
      secondary: [
        {
          id: 'time-to-first-action',
          name: 'Time to First Action',
          type: 'custom',
          goal: 'decrease',
        },
      ],
    },
    allocation: {
      type: 'random',
    },
  },

  {
    id: 'performance-optimizations',
    name: 'Performance Optimizations',
    description: 'Testing various performance improvements',
    status: 'running',
    variants: [
      {
        id: 'control',
        name: 'Standard Performance',
        weight: 50,
        isControl: true,
        features: {
          'performance.lazy-loading': false,
          'performance.virtualization': false,
          'performance.web-workers': false,
          'performance.prefetching': false,
        },
      },
      {
        id: 'optimized',
        name: 'All Optimizations',
        weight: 50,
        features: {
          'performance.lazy-loading': true,
          'performance.virtualization': true,
          'performance.web-workers': true,
          'performance.prefetching': true,
          'performance.image-optimization': true,
          'performance.code-splitting': true,
        },
      },
    ],
    targeting: {
      deviceTargeting: {
        types: ['mobile', 'tablet'],
      },
    },
    metrics: {
      primary: [
        {
          id: 'page-load-time',
          name: 'Page Load Time',
          type: 'custom',
          goal: 'decrease',
        },
      ],
    },
    allocation: {
      type: 'sticky',
      seed: 'performance-2024',
    },
  },

  {
    id: 'segmentation-tools-enhancement',
    name: 'Segmentation Tools Enhancement',
    description: 'Testing new segmentation tools and UI',
    status: 'running',
    variants: [
      {
        id: 'control',
        name: 'Current Tools',
        weight: 50,
        isControl: true,
        features: {
          'segmentation.ai-assist': false,
          'segmentation.magic-wand': false,
          'segmentation.batch-operations': false,
        },
      },
      {
        id: 'enhanced',
        name: 'Enhanced Tools',
        weight: 50,
        features: {
          'segmentation.ai-assist': true,
          'segmentation.magic-wand': true,
          'segmentation.batch-operations': true,
          'segmentation.smart-selection': true,
          'segmentation.auto-complete': true,
        },
      },
    ],
    targeting: {
      segments: [
        {
          id: 'power-users',
          name: 'Power Users',
          conditions: [
            {
              property: 'hasUsedSegmentation',
              operator: 'equals',
              value: true,
            },
          ],
        },
      ],
    },
    metrics: {
      primary: [
        {
          id: 'segmentation-speed',
          name: 'Segmentation Speed',
          type: 'custom',
          goal: 'decrease',
        },
        {
          id: 'segmentation-accuracy',
          name: 'Segmentation Accuracy',
          type: 'custom',
          goal: 'increase',
        },
      ],
    },
    allocation: {
      type: 'sticky',
      seed: 'segmentation-tools-2024',
    },
  },

  {
    id: 'pricing-page-optimization',
    name: 'Pricing Page Optimization',
    description: 'Testing different pricing page layouts',
    status: 'running',
    variants: [
      {
        id: 'control',
        name: 'Current Pricing',
        weight: 25,
        isControl: true,
        features: {
          'pricing.layout': 'table',
          'pricing.comparison': false,
          'pricing.testimonials': false,
        },
      },
      {
        id: 'cards',
        name: 'Card Layout',
        weight: 25,
        features: {
          'pricing.layout': 'cards',
          'pricing.highlight-popular': true,
          'pricing.annual-discount-banner': true,
        },
      },
      {
        id: 'comparison',
        name: 'Comparison Table',
        weight: 25,
        features: {
          'pricing.layout': 'comparison',
          'pricing.feature-matrix': true,
          'pricing.expandable-details': true,
        },
      },
      {
        id: 'social-proof',
        name: 'Social Proof',
        weight: 25,
        features: {
          'pricing.layout': 'cards',
          'pricing.testimonials': true,
          'pricing.trust-badges': true,
          'pricing.customer-logos': true,
        },
      },
    ],
    targeting: {
      segments: [
        {
          id: 'free-users',
          name: 'Free Plan Users',
          conditions: [
            {
              property: 'plan',
              operator: 'equals',
              value: 'free',
            },
          ],
        },
      ],
    },
    metrics: {
      primary: [
        {
          id: 'upgrade-conversion',
          name: 'Upgrade Conversion',
          type: 'conversion',
          goal: 'increase',
        },
      ],
      secondary: [
        {
          id: 'pricing-page-engagement',
          name: 'Pricing Page Engagement',
          type: 'engagement',
          goal: 'increase',
        },
      ],
    },
    allocation: {
      type: 'random',
    },
  },
];

// Feature flag definitions (without experiments)
export const featureFlags = {
  // Core features
  'feature.export.formats.pdf': true,
  'feature.export.formats.pptx': false,
  'feature.collaboration.realtime': false,
  'feature.collaboration.comments': false,

  // UI features
  'ui.dark-mode': true,
  'ui.compact-mode': false,
  'ui.keyboard-shortcuts': true,

  // Performance features
  'performance.service-worker': false,
  'performance.offline-mode': false,
  'performance.background-sync': false,

  // Beta features
  'beta.3d-visualization': false,
  'beta.ai-suggestions': false,
  'beta.voice-commands': false,

  // Administrative features
  'admin.usage-analytics': true,
  'admin.audit-logs': false,
  'admin.bulk-operations': false,
};

// Experiment presets for common use cases
export const experimentPresets = {
  uiRedesign: {
    targeting: {
      percentage: 10, // Start with 10% of users
      segments: [
        {
          id: 'engaged-users',
          name: 'Engaged Users',
          conditions: [
            {
              property: 'totalProjects',
              operator: 'greater_than',
              value: 5,
            },
          ],
        },
      ],
    },
    metrics: {
      primary: [
        { id: 'user-satisfaction', name: 'User Satisfaction', type: 'custom', goal: 'increase' },
        { id: 'task-completion', name: 'Task Completion', type: 'conversion', goal: 'increase' },
      ],
    },
  },

  featureRollout: {
    targeting: {
      percentage: 5, // Start with 5% for new features
    },
    allocation: {
      type: 'sticky',
    },
  },

  performanceTest: {
    targeting: {
      deviceTargeting: {
        types: ['mobile', 'tablet'],
      },
    },
    metrics: {
      primary: [
        { id: 'load-time', name: 'Load Time', type: 'custom', goal: 'decrease' },
        { id: 'interaction-delay', name: 'Interaction Delay', type: 'custom', goal: 'decrease' },
      ],
    },
  },
};

// Export configuration
export default {
  experiments,
  featureFlags,
  experimentPresets,
};
