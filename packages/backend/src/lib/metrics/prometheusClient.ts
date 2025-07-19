/**
 * Prometheus Client Compatibility Layer
 *
 * This module provides backward compatibility for prometheusClient imports
 * while using the unified monitoring registry internally.
 */

import promClient from 'prom-client';
import { unifiedRegistry } from '../../monitoring/unified';

/**
 * Prometheus client wrapper that uses the unified registry
 */
class PrometheusClient {
  private client: typeof promClient;
  private registry: promClient.Registry;
  private metrics: Map<string, promClient.Metric<string>>;
  private initialized: boolean = false;

  constructor() {
    this.client = promClient;
    // Use the unified registry instead of creating a new one
    this.registry = unifiedRegistry;
    this.metrics = new Map();
  }

  /**
   * Initialize the Prometheus client
   */
  public initialize(): void {
    if (this.initialized) return;

    // No need to configure default metrics as they're already configured in unified monitoring
    // Just mark as initialized
    this.initialized = true;
  }

  /**
   * Register a histogram metric
   */
  public registerHistogram(
    name: string,
    options: promClient.HistogramConfiguration<string>
  ): promClient.Histogram<string> {
    if (this.metrics.has(name)) {
      return this.metrics.get(name) as promClient.Histogram<string>;
    }

    // Check if metric already exists in registry
    const existingMetric = this.registry.getSingleMetric(options.name);
    if (existingMetric) {
      this.metrics.set(name, existingMetric as promClient.Histogram<string>);
      return existingMetric as promClient.Histogram<string>;
    }

    const histogram = new this.client.Histogram({
      ...options,
      registers: [this.registry],
    });
    this.metrics.set(name, histogram);
    return histogram;
  }

  /**
   * Register a counter metric
   */
  public registerCounter(
    name: string,
    options: promClient.CounterConfiguration<string>
  ): promClient.Counter<string> {
    if (this.metrics.has(name)) {
      return this.metrics.get(name) as promClient.Counter<string>;
    }

    // Check if metric already exists in registry
    const existingMetric = this.registry.getSingleMetric(options.name);
    if (existingMetric) {
      this.metrics.set(name, existingMetric as promClient.Counter<string>);
      return existingMetric as promClient.Counter<string>;
    }

    const counter = new this.client.Counter({
      ...options,
      registers: [this.registry],
    });
    this.metrics.set(name, counter);
    return counter;
  }

  /**
   * Register a gauge metric
   */
  public registerGauge(
    name: string,
    options: promClient.GaugeConfiguration<string>
  ): promClient.Gauge<string> {
    if (this.metrics.has(name)) {
      return this.metrics.get(name) as promClient.Gauge<string>;
    }

    // Check if metric already exists in registry
    const existingMetric = this.registry.getSingleMetric(options.name);
    if (existingMetric) {
      this.metrics.set(name, existingMetric as promClient.Gauge<string>);
      return existingMetric as promClient.Gauge<string>;
    }

    const gauge = new this.client.Gauge({
      ...options,
      registers: [this.registry],
    });
    this.metrics.set(name, gauge);
    return gauge;
  }

  /**
   * Register a summary metric
   */
  public registerSummary(
    name: string,
    options: promClient.SummaryConfiguration<string>
  ): promClient.Summary<string> {
    if (this.metrics.has(name)) {
      return this.metrics.get(name) as promClient.Summary<string>;
    }

    // Check if metric already exists in registry
    const existingMetric = this.registry.getSingleMetric(options.name);
    if (existingMetric) {
      this.metrics.set(name, existingMetric as promClient.Summary<string>);
      return existingMetric as promClient.Summary<string>;
    }

    const summary = new this.client.Summary({
      ...options,
      registers: [this.registry],
    });
    this.metrics.set(name, summary);
    return summary;
  }

  /**
   * Get a metric by name
   */
  public getMetric(name: string): promClient.Metric<string> | undefined {
    // First check our local cache
    const localMetric = this.metrics.get(name);
    if (localMetric) {
      return localMetric;
    }

    // Then check the unified registry
    const fullName = name.startsWith('spheroseg_') ? name : `spheroseg_${name}`;
    return this.registry.getSingleMetric(fullName) || this.registry.getSingleMetric(name);
  }

  /**
   * Get metrics in Prometheus format
   */
  public getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get content type for Prometheus metrics
   */
  public getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Clear all metrics
   */
  public clearMetrics(): void {
    this.registry.clear();
  }

  /**
   * Get the Prometheus client
   */
  public getClient(): typeof promClient {
    return this.client;
  }

  /**
   * Get the Prometheus registry
   */
  public getRegistry(): promClient.Registry {
    return this.registry;
  }
}

// Create and export the client instance
export const client = new PrometheusClient();

// Initialize the client if metrics are enabled
if (process.env["ENABLE_METRICS"] === 'true') {
  client.initialize();
}

export default client;
