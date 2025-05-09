import { performance } from 'perf_hooks';
import { ReactElement } from 'react';
import { render } from '@testing-library/react';

/**
 * Utility for performance testing of React components
 */
export interface PerformanceTestOptions {
  /** Number of times to render the component */
  iterations?: number;
  /** Milliseconds to allow for component to stabilize */
  warmupTime?: number;
  /** Maximum acceptable average render time in milliseconds */
  maxRenderTime?: number;
  /** Print detailed results to console */
  verbose?: boolean;
}

export interface PerformanceResult {
  averageRenderTime: number;
  minRenderTime: number;
  maxRenderTime: number;
  totalTime: number;
  iterations: number;
  passes: boolean;
}

/**
 * Test the rendering performance of a React component
 * 
 * @param component The React component to test
 * @param options Configuration options for the test
 * @returns Performance test results
 */
export async function testRenderPerformance(
  component: ReactElement,
  options: PerformanceTestOptions = {}
): Promise<PerformanceResult> {
  const {
    iterations = 100,
    warmupTime = 100,
    maxRenderTime = 16.67, // 60fps target (1000ms / 60 ≈ 16.67ms)
    verbose = false
  } = options;

  // Warmup phase
  render(component);
  await new Promise(resolve => setTimeout(resolve, warmupTime));

  const renderTimes: number[] = [];
  let totalTime = 0;

  // Measurement phase
  for (let i = 0; i < iterations; i++) {
    // Clean up between iterations
    if (i > 0) {
      // Use JSDOM cleanup
      document.body.innerHTML = '';
    }

    const startTime = performance.now();
    render(component);
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    renderTimes.push(renderTime);
    totalTime += renderTime;
  }

  // Calculate results
  const averageRenderTime = totalTime / iterations;
  const minRenderTime = Math.min(...renderTimes);
  const maxRenderTime = Math.max(...renderTimes);
  const passes = averageRenderTime <= maxRenderTime;

  // Log results if verbose
  if (verbose) {
    console.log('Performance Test Results:');
    console.log(`  Component: ${component.type?.name || 'Anonymous Component'}`);
    console.log(`  Average Render Time: ${averageRenderTime.toFixed(2)}ms`);
    console.log(`  Min Render Time: ${minRenderTime.toFixed(2)}ms`);
    console.log(`  Max Render Time: ${maxRenderTime.toFixed(2)}ms`);
    console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Iterations: ${iterations}`);
    console.log(`  Result: ${passes ? 'PASS' : 'FAIL'} (max: ${maxRenderTime}ms)`);
    
    // Add histogram for more detailed view
    if (iterations >= 10) {
      const histogram = createHistogram(renderTimes);
      console.log('\n  Render Time Distribution:');
      console.log(histogram);
    }
  }

  return {
    averageRenderTime,
    minRenderTime,
    maxRenderTime,
    totalTime,
    iterations,
    passes
  };
}

/**
 * Create a simple ASCII histogram from data points
 */
function createHistogram(data: number[], buckets = 10): string {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  const bucketSize = range / buckets;
  
  // Create empty buckets
  const histogram = Array(buckets).fill(0);
  
  // Fill the buckets
  data.forEach(value => {
    const bucketIndex = Math.min(
      Math.floor((value - min) / bucketSize),
      buckets - 1
    );
    histogram[bucketIndex]++;
  });
  
  // Find the maximum count for scaling
  const maxCount = Math.max(...histogram);
  
  // Generate the ASCII histogram
  let result = '';
  histogram.forEach((count, i) => {
    const lowerBound = (min + i * bucketSize).toFixed(2);
    const upperBound = (min + (i + 1) * bucketSize).toFixed(2);
    const bar = '█'.repeat(Math.ceil((count / maxCount) * 20));
    result += `  ${lowerBound} - ${upperBound} ms | ${bar} (${count})\n`;
  });
  
  return result;
}

/**
 * Compare the performance of two component implementations
 * 
 * @param component1 First component implementation
 * @param component2 Second component implementation
 * @param options Test configuration options
 * @returns Comparison of performance results
 */
export async function compareComponentPerformance(
  component1: ReactElement,
  component2: ReactElement,
  componentNames: [string, string],
  options: PerformanceTestOptions = {}
): Promise<{
  component1: PerformanceResult,
  component2: PerformanceResult,
  difference: number,
  percentageChange: number,
  fasterComponent: 0 | 1 | null
}> {
  // Test both components
  const result1 = await testRenderPerformance(component1, { ...options, verbose: false });
  const result2 = await testRenderPerformance(component2, { ...options, verbose: false });
  
  // Calculate difference
  const difference = result1.averageRenderTime - result2.averageRenderTime;
  const percentageChange = (difference / result1.averageRenderTime) * 100;
  const fasterComponent = difference === 0 ? null : (difference > 0 ? 1 : 0);
  
  // Log results if verbose
  if (options.verbose) {
    console.log('Performance Comparison:');
    console.log(`  ${componentNames[0]}: ${result1.averageRenderTime.toFixed(2)}ms average`);
    console.log(`  ${componentNames[1]}: ${result2.averageRenderTime.toFixed(2)}ms average`);
    console.log(`  Difference: ${Math.abs(difference).toFixed(2)}ms`);
    console.log(`  Percentage Change: ${Math.abs(percentageChange).toFixed(2)}%`);
    
    if (fasterComponent !== null) {
      console.log(`  Result: ${componentNames[fasterComponent]} is faster by ${Math.abs(percentageChange).toFixed(2)}%`);
    } else {
      console.log('  Result: Both components have equal performance');
    }
  }
  
  return {
    component1: result1,
    component2: result2,
    difference,
    percentageChange,
    fasterComponent
  };
}