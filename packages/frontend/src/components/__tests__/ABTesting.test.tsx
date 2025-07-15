import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  FeatureFlag,
  Experiment,
  Variant,
  VariantSwitch,
  ABTestDebugPanel,
  TrackEvent,
  TrackConversion,
} from '../ABTesting';

// Mock the hooks
vi.mock('@/hooks/useABTesting', () => ({
  useFeatureFlag: vi.fn(),
  useVariant: vi.fn(),
  useVariants: vi.fn(),
  useActiveExperiments: vi.fn(),
  useABTestingMetrics: vi.fn(),
}));

import {
  useFeatureFlag,
  useVariant,
  useVariants,
  useActiveExperiments,
  useABTestingMetrics,
} from '@/hooks/useABTesting';

describe('ABTesting Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FeatureFlag', () => {
    it('should render children when feature is enabled', () => {
      (useFeatureFlag as Mock).mockReturnValue(true);

      render(
        <FeatureFlag flag="new-feature">
          <div>Feature Content</div>
        </FeatureFlag>,
      );

      expect(screen.getByText('Feature Content')).toBeInTheDocument();
    });

    it('should not render children when feature is disabled', () => {
      (useFeatureFlag as Mock).mockReturnValue(false);

      render(
        <FeatureFlag flag="disabled-feature">
          <div>Hidden Content</div>
        </FeatureFlag>,
      );

      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();
    });

    it('should render fallback when feature is disabled', () => {
      (useFeatureFlag as Mock).mockReturnValue(false);

      render(
        <FeatureFlag flag="disabled-feature" fallback={<div>Feature Coming Soon</div>}>
          <div>Hidden Content</div>
        </FeatureFlag>,
      );

      expect(screen.getByText('Feature Coming Soon')).toBeInTheDocument();
      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();
    });
  });

  describe('Experiment', () => {
    it('should render based on variant', () => {
      (useVariants as Mock).mockReturnValue({
        variant: 'control',
        isInExperiment: true,
        features: {},
      });

      render(
        <Experiment experimentId="test-experiment">
          {(variant, features) => <div>Current variant: {variant}</div>}
        </Experiment>,
      );

      expect(screen.getByText('Current variant: control')).toBeInTheDocument();
    });

    it('should render fallback when not in experiment', () => {
      (useVariants as Mock).mockReturnValue({
        variant: null,
        isInExperiment: false,
        features: {},
      });

      render(
        <Experiment experimentId="test-experiment" fallback={<div>Not in experiment</div>}>
          {(variant, features) => <div>Current variant: {variant}</div>}
        </Experiment>,
      );

      expect(screen.getByText('Not in experiment')).toBeInTheDocument();
    });

    it('should pass features to render function', () => {
      (useVariants as Mock).mockReturnValue({
        variant: 'treatment',
        isInExperiment: true,
        features: { newUI: true, darkMode: false },
      });

      render(
        <Experiment experimentId="test-experiment">
          {(variant, features) => (
            <div>
              Variant: {variant}, New UI: {features.newUI ? 'Yes' : 'No'}
            </div>
          )}
        </Experiment>,
      );

      expect(screen.getByText('Variant: treatment, New UI: Yes')).toBeInTheDocument();
    });
  });

  describe('Variant', () => {
    it('should render when variant matches', () => {
      (useVariant as Mock).mockReturnValue(true);

      render(
        <Variant experimentId="test" variantId="variant-a">
          <div>Variant A Content</div>
        </Variant>,
      );

      expect(screen.getByText('Variant A Content')).toBeInTheDocument();
    });

    it('should not render when variant does not match', () => {
      (useVariant as Mock).mockReturnValue(false);

      render(
        <Variant experimentId="test" variantId="variant-a">
          <div>Variant A Content</div>
        </Variant>,
      );

      expect(screen.queryByText('Variant A Content')).not.toBeInTheDocument();
    });
  });

  describe('VariantSwitch', () => {
    it('should render matching variant child', () => {
      (useVariants as Mock).mockReturnValue({
        variant: 'variant-a',
        isInExperiment: true,
        features: {},
      });

      render(
        <VariantSwitch experimentId="test">
          <Variant experimentId="test" variantId="control">
            <div>Control Content</div>
          </Variant>
          <Variant experimentId="test" variantId="variant-a">
            <div>Variant A Content</div>
          </Variant>
          <Variant experimentId="test" variantId="variant-b">
            <div>Variant B Content</div>
          </Variant>
        </VariantSwitch>,
      );

      // Mock useVariant to return true for the matching variant
      (useVariant as Mock).mockImplementation((expId, varId) => varId === 'variant-a');

      // Re-render to apply the mock
      const { rerender } = render(
        <VariantSwitch experimentId="test">
          <Variant experimentId="test" variantId="control">
            <div>Control Content</div>
          </Variant>
          <Variant experimentId="test" variantId="variant-a">
            <div>Variant A Content</div>
          </Variant>
          <Variant experimentId="test" variantId="variant-b">
            <div>Variant B Content</div>
          </Variant>
        </VariantSwitch>,
      );

      expect(screen.getByText('Variant A Content')).toBeInTheDocument();
    });

    it('should render fallback when not in experiment', () => {
      (useVariants as Mock).mockReturnValue({
        variant: null,
        isInExperiment: false,
        features: {},
      });

      render(
        <VariantSwitch experimentId="test" fallback={<div>Default Content</div>}>
          <Variant experimentId="test" variantId="variant-a">
            <div>Variant A</div>
          </Variant>
        </VariantSwitch>,
      );

      expect(screen.getByText('Default Content')).toBeInTheDocument();
    });
  });

  describe('TrackEvent', () => {
    let trackEventMock: Mock;

    beforeEach(() => {
      trackEventMock = vi.fn();
      (useABTestingMetrics as Mock).mockReturnValue({
        trackEvent: trackEventMock,
        trackConversion: vi.fn(),
      });
    });

    it('should track event on mount when trigger is mount', () => {
      render(
        <TrackEvent event="page_view" properties={{ page: 'home' }} trigger="mount">
          <div>Content</div>
        </TrackEvent>,
      );

      expect(trackEventMock).toHaveBeenCalledWith('page_view', { page: 'home' });
    });

    it('should track event on click when trigger is click', () => {
      render(
        <TrackEvent event="button_click" trigger="click">
          <button>Click me</button>
        </TrackEvent>,
      );

      expect(trackEventMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText('Click me'));

      expect(trackEventMock).toHaveBeenCalledWith('button_click', undefined);
    });

    it('should track event on hover when trigger is hover', () => {
      render(
        <TrackEvent event="element_hover" trigger="hover">
          <div>Hover me</div>
        </TrackEvent>,
      );

      expect(trackEventMock).not.toHaveBeenCalled();

      fireEvent.mouseEnter(screen.getByText('Hover me'));

      expect(trackEventMock).toHaveBeenCalledWith('element_hover', undefined);
    });

    it('should wrap non-element children in div', () => {
      render(
        <TrackEvent event="text_click" trigger="click">
          Just text
        </TrackEvent>,
      );

      const wrapper = screen.getByText('Just text');
      expect(wrapper.tagName).toBe('DIV');
    });
  });

  describe('TrackConversion', () => {
    let trackConversionMock: Mock;

    beforeEach(() => {
      trackConversionMock = vi.fn();
      (useABTestingMetrics as Mock).mockReturnValue({
        trackEvent: vi.fn(),
        trackConversion: trackConversionMock,
      });
    });

    it('should track conversion on mount when trigger is mount', () => {
      render(
        <TrackConversion name="signup" value={100} trigger="mount">
          <div>Content</div>
        </TrackConversion>,
      );

      expect(trackConversionMock).toHaveBeenCalledWith('signup', 100);
    });

    it('should track conversion on click when trigger is click', () => {
      render(
        <TrackConversion name="purchase" value={50} trigger="click">
          <button>Buy Now</button>
        </TrackConversion>,
      );

      expect(trackConversionMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText('Buy Now'));

      expect(trackConversionMock).toHaveBeenCalledWith('purchase', 50);
    });

    it('should handle React elements as children', () => {
      render(
        <TrackConversion name="cta_click" trigger="click">
          <button className="cta">Click Here</button>
        </TrackConversion>,
      );

      const button = screen.getByText('Click Here');
      expect(button.tagName).toBe('BUTTON');
      expect(button.className).toBe('cta');
    });
  });

  describe('ABTestDebugPanel', () => {
    it('should not render when show is false', () => {
      (useActiveExperiments as Mock).mockReturnValue([]);

      render(<ABTestDebugPanel show={false} />);

      expect(screen.queryByText('A/B Testing Debug')).not.toBeInTheDocument();
    });

    it('should not render when no experiments', () => {
      (useActiveExperiments as Mock).mockReturnValue([]);

      render(<ABTestDebugPanel show={true} />);

      expect(screen.queryByText('A/B Testing Debug')).not.toBeInTheDocument();
    });

    it('should render debug panel with experiments', () => {
      (useActiveExperiments as Mock).mockReturnValue([
        {
          key: 'test-experiment',
          experiment: 'new-ui-test',
          variant: 'treatment',
          value: true,
        },
        {
          key: 'feature.flag',
          experiment: null,
          variant: null,
          value: 'premium',
        },
      ]);

      render(<ABTestDebugPanel show={true} />);

      expect(screen.getByText('A/B Testing Debug')).toBeInTheDocument();
      expect(screen.getByText('test-experiment')).toBeInTheDocument();
      expect(screen.getByText('Experiment: new-ui-test')).toBeInTheDocument();
      expect(screen.getByText('Variant: treatment')).toBeInTheDocument();
      expect(screen.getByText('feature.flag')).toBeInTheDocument();
      expect(screen.getByText('Experiment: none')).toBeInTheDocument();
      expect(screen.getByText('Variant: control')).toBeInTheDocument();
    });

    it('should render in development by default', () => {
      const originalEnv = import.meta.env.DEV;
      // @ts-ignore
      import.meta.env.DEV = true;

      (useActiveExperiments as Mock).mockReturnValue([{ key: 'test', experiment: 'exp', variant: 'v1', value: true }]);

      render(<ABTestDebugPanel />);

      expect(screen.getByText('A/B Testing Debug')).toBeInTheDocument();

      // @ts-ignore
      import.meta.env.DEV = originalEnv;
    });
  });
});
