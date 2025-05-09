/**
 * Performance Testing Framework for SpheroSeg
 * 
 * This module provides utilities for measuring the performance of critical operations,
 * particularly related to polygon manipulation and rendering.
 */

import { Polygon, Point } from '@/pages/segmentation/types';

/**
 * Interface for performance test result
 */
export interface PerformanceResult {
  operationName: string;
  duration: number;
  dataSize: number;
  memoryUsage?: number;
  iterationCount?: number;
  averageDuration?: number;
  metadata?: Record<string, any>;
}

/**
 * Options for performance test execution
 */
export interface PerformanceTestOptions {
  iterations?: number;
  warmupIterations?: number;
  dataSize?: number;
  timeout?: number;
  logMemory?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Default options for performance tests
 */
const DEFAULT_OPTIONS: PerformanceTestOptions = {
  iterations: 1,
  warmupIterations: 0,
  dataSize: 100,
  timeout: 10000,
  logMemory: true,
  metadata: {}
};

/**
 * Measure the performance of a function
 * 
 * @param name Name of the operation
 * @param fn Function to measure
 * @param options Test options
 * @returns Performance result
 */
export async function measurePerformance<T>(
  name: string,
  fn: (dataSize: number, iteration: number) => Promise<T> | T,
  options: PerformanceTestOptions = {}
): Promise<PerformanceResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { iterations, warmupIterations, dataSize, timeout, logMemory } = opts;

  let memoryBefore: number | undefined;
  let memoryAfter: number | undefined;

  console.log(`🚀 Running performance test: ${name} with data size ${dataSize}`);

  // Warm-up phase
  if (warmupIterations > 0) {
    console.log(`🔥 Warming up with ${warmupIterations} iterations...`);
    for (let i = 0; i < warmupIterations; i++) {
      await fn(dataSize, i);
    }
  }

  // Record memory before if enabled
  if (logMemory && global.gc) {
    global.gc(); // Force garbage collection
    memoryBefore = process.memoryUsage().heapUsed;
  }

  // Setup performance measurement
  const startTime = performance.now();
  const results: number[] = [];

  // Run the function for the specified number of iterations
  for (let i = 0; i < iterations; i++) {
    const iterationStart = performance.now();
    await fn(dataSize, i);
    const iterationEnd = performance.now();
    results.push(iterationEnd - iterationStart);

    // Check for timeout
    if (performance.now() - startTime > timeout) {
      console.warn(`⚠️ Performance test "${name}" timed out after ${i + 1} iterations.`);
      break;
    }
  }

  // Calculate total duration
  const endTime = performance.now();
  const totalDuration = endTime - startTime;

  // Record memory after if enabled
  if (logMemory && global.gc) {
    global.gc(); // Force garbage collection
    memoryAfter = process.memoryUsage().heapUsed;
  }

  // Calculate statistics
  const averageDuration = results.reduce((sum, time) => sum + time, 0) / results.length;
  const minDuration = Math.min(...results);
  const maxDuration = Math.max(...results);
  const medianDuration = results.sort((a, b) => a - b)[Math.floor(results.length / 2)];

  // Log results
  console.log(`✅ Performance test ${name} completed:`);
  console.log(`   Total duration: ${totalDuration.toFixed(2)}ms`);
  console.log(`   Average duration per iteration: ${averageDuration.toFixed(2)}ms`);
  console.log(`   Min: ${minDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms, Median: ${medianDuration.toFixed(2)}ms`);
  
  if (memoryBefore !== undefined && memoryAfter !== undefined) {
    const memoryDiff = memoryAfter - memoryBefore;
    console.log(`   Memory change: ${formatMemory(memoryDiff)} (${memoryDiff > 0 ? '+' : ''}${memoryDiff})`);
  }

  // Return the result
  return {
    operationName: name,
    duration: totalDuration,
    dataSize,
    memoryUsage: memoryAfter !== undefined && memoryBefore !== undefined 
      ? memoryAfter - memoryBefore
      : undefined,
    iterationCount: results.length,
    averageDuration,
    metadata: {
      ...opts.metadata,
      min: minDuration,
      max: maxDuration,
      median: medianDuration,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Format memory size in a human-readable way
 * 
 * @param bytes Memory size in bytes
 * @returns Formatted memory size
 */
function formatMemory(bytes: number): string {
  const absBytes = Math.abs(bytes);
  const sign = bytes < 0 ? '-' : '';
  
  if (absBytes < 1024) return `${sign}${absBytes} B`;
  if (absBytes < 1024 * 1024) return `${sign}${(absBytes / 1024).toFixed(2)} KB`;
  return `${sign}${(absBytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generate a simple polygon with the specified number of points
 * 
 * @param numPoints Number of points in the polygon
 * @param centerX Center X coordinate
 * @param centerY Center Y coordinate
 * @param radius Radius of the polygon
 * @returns Polygon object
 */
export function generateTestPolygon(
  numPoints: number, 
  centerX: number = 500, 
  centerY: number = 500, 
  radius: number = 400
): Polygon {
  const points: Point[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    points.push({ x, y });
  }
  
  return {
    id: `test-polygon-${numPoints}`,
    points,
    type: 'external'
  };
}

/**
 * Generate a complex polygon with nested polygons
 * 
 * @param pointsPerPolygon Number of points per polygon
 * @param numNested Number of nested polygons
 * @returns Array of polygons
 */
export function generateComplexPolygons(
  pointsPerPolygon: number = 20, 
  numNested: number = 5
): Polygon[] {
  const polygons: Polygon[] = [];
  
  // Create main external polygon
  polygons.push(generateTestPolygon(pointsPerPolygon, 500, 500, 400));
  
  // Create nested polygons
  for (let i = 0; i < numNested; i++) {
    const angle = (i / numNested) * 2 * Math.PI;
    const centerX = 500 + 200 * Math.cos(angle);
    const centerY = 500 + 200 * Math.sin(angle);
    
    polygons.push({
      id: `nested-polygon-${i}`,
      points: generateTestPolygon(pointsPerPolygon, centerX, centerY, 50).points,
      type: 'internal'
    });
  }
  
  return polygons;
}

/**
 * Generate multiple random polygons for testing
 * 
 * @param count Number of polygons to generate
 * @param pointsPerPolygon Number of points per polygon
 * @param width Canvas width
 * @param height Canvas height
 * @returns Array of polygons
 */
export function generateRandomPolygons(
  count: number,
  pointsPerPolygon: number = 20,
  width: number = 1000,
  height: number = 1000
): Polygon[] {
  const polygons: Polygon[] = [];
  
  for (let i = 0; i < count; i++) {
    const centerX = Math.random() * width;
    const centerY = Math.random() * height;
    const radius = Math.random() * 100 + 50;
    const numPoints = Math.max(3, Math.floor(Math.random() * pointsPerPolygon));
    
    polygons.push(generateTestPolygon(numPoints, centerX, centerY, radius));
  }
  
  return polygons;
}

/**
 * Fill an array with test data
 * 
 * @param size Size of the array
 * @returns Array filled with test data
 */
export function generateTestArray<T>(size: number, generator: (index: number) => T): T[] {
  return Array.from({ length: size }, (_, i) => generator(i));
}

/**
 * Benchmark function with different data sizes
 * 
 * @param name Test name
 * @param fn Function to benchmark
 * @param dataSizes Array of data sizes to test
 * @param options Test options
 * @returns Array of performance results
 */
export async function runScalabilityTest<T>(
  name: string,
  fn: (dataSize: number, iteration: number) => Promise<T> | T,
  dataSizes: number[],
  options: PerformanceTestOptions = {}
): Promise<PerformanceResult[]> {
  const results: PerformanceResult[] = [];
  
  for (const dataSize of dataSizes) {
    const result = await measurePerformance(
      `${name} (size: ${dataSize})`,
      fn,
      { ...options, dataSize }
    );
    
    results.push(result);
  }
  
  // Log scalability summary
  console.log(`\n📊 Scalability test results for "${name}":`);
  console.log('--------------------------------------------------');
  console.log('Data Size | Avg. Duration (ms) | Memory Change');
  console.log('--------------------------------------------------');
  
  for (const result of results) {
    const memoryStr = result.memoryUsage !== undefined
      ? formatMemory(result.memoryUsage)
      : 'N/A';
    
    console.log(
      `${result.dataSize.toString().padEnd(9)} | ${
        (result.averageDuration?.toFixed(2) || 'N/A').padEnd(18)
      } | ${memoryStr}`
    );
  }
  console.log('--------------------------------------------------');
  
  return results;
}