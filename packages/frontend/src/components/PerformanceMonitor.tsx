/**
 * Performance Monitor Component
 * 
 * Displays real-time performance metrics and Core Web Vitals
 * Only visible in development mode
 */

import React, { useState, useEffect } from 'react';
import { useRealUserMetrics, PERFORMANCE_THRESHOLDS, type WebVitalsMetrics } from '@/utils/realUserMetrics';

interface MetricDisplayProps {
  label: string;
  value: number | null;
  unit?: string;
  thresholds?: { good: number; needsImprovement: number };
}

const MetricDisplay: React.FC<MetricDisplayProps> = ({ label, value, unit = 'ms', thresholds }) => {
  const getStatus = () => {
    if (value === null || !thresholds) return 'pending';
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  };

  const status = getStatus();
  const statusColors = {
    pending: 'text-gray-500',
    good: 'text-green-600',
    'needs-improvement': 'text-yellow-600',
    poor: 'text-red-600',
  };

  return (
    <div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span className={`text-sm font-mono ${statusColors[status]}`}>
        {value !== null ? `${value}${unit}` : '—'}
      </span>
    </div>
  );
};

export const PerformanceMonitor: React.FC = () => {
  const [isMinimized, setIsMinimized] = useState(true);
  const [webVitals, setWebVitals] = useState<WebVitalsMetrics>({
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    inp: null,
  });
  const [sessionMetrics, setSessionMetrics] = useState<any>(null);
  
  const rum = useRealUserMetrics();

  useEffect(() => {
    const interval = setInterval(() => {
      setWebVitals(rum.getWebVitals());
      setSessionMetrics(rum.getSessionMetrics());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [rum]);

  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-50 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Show Performance Monitor"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Performance Monitor</h3>
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Core Web Vitals */}
        <div>
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase">
            Core Web Vitals
          </h4>
          <div className="space-y-1">
            <MetricDisplay
              label="FCP"
              value={webVitals.fcp}
              thresholds={PERFORMANCE_THRESHOLDS.webVitals.fcp}
            />
            <MetricDisplay
              label="LCP"
              value={webVitals.lcp}
              thresholds={PERFORMANCE_THRESHOLDS.webVitals.lcp}
            />
            <MetricDisplay
              label="FID"
              value={webVitals.fid}
              thresholds={PERFORMANCE_THRESHOLDS.webVitals.fid}
            />
            <MetricDisplay
              label="CLS"
              value={webVitals.cls}
              unit=""
              thresholds={PERFORMANCE_THRESHOLDS.webVitals.cls}
            />
            <MetricDisplay
              label="TTFB"
              value={webVitals.ttfb}
              thresholds={PERFORMANCE_THRESHOLDS.webVitals.ttfb}
            />
            <MetricDisplay
              label="INP"
              value={webVitals.inp}
              thresholds={PERFORMANCE_THRESHOLDS.webVitals.inp}
            />
          </div>
        </div>

        {/* Session Metrics */}
        {sessionMetrics && (
          <div>
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase">
              Session Metrics
            </h4>
            <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-mono">{Math.round(sessionMetrics.duration / 1000)}s</span>
              </div>
              <div className="flex justify-between">
                <span>Page Views:</span>
                <span className="font-mono">{sessionMetrics.pageViews}</span>
              </div>
              <div className="flex justify-between">
                <span>Interactions:</span>
                <span className="font-mono">{sessionMetrics.interactions}</span>
              </div>
              <div className="flex justify-between">
                <span>Errors:</span>
                <span className="font-mono text-red-600">{sessionMetrics.errors}</span>
              </div>
            </div>
          </div>
        )}

        {/* Device Info */}
        {sessionMetrics?.deviceInfo && (
          <div>
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase">
              Device Info
            </h4>
            <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Viewport:</span>
                <span className="font-mono">
                  {sessionMetrics.deviceInfo.viewport.width}×{sessionMetrics.deviceInfo.viewport.height}
                </span>
              </div>
              {sessionMetrics.deviceInfo.connection && (
                <div className="flex justify-between">
                  <span>Connection:</span>
                  <span className="font-mono">{sessionMetrics.deviceInfo.connection.effectiveType}</span>
                </div>
              )}
              {sessionMetrics.deviceInfo.memory && (
                <div className="flex justify-between">
                  <span>Memory:</span>
                  <span className="font-mono">
                    {sessionMetrics.deviceInfo.memory.used}/{sessionMetrics.deviceInfo.memory.limit}MB
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              <span>Good</span>
              <span className="w-2 h-2 bg-yellow-600 rounded-full ml-2"></span>
              <span>Needs Improvement</span>
              <span className="w-2 h-2 bg-red-600 rounded-full ml-2"></span>
              <span>Poor</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;