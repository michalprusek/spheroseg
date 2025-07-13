import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ABTest, FeatureFlag, ABTestingDebugPanel } from '../ABTesting';
import { ABTestingService } from '@/services/abTesting/abTestingService';
import { ABTestingProvider } from '../../services/abTesting/ABTestingContext';

// Mock the ABTestingService
vi.mock('@/services/abTesting/abTestingService');

describe('ABTesting Components', () => {
  let mockService: jest.Mocked<ABTestingService>;

  beforeEach(() => {
    mockService = new ABTestingService() as jest.Mocked<ABTestingService>;
    mockService.getVariant = vi.fn().mockReturnValue('control');
    mockService.isFeatureEnabled = vi.fn().mockReturnValue(false);
    mockService.getFeatureFlagValue = vi.fn().mockReturnValue(undefined);
    mockService.getAllExperiments = vi.fn().mockReturnValue([]);
    mockService.getActiveExperiments = vi.fn().mockReturnValue({});
    mockService.forceVariant = vi.fn();
    mockService.clearForcedVariants = vi.fn();
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ABTestingProvider service={mockService}>
      {children}
    </ABTestingProvider>
  );

  describe('ABTest', () => {
    it('should render control variant by default', () => {
      mockService.getVariant.mockReturnValue('control');

      render(
        <TestWrapper>
          <ABTest experimentId="test-experiment">
            <ABTest.Control>
              <div>Control Content</div>
            </ABTest.Control>
            <ABTest.Variant name="variant-a">
              <div>Variant A Content</div>
            </ABTest.Variant>
          </ABTest>
        </TestWrapper>
      );

      expect(screen.getByText('Control Content')).toBeInTheDocument();
      expect(screen.queryByText('Variant A Content')).not.toBeInTheDocument();
    });

    it('should render specific variant when assigned', () => {
      mockService.getVariant.mockReturnValue('variant-a');

      render(
        <TestWrapper>
          <ABTest experimentId="test-experiment">
            <ABTest.Control>
              <div>Control Content</div>
            </ABTest.Control>
            <ABTest.Variant name="variant-a">
              <div>Variant A Content</div>
            </ABTest.Variant>
            <ABTest.Variant name="variant-b">
              <div>Variant B Content</div>
            </ABTest.Variant>
          </ABTest>
        </TestWrapper>
      );

      expect(screen.queryByText('Control Content')).not.toBeInTheDocument();
      expect(screen.getByText('Variant A Content')).toBeInTheDocument();
      expect(screen.queryByText('Variant B Content')).not.toBeInTheDocument();
    });

    it('should render fallback when no matching variant', () => {
      mockService.getVariant.mockReturnValue('unknown-variant');

      render(
        <TestWrapper>
          <ABTest experimentId="test-experiment" fallback={<div>Fallback Content</div>}>
            <ABTest.Control>
              <div>Control Content</div>
            </ABTest.Control>
            <ABTest.Variant name="variant-a">
              <div>Variant A Content</div>
            </ABTest.Variant>
          </ABTest>
        </TestWrapper>
      );

      expect(screen.getByText('Fallback Content')).toBeInTheDocument();
    });

    it('should handle multiple variants', () => {
      mockService.getVariant.mockReturnValue('variant-b');

      render(
        <TestWrapper>
          <ABTest experimentId="multi-variant-test">
            <ABTest.Control>Control</ABTest.Control>
            <ABTest.Variant name="variant-a">Variant A</ABTest.Variant>
            <ABTest.Variant name="variant-b">Variant B</ABTest.Variant>
            <ABTest.Variant name="variant-c">Variant C</ABTest.Variant>
          </ABTest>
        </TestWrapper>
      );

      expect(screen.getByText('Variant B')).toBeInTheDocument();
      expect(screen.queryByText('Control')).not.toBeInTheDocument();
      expect(screen.queryByText('Variant A')).not.toBeInTheDocument();
      expect(screen.queryByText('Variant C')).not.toBeInTheDocument();
    });

    it('should work without ABTestingProvider', () => {
      render(
        <ABTest experimentId="no-provider-test">
          <ABTest.Control>
            <div>Default Control</div>
          </ABTest.Control>
          <ABTest.Variant name="variant-a">
            <div>Should Not Render</div>
          </ABTest.Variant>
        </ABTest>
      );

      expect(screen.getByText('Default Control')).toBeInTheDocument();
      expect(screen.queryByText('Should Not Render')).not.toBeInTheDocument();
    });
  });

  describe('FeatureFlag', () => {
    it('should render children when feature is enabled', () => {
      mockService.isFeatureEnabled.mockReturnValue(true);

      render(
        <TestWrapper>
          <FeatureFlag flag="new-feature">
            <div>Feature Content</div>
          </FeatureFlag>
        </TestWrapper>
      );

      expect(screen.getByText('Feature Content')).toBeInTheDocument();
    });

    it('should not render children when feature is disabled', () => {
      mockService.isFeatureEnabled.mockReturnValue(false);

      render(
        <TestWrapper>
          <FeatureFlag flag="disabled-feature">
            <div>Hidden Content</div>
          </FeatureFlag>
        </TestWrapper>
      );

      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();
    });

    it('should render fallback when feature is disabled', () => {
      mockService.isFeatureEnabled.mockReturnValue(false);

      render(
        <TestWrapper>
          <FeatureFlag 
            flag="disabled-feature" 
            fallback={<div>Feature Coming Soon</div>}
          >
            <div>Hidden Content</div>
          </FeatureFlag>
        </TestWrapper>
      );

      expect(screen.getByText('Feature Coming Soon')).toBeInTheDocument();
      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();
    });

    it('should work with inverted logic', () => {
      mockService.isFeatureEnabled.mockReturnValue(true);

      render(
        <TestWrapper>
          <FeatureFlag flag="old-feature" invert>
            <div>Legacy Content</div>
          </FeatureFlag>
        </TestWrapper>
      );

      expect(screen.queryByText('Legacy Content')).not.toBeInTheDocument();
    });

    it('should handle feature flags with values', () => {
      mockService.getFeatureFlagValue.mockReturnValue('premium');

      render(
        <TestWrapper>
          <FeatureFlag flag="user-tier" value="premium">
            <div>Premium Content</div>
          </FeatureFlag>
        </TestWrapper>
      );

      expect(screen.getByText('Premium Content')).toBeInTheDocument();
    });

    it('should not render when flag value does not match', () => {
      mockService.getFeatureFlagValue.mockReturnValue('basic');

      render(
        <TestWrapper>
          <FeatureFlag flag="user-tier" value="premium">
            <div>Premium Content</div>
          </FeatureFlag>
        </TestWrapper>
      );

      expect(screen.queryByText('Premium Content')).not.toBeInTheDocument();
    });
  });

  describe('ABTestingDebugPanel', () => {
    it('should not render in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <TestWrapper>
          <ABTestingDebugPanel />
        </TestWrapper>
      );

      expect(screen.queryByText(/A\/B Testing Debug Panel/i)).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should render in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockService.getAllExperiments.mockReturnValue([
        {
          id: 'test-exp',
          name: 'Test Experiment',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant-a', name: 'Variant A', weight: 50 }
          ],
          status: 'active',
          startDate: new Date().toISOString(),
          targeting: {}
        }
      ]);

      mockService.getActiveExperiments.mockReturnValue({
        'test-exp': 'variant-a'
      });

      render(
        <TestWrapper>
          <ABTestingDebugPanel />
        </TestWrapper>
      );

      expect(screen.getByText(/A\/B Testing Debug Panel/i)).toBeInTheDocument();
      expect(screen.getByText('Test Experiment')).toBeInTheDocument();
      expect(screen.getByText(/variant-a/i)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should allow forcing variants in debug panel', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockService.getAllExperiments.mockReturnValue([
        {
          id: 'force-test',
          name: 'Force Test',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant-a', name: 'Variant A', weight: 50 }
          ],
          status: 'active',
          startDate: new Date().toISOString(),
          targeting: {}
        }
      ]);

      const { container } = render(
        <TestWrapper>
          <ABTestingDebugPanel />
        </TestWrapper>
      );

      // Check that select element exists for forcing variants
      const selects = container.querySelectorAll('select');
      expect(selects.length).toBeGreaterThan(0);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('integration scenarios', () => {
    it('should handle nested ABTests', () => {
      mockService.getVariant
        .mockReturnValueOnce('variant-a')
        .mockReturnValueOnce('control');

      render(
        <TestWrapper>
          <ABTest experimentId="outer-test">
            <ABTest.Control>
              <div>Outer Control</div>
            </ABTest.Control>
            <ABTest.Variant name="variant-a">
              <ABTest experimentId="inner-test">
                <ABTest.Control>
                  <div>Inner Control</div>
                </ABTest.Control>
                <ABTest.Variant name="variant-b">
                  <div>Inner Variant</div>
                </ABTest.Variant>
              </ABTest>
            </ABTest.Variant>
          </ABTest>
        </TestWrapper>
      );

      expect(screen.getByText('Inner Control')).toBeInTheDocument();
    });

    it('should work with FeatureFlag inside ABTest', () => {
      mockService.getVariant.mockReturnValue('variant-a');
      mockService.isFeatureEnabled.mockReturnValue(true);

      render(
        <TestWrapper>
          <ABTest experimentId="combo-test">
            <ABTest.Control>
              <div>Control</div>
            </ABTest.Control>
            <ABTest.Variant name="variant-a">
              <FeatureFlag flag="extra-feature">
                <div>Variant with Feature</div>
              </FeatureFlag>
            </ABTest.Variant>
          </ABTest>
        </TestWrapper>
      );

      expect(screen.getByText('Variant with Feature')).toBeInTheDocument();
    });
  });
});