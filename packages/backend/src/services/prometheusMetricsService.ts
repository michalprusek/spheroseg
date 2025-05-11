import { collectDefaultMetrics, Registry, Summary, Counter, Gauge } from 'prom-client';

// Create a registry for Prometheus metrics
const register = new Registry();

// Add default metrics
collectDefaultMetrics({ register });

// Create a client for easier metrics management
class MetricsClient {
  private summaries: Map<string, Summary<string>> = new Map();
  private counters: Map<string, Counter<string>> = new Map();
  private gauges: Map<string, Gauge<string>> = new Map();

  /**
   * Get or create a summary metric
   */
  private getSummary(name: string, help: string, labelNames: string[] = []): Summary<string> {
    const key = `${name}:${labelNames.join(',')}`;

    if (!this.summaries.has(key)) {
      const summary = new Summary({
        name,
        help,
        labelNames,
        percentiles: [0.5, 0.9, 0.99],
        registers: [register],
      });

      this.summaries.set(key, summary);
    }

    return this.summaries.get(key)!;
  }

  /**
   * Get or create a counter metric
   */
  private getCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
    const key = `${name}:${labelNames.join(',')}`;

    if (!this.counters.has(key)) {
      const counter = new Counter({
        name,
        help,
        labelNames,
        registers: [register],
      });

      this.counters.set(key, counter);
    }

    return this.counters.get(key)!;
  }

  /**
   * Get or create a gauge metric
   */
  private getGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
    const key = `${name}:${labelNames.join(',')}`;

    if (!this.gauges.has(key)) {
      const gauge = new Gauge({
        name,
        help,
        labelNames,
        registers: [register],
      });

      this.gauges.set(key, gauge);
    }

    return this.gauges.get(key)!;
  }

  /**
   * Observe a value in a summary
   */
  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const help = `${name} summary`;
    const labelNames = Object.keys(labels);
    const summary = this.getSummary(name, help, labelNames);

    summary.observe(labels, value);
  }

  /**
   * Increment a counter
   */
  inc(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const help = `${name} counter`;
    const labelNames = Object.keys(labels);
    const counter = this.getCounter(name, help, labelNames);

    counter.inc(labels, value);
  }

  /**
   * Set a gauge value
   */
  set(name: string, value: number, labels: Record<string, string> = {}): void {
    const help = `${name} gauge`;
    const labelNames = Object.keys(labels);
    const gauge = this.getGauge(name, help, labelNames);

    gauge.set(labels, value);
  }
}

// Create client instance
const client = new MetricsClient();

// Initialize web vitals metrics
const webVitalsMetrics = [
  { name: 'web_vitals_cls', help: 'Cumulative Layout Shift' },
  { name: 'web_vitals_fcp', help: 'First Contentful Paint' },
  { name: 'web_vitals_lcp', help: 'Largest Contentful Paint' },
  { name: 'web_vitals_fid', help: 'First Input Delay' },
  { name: 'web_vitals_ttfb', help: 'Time to First Byte' },
];

webVitalsMetrics.forEach(({ name, help }) => {
  new Summary({
    name,
    help,
    percentiles: [0.5, 0.9, 0.99],
    registers: [register],
  });
});

// Initialize frontend performance metrics
const frontendMetrics = [
  {
    name: 'frontend_component_render_time',
    help: 'Component render time in milliseconds',
    labelNames: ['component'],
  },
  {
    name: 'frontend_page_load_time',
    help: 'Page load time in milliseconds',
    labelNames: ['page'],
  },
  {
    name: 'frontend_api_request_duration',
    help: 'API request duration in milliseconds',
    labelNames: ['endpoint'],
  },
];

frontendMetrics.forEach(({ name, help, labelNames }) => {
  new Summary({
    name,
    help,
    labelNames,
    percentiles: [0.5, 0.9, 0.99],
    registers: [register],
  });
});

// Initialize counter metrics
const counterMetrics = [
  {
    name: 'frontend_component_render_count',
    help: 'Component render count',
    labelNames: ['component'],
  },
  {
    name: 'frontend_page_load_count',
    help: 'Page load count',
    labelNames: ['page'],
  },
  {
    name: 'frontend_api_request_count',
    help: 'API request count',
    labelNames: ['endpoint'],
  },
];

counterMetrics.forEach(({ name, help, labelNames }) => {
  new Counter({
    name,
    help,
    labelNames,
    registers: [register],
  });
});

// Initialize gauge metrics
const gaugeMetrics = [
  {
    name: 'frontend_api_success_rate',
    help: 'API request success rate',
    labelNames: ['endpoint'],
  },
];

gaugeMetrics.forEach(({ name, help, labelNames }) => {
  new Gauge({
    name,
    help,
    labelNames,
    registers: [register],
  });
});

// Initialize ML metrics adapter
import mlMetricsAdapter from './mlMetricsAdapter';

// Initialize ML metrics adapter if enabled
if (process.env.ENABLE_ML_METRICS === 'true') {
  mlMetricsAdapter.initMlMetricsAdapter(register);
}

export { register, client };
