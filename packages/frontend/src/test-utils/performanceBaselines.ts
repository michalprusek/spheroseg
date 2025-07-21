/**
 * Performance baselines for test assertions
 * These values represent the maximum acceptable time for various operations
 */

export const PERFORMANCE_BASELINES = {
  // Component render times (ms)
  render: {
    simple: 20,      // Simple components with minimal logic
    standard: 50,    // Standard components with state
    complex: 100,    // Complex components with heavy computation
    page: 200,       // Full page renders
  },
  
  // API call times (ms)
  api: {
    local: 50,       // Local API calls
    remote: 200,     // Remote API calls
    upload: 5000,    // File upload operations
    download: 3000,  // File download operations
  },
  
  // Data processing times (ms)
  processing: {
    small: 10,       // < 100 items
    medium: 50,      // 100-1000 items
    large: 200,      // 1000-10000 items
    xlarge: 1000,    // > 10000 items
  },
  
  // Memory usage limits (MB)
  memory: {
    component: 10,   // Single component
    page: 50,        // Full page
    app: 200,        // Entire application
    test: 100,       // Single test suite
  },
  
  // Test execution times (ms)
  test: {
    unit: 100,       // Single unit test
    integration: 500, // Integration test
    e2e: 5000,       // End-to-end test
    suite: 30000,    // Full test suite
  },
  
  // Animation and interaction times (ms)
  interaction: {
    immediate: 16,   // Single frame (60fps)
    fast: 100,       // Snappy interaction
    normal: 300,     // Standard interaction
    slow: 1000,      // Complex interaction
  },
} as const;

/**
 * Helper function to get baseline for a specific operation
 */
export function getBaseline(category: keyof typeof PERFORMANCE_BASELINES, type: string): number {
  const categoryBaselines = PERFORMANCE_BASELINES[category];
  return (categoryBaselines as any)[type] || 100; // Default to 100ms if not found
}

/**
 * Performance assertion helpers
 */
export const performanceExpectations = {
  /**
   * Assert that a duration is within the expected baseline
   */
  expectWithinBaseline: (
    duration: number, 
    category: keyof typeof PERFORMANCE_BASELINES, 
    type: string
  ): void => {
    const baseline = getBaseline(category, type);
    if (duration > baseline) {
      throw new Error(
        `Performance baseline exceeded: ${duration.toFixed(2)}ms > ${baseline}ms for ${category}.${type}`
      );
    }
  },
  
  /**
   * Assert with tolerance (allows some variance)
   */
  expectWithinTolerance: (
    duration: number, 
    baseline: number, 
    tolerancePercent: number = 10
  ): void => {
    const maxAllowed = baseline * (1 + tolerancePercent / 100);
    if (duration > maxAllowed) {
      throw new Error(
        `Performance exceeded tolerance: ${duration.toFixed(2)}ms > ${maxAllowed.toFixed(2)}ms (${baseline}ms + ${tolerancePercent}%)`
      );
    }
  },
  
  /**
   * Get performance rating based on baselines
   */
  getPerformanceRating: (duration: number, baseline: number): 'excellent' | 'good' | 'acceptable' | 'poor' => {
    const ratio = duration / baseline;
    if (ratio <= 0.5) return 'excellent';
    if (ratio <= 0.8) return 'good';
    if (ratio <= 1.0) return 'acceptable';
    return 'poor';
  },
};

export default PERFORMANCE_BASELINES;