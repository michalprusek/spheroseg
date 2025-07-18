/**
 * Example implementation of A/B testing in a real component
 *
 * This demonstrates how to use the A/B testing framework in practice
 */

import React from 'react';
import {
  FeatureFlag,
  Experiment,
  Variant,
  VariantSwitch,
  TrackEvent,
  TrackConversion,
  ABTestDebugPanel,
} from '@/components/ABTesting';
import { useFeatureFlag, useExperiment, useABTestingMetrics, useVariants } from '@/hooks/useABTesting';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Example 1: Simple feature flag
 */
export function NewFeatureButton() {
  const showNewFeature = useFeatureFlag('feature.new-button-design', false);
  const { trackEvent } = useABTestingMetrics();

  const handleClick = () => {
    trackEvent('button_clicked', {
      feature: 'new-button-design',
      enabled: showNewFeature,
    });
  };

  if (!showNewFeature) {
    return (
      <Button onClick={handleClick} variant="default">
        Classic Button
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      variant="default"
      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
    >
      ✨ New Fancy Button
    </Button>
  );
}

/**
 * Example 2: Using FeatureFlag component
 */
export function ConditionalFeature() {
  return (
    <div>
      <FeatureFlag flag="feature.export.pdf" fallback={<p>PDF export coming soon!</p>}>
        <Button variant="outline">Export as PDF</Button>
      </FeatureFlag>
    </div>
  );
}

/**
 * Example 3: A/B test with variants
 */
export function PricingPageExample() {
  const { trackConversion } = useABTestingMetrics();

  return (
    <Experiment experimentId="pricing-page-optimization">
      {(variant, features) => {
        // Different layouts based on variant
        switch (features['pricing.layout']) {
          case 'cards':
            return (
              <div className="grid grid-cols-3 gap-4">
                <PricingCard
                  plan="Basic"
                  price="$9"
                  highlighted={features['pricing.highlight-popular'] && false}
                  onSelect={() => trackConversion('pricing_plan_selected', 9)}
                />
                <PricingCard
                  plan="Pro"
                  price="$29"
                  highlighted={features['pricing.highlight-popular'] && true}
                  onSelect={() => trackConversion('pricing_plan_selected', 29)}
                />
                <PricingCard
                  plan="Enterprise"
                  price="$99"
                  highlighted={false}
                  onSelect={() => trackConversion('pricing_plan_selected', 99)}
                />
              </div>
            );

          case 'comparison':
            return <ComparisonTable onSelect={trackConversion} />;

          default:
            return <StandardPricingTable onSelect={trackConversion} />;
        }
      }}
    </Experiment>
  );
}

/**
 * Example 4: Using VariantSwitch
 */
export function OnboardingFlow() {
  return (
    <TrackEvent event="onboarding_started" trigger="mount">
      <VariantSwitch experimentId="onboarding-flow-optimization">
        <Variant experimentId="onboarding-flow-optimization" variantId="control">
          <StandardOnboarding />
        </Variant>

        <Variant experimentId="onboarding-flow-optimization" variantId="guided">
          <GuidedTutorial />
        </Variant>

        <Variant experimentId="onboarding-flow-optimization" variantId="video">
          <VideoOnboarding />
        </Variant>
      </VariantSwitch>
    </TrackEvent>
  );
}

/**
 * Example 5: Performance optimization based on experiments
 */
export function OptimizedImageGallery() {
  const enableLazyLoading = useFeatureFlag('performance.lazy-loading', false);
  const enableVirtualization = useFeatureFlag('performance.virtualization', false);

  // Track performance metrics
  const { trackEvent } = useABTestingMetrics();

  React.useEffect(() => {
    // Measure and track load time
    const loadTime = performance.now();
    trackEvent('gallery_load_time', {
      lazyLoading: enableLazyLoading,
      virtualization: enableVirtualization,
      loadTime,
    });
  }, [enableLazyLoading, enableVirtualization, trackEvent]);

  if (enableVirtualization) {
    return <VirtualizedImageGallery lazyLoad={enableLazyLoading} />;
  }

  return <StandardImageGallery lazyLoad={enableLazyLoading} />;
}

/**
 * Example 6: Tracking conversions
 */
export function UpgradePrompt() {
  const experiment = useExperiment('pricing-page-optimization');

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Upgrade to Pro</h3>

      <FeatureFlag flag="pricing.testimonials">
        <div className="mb-4 text-sm text-gray-600">
          "SpherosegV4 helped us increase productivity by 40%!" - Happy Customer
        </div>
      </FeatureFlag>

      <TrackConversion name="upgrade_button_clicked" value={29}>
        <Button className="w-full">Upgrade Now - $29/month</Button>
      </TrackConversion>
    </Card>
  );
}

/**
 * Example 7: Complex experiment with multiple features
 */
export function SegmentationToolbar() {
  const { variant, features } = useVariants('segmentation-tools-enhancement');
  const { trackEvent } = useABTestingMetrics();

  const tools = [
    { id: 'select', name: 'Select', enabled: true },
    { id: 'draw', name: 'Draw', enabled: true },
    { id: 'magic-wand', name: 'Magic Wand', enabled: features['segmentation.magic-wand'] },
    { id: 'ai-assist', name: 'AI Assist', enabled: features['segmentation.ai-assist'] },
    { id: 'batch', name: 'Batch Ops', enabled: features['segmentation.batch-operations'] },
  ];

  const handleToolSelect = (toolId: string) => {
    trackEvent('segmentation_tool_selected', {
      tool: toolId,
      variant,
      experiment: 'segmentation-tools-enhancement',
    });
  };

  return (
    <div className="flex gap-2 p-2 bg-gray-100 rounded-lg">
      {tools.map(
        (tool) =>
          tool.enabled && (
            <Button key={tool.id} variant="ghost" size="sm" onClick={() => handleToolSelect(tool.id)}>
              {tool.name}
              {tool.id === 'ai-assist' && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1 rounded">Beta</span>
              )}
            </Button>
          ),
      )}
    </div>
  );
}

/**
 * Example 8: Complete page with A/B testing
 */
export function ABTestingDemoPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">A/B Testing Examples</h1>

      <div className="grid gap-6">
        {/* Feature Flags */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Feature Flags</h2>
          <div className="flex gap-4">
            <NewFeatureButton />
            <ConditionalFeature />
          </div>
        </section>

        {/* Experiments */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Experiments</h2>
          <PricingPageExample />
        </section>

        {/* Performance */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Performance Optimizations</h2>
          <OptimizedImageGallery />
        </section>

        {/* Tools */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Enhanced Tools</h2>
          <SegmentationToolbar />
        </section>

        {/* Conversion Tracking */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Conversion Tracking</h2>
          <UpgradePrompt />
        </section>
      </div>

      {/* Debug Panel */}
      <ABTestDebugPanel show={true} />
    </div>
  );
}

// Helper components (simplified implementations)
function PricingCard({ plan, price, highlighted, onSelect }: any) {
  return (
    <Card className={`p-6 ${highlighted ? 'ring-2 ring-blue-500' : ''}`}>
      <h3 className="text-lg font-semibold">{plan}</h3>
      <p className="text-2xl font-bold mt-2">{price}/mo</p>
      <Button className="w-full mt-4" variant={highlighted ? 'default' : 'outline'} onClick={() => onSelect()}>
        Select Plan
      </Button>
    </Card>
  );
}

function ComparisonTable({ onSelect }: any) {
  return <div>Comparison Table Implementation</div>;
}

function StandardPricingTable({ onSelect }: any) {
  return <div>Standard Pricing Table</div>;
}

function StandardOnboarding() {
  return <div>Standard Onboarding Flow</div>;
}

function GuidedTutorial() {
  return <div>Guided Tutorial with Tooltips</div>;
}

function VideoOnboarding() {
  return <div>Video-based Onboarding</div>;
}

function VirtualizedImageGallery({ lazyLoad }: any) {
  return <div>Virtualized Gallery with {lazyLoad ? 'Lazy Loading' : 'Eager Loading'}</div>;
}

function StandardImageGallery({ lazyLoad }: any) {
  return <div>Standard Gallery with {lazyLoad ? 'Lazy Loading' : 'Eager Loading'}</div>;
}

export default ABTestingDemoPage;
