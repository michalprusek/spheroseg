/**
 * Real User Metrics Dashboard
 * 
 * Displays aggregated performance metrics from real users
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

interface RUMSummary {
  totalSessions: number;
  totalReports: number;
  totalErrors: number;
  webVitals: Record<string, {
    median: number;
    p75: number;
    p95: number;
    average: number;
  }>;
  customMetrics: Record<string, {
    median: number;
    p75: number;
    p95: number;
    average: number;
  }>;
  timeline: Array<{
    timestamp: number;
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
  }>;
  slowResources: Array<{
    name: string;
    type: string;
    duration: number;
    size: number;
  }>;
  userActions: Array<{
    action: string;
    count: number;
    averageDuration: number;
    failureRate: number;
  }>;
}

const WebVitalCard: React.FC<{
  metric: string;
  label: string;
  values: { median: number; p75: number; p95: number };
  unit?: string;
  thresholds: { good: number; needsImprovement: number };
}> = ({ metric, label, values, unit = 'ms', thresholds }) => {
  const getStatus = (value: number) => {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  };

  const status = getStatus(values.p75);
  const statusColors = {
    good: 'text-green-600 bg-green-50',
    'needs-improvement': 'text-yellow-600 bg-yellow-50',
    poor: 'text-red-600 bg-red-50',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <CardDescription className="text-xs">{metric.toUpperCase()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`rounded-lg p-3 ${statusColors[status]}`}>
          <div className="text-2xl font-bold">
            {values.p75}{unit}
          </div>
          <div className="text-xs mt-1">
            <span className="opacity-75">p50:</span> {values.median}{unit} |{' '}
            <span className="opacity-75">p95:</span> {values.p95}{unit}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const RUMDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RUMSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { isAuthenticated } = useAuth();

  const fetchSummary = async () => {
    try {
      setRefreshing(true);
      const response = await api.get('/metrics/rum/summary');
      setSummary(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load performance data');
      console.error('Error fetching RUM summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSummary();
      
      // Refresh every minute
      const interval = setInterval(fetchSummary, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <Alert>
        <AlertDescription>
          Please sign in to view performance metrics.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading && !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!summary) return null;

  const webVitalThresholds = {
    fcp: { good: 1800, needsImprovement: 3000 },
    lcp: { good: 2500, needsImprovement: 4000 },
    fid: { good: 100, needsImprovement: 300 },
    cls: { good: 0.1, needsImprovement: 0.25 },
    ttfb: { good: 800, needsImprovement: 1800 },
    inp: { good: 200, needsImprovement: 500 },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Real User Metrics</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Performance data from {summary.totalSessions} sessions
          </p>
        </div>
        <button
          onClick={fetchSummary}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalSessions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Reports Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalReports}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.totalErrors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalReports > 0 
                ? ((summary.totalErrors / summary.totalReports) * 100).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vitals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vitals">Core Web Vitals</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="actions">User Actions</TabsTrigger>
        </TabsList>

        {/* Core Web Vitals */}
        <TabsContent value="vitals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(summary.webVitals).map(([metric, values]) => (
              <WebVitalCard
                key={metric}
                metric={metric}
                label={
                  metric === 'fcp' ? 'First Contentful Paint' :
                  metric === 'lcp' ? 'Largest Contentful Paint' :
                  metric === 'fid' ? 'First Input Delay' :
                  metric === 'cls' ? 'Cumulative Layout Shift' :
                  metric === 'ttfb' ? 'Time to First Byte' :
                  metric === 'inp' ? 'Interaction to Next Paint' :
                  metric
                }
                values={values}
                unit={metric === 'cls' ? '' : 'ms'}
                thresholds={webVitalThresholds[metric as keyof typeof webVitalThresholds] || { good: 0, needsImprovement: 0 }}
              />
            ))}
          </div>

          {Object.keys(summary.customMetrics).length > 0 && (
            <>
              <h3 className="text-lg font-semibold mt-6">Custom Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(summary.customMetrics).map(([name, values]) => (
                  <Card key={name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{name.replace(/_/g, ' ')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">{values.median}ms</div>
                      <div className="text-xs text-gray-600">
                        p75: {values.p75}ms | p95: {values.p95}ms
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Performance Timeline</CardTitle>
              <CardDescription>Web Vitals over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={summary.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => formatDistanceToNow(value, { addSuffix: true })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => formatDistanceToNow(value, { addSuffix: true })}
                  />
                  <Line type="monotone" dataKey="fcp" stroke="#8884d8" name="FCP" />
                  <Line type="monotone" dataKey="lcp" stroke="#82ca9d" name="LCP" />
                  <Line type="monotone" dataKey="cls" stroke="#ffc658" name="CLS" yAxisId="right" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources */}
        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <CardTitle>Slow Resources</CardTitle>
              <CardDescription>Resources taking the longest to load</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.slowResources.map((resource, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{resource.name}</div>
                      <div className="text-xs text-gray-600">{resource.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{resource.duration}ms</div>
                      <div className="text-xs text-gray-600">
                        {(resource.size / 1024).toFixed(1)}KB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Actions */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>User Action Performance</CardTitle>
              <CardDescription>Average duration and success rate by action type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={summary.userActions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="action" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="averageDuration" fill="#8884d8" name="Avg Duration (ms)" />
                  <Bar dataKey="failureRate" fill="#ff6b6b" name="Failure Rate (%)" yAxisId="right" />
                </BarChart>
              </ResponsiveContainer>
              
              <div className="mt-4 space-y-2">
                {summary.userActions.map((action, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div>
                      <div className="font-medium">{action.action}</div>
                      <div className="text-xs text-gray-600">{action.count} total</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{action.averageDuration}ms avg</div>
                      <div className={`text-xs ${action.failureRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                        {action.failureRate.toFixed(1)}% failure
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RUMDashboard;