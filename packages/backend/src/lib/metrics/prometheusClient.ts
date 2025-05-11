import promClient from 'prom-client';

/**
 * Prometheus client wrapper
 */
class PrometheusClient {
  private client: typeof promClient;
  private registry: promClient.Registry;
  private metrics: Map<string, promClient.Metric<string>>;
  private initialized: boolean = false;

  constructor() {
    this.client = promClient;
    this.registry = new promClient.Registry();
    this.metrics = new Map();
  }

  /**
   * Initialize the Prometheus client
   */
  public initialize(): void {
    if (this.initialized) return;

    // Configure default metrics
    this.client.collectDefaultMetrics({
      register: this.registry,
      prefix: 'spheroseg_',
    });

    // HTTP request duration histogram
    this.registerHistogram('http_request_duration_ms', {
      name: 'spheroseg_http_request_duration_ms',
      help: 'Duration of HTTP requests in ms',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    });

    // Database query duration histogram
    this.registerHistogram('db_query_duration_ms', {
      name: 'spheroseg_db_query_duration_ms',
      help: 'Duration of database queries in ms',
      labelNames: ['operation', 'table'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    });

    // ML inference duration histogram
    this.registerHistogram('ml_inference_duration_ms', {
      name: 'spheroseg_ml_inference_duration_ms',
      help: 'Duration of ML inference in ms',
      labelNames: ['model'],
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000],
    });

    // Memory usage gauges
    this.registerGauge('node_memory_heap_total_bytes', {
      name: 'spheroseg_node_memory_heap_total_bytes',
      help: 'Node.js heap total size in bytes',
    });

    this.registerGauge('node_memory_heap_used_bytes', {
      name: 'spheroseg_node_memory_heap_used_bytes',
      help: 'Node.js heap used size in bytes',
    });

    this.registerGauge('node_memory_rss_bytes', {
      name: 'spheroseg_node_memory_rss_bytes',
      help: 'Node.js RSS memory usage in bytes',
    });

    // CPU usage gauge
    this.registerGauge('node_cpu_usage_percent', {
      name: 'spheroseg_node_cpu_usage_percent',
      help: 'Node.js CPU usage percentage',
    });

    // Active connections gauge
    this.registerGauge('active_connections', {
      name: 'spheroseg_active_connections',
      help: 'Number of active connections',
    });

    // API rate limiter gauge
    this.registerGauge('rate_limiter_current', {
      name: 'spheroseg_rate_limiter_current',
      help: 'Current rate limiter count',
      labelNames: ['ip', 'endpoint'],
    });

    this.initialized = true;
  }

  /**
   * Register a histogram metric
   */
  public registerHistogram(
    name: string,
    options: promClient.HistogramConfiguration<string>,
  ): promClient.Histogram<string> {
    if (this.metrics.has(name)) {
      return this.metrics.get(name) as promClient.Histogram<string>;
    }

    const histogram = new this.client.Histogram(options);
    this.registry.registerMetric(histogram);
    this.metrics.set(name, histogram);
    return histogram;
  }

  /**
   * Register a counter metric
   */
  public registerCounter(name: string, options: promClient.CounterConfiguration<string>): promClient.Counter<string> {
    if (this.metrics.has(name)) {
      return this.metrics.get(name) as promClient.Counter<string>;
    }

    const counter = new this.client.Counter(options);
    this.registry.registerMetric(counter);
    this.metrics.set(name, counter);
    return counter;
  }

  /**
   * Register a gauge metric
   */
  public registerGauge(name: string, options: promClient.GaugeConfiguration<string>): promClient.Gauge<string> {
    if (this.metrics.has(name)) {
      return this.metrics.get(name) as promClient.Gauge<string>;
    }

    const gauge = new this.client.Gauge(options);
    this.registry.registerMetric(gauge);
    this.metrics.set(name, gauge);
    return gauge;
  }

  /**
   * Register a summary metric
   */
  public registerSummary(name: string, options: promClient.SummaryConfiguration<string>): promClient.Summary<string> {
    if (this.metrics.has(name)) {
      return this.metrics.get(name) as promClient.Summary<string>;
    }

    const summary = new this.client.Summary(options);
    this.registry.registerMetric(summary);
    this.metrics.set(name, summary);
    return summary;
  }

  /**
   * Get a metric by name
   */
  public getMetric(name: string): promClient.Metric<string> | undefined {
    return this.metrics.get(name);
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
if (process.env.ENABLE_METRICS === 'true') {
  client.initialize();
}

export default client;
