import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  BarChart3,
  Clock,
  Download,
  Filter,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

/**
 * Analytics Dashboard Component
 * Comprehensive analytics visualization
 */

// Time range options
const TIME_RANGES = {
  '24h': { label: 'Last 24 hours', days: 1 },
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  'custom': { label: 'Custom range', days: 0 },
};

// Analytics data interfaces
interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  totalImages: number;
  totalSegmentations: number;
  avgSegmentationTime: number;
  successRate: number;
  errorRate: number;
}

interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

interface CategoryData {
  category: string;
  count: number;
  percentage: number;
}

interface PerformanceData {
  metric: string;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

export function AnalyticsDashboard() {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState('7d');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  // Update date range when time range changes
  useEffect(() => {
    if (timeRange !== 'custom') {
      const days = TIME_RANGES[timeRange as keyof typeof TIME_RANGES].days;
      setDateRange({
        from: startOfDay(subDays(new Date(), days)),
        to: endOfDay(new Date()),
      });
    }
  }, [timeRange]);

  // Fetch analytics data
  const { data: overview, isLoading: isLoadingOverview } = useQuery({
    queryKey: ['analytics', 'overview', dateRange],
    queryFn: () => fetchAnalyticsOverview(dateRange),
  });

  const { data: userActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ['analytics', 'user-activity', dateRange],
    queryFn: () => fetchUserActivity(dateRange),
  });

  const { data: segmentationStats, isLoading: isLoadingSegmentation } = useQuery({
    queryKey: ['analytics', 'segmentation', dateRange],
    queryFn: () => fetchSegmentationStats(dateRange),
  });

  const { data: performance, isLoading: isLoadingPerformance } = useQuery({
    queryKey: ['analytics', 'performance', dateRange],
    queryFn: () => fetchPerformanceMetrics(dateRange),
  });

  const { data: errors, isLoading: isLoadingErrors } = useQuery({
    queryKey: ['analytics', 'errors', dateRange],
    queryFn: () => fetchErrorStats(dateRange),
  });

  const isLoading = isLoadingOverview || isLoadingActivity || isLoadingSegmentation || isLoadingPerformance || isLoadingErrors;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('analytics.dashboard.title')}</h2>
          <p className="text-muted-foreground">
            {t('analytics.dashboard.description')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIME_RANGES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {timeRange === 'custom' && (
            <DatePickerWithRange
              date={dateRange}
              onDateChange={(range) => range && setDateRange(range)}
            />
          )}
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          title={t('analytics.overview.activeUsers')}
          value={overview?.activeUsers || 0}
          total={overview?.totalUsers || 0}
          icon={<Users className="h-4 w-4" />}
          trend={calculateTrend(overview?.activeUsers || 0, overview?.totalUsers || 0)}
          loading={isLoadingOverview}
        />
        <OverviewCard
          title={t('analytics.overview.totalProjects')}
          value={overview?.totalProjects || 0}
          icon={<BarChart3 className="h-4 w-4" />}
          loading={isLoadingOverview}
        />
        <OverviewCard
          title={t('analytics.overview.successRate')}
          value={`${(overview?.successRate || 0).toFixed(1)}%`}
          icon={<CheckCircle className="h-4 w-4" />}
          trend={overview?.successRate || 0 > 95 ? 'up' : 'down'}
          loading={isLoadingOverview}
        />
        <OverviewCard
          title={t('analytics.overview.avgSegmentationTime')}
          value={`${(overview?.avgSegmentationTime || 0).toFixed(1)}s`}
          icon={<Clock className="h-4 w-4" />}
          loading={isLoadingOverview}
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="activity">{t('analytics.tabs.activity')}</TabsTrigger>
          <TabsTrigger value="segmentation">{t('analytics.tabs.segmentation')}</TabsTrigger>
          <TabsTrigger value="performance">{t('analytics.tabs.performance')}</TabsTrigger>
          <TabsTrigger value="errors">{t('analytics.tabs.errors')}</TabsTrigger>
          <TabsTrigger value="export">{t('analytics.tabs.export')}</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.activity.userActivityOverTime')}</CardTitle>
                <CardDescription>
                  {t('analytics.activity.dailyActiveUsers')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingActivity ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={userActivity?.timeline || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) => format(new Date(value), 'MMM d')}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => format(new Date(value), 'PPP')}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.activity.topFeatures')}</CardTitle>
                <CardDescription>
                  {t('analytics.activity.mostUsedFeatures')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingActivity ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={userActivity?.features || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.activity.userDistribution')}</CardTitle>
              <CardDescription>
                {t('analytics.activity.byOrganization')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingActivity ? (
                <Skeleton className="h-[300px]" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={userActivity?.organizations || []}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      label
                    >
                      {(userActivity?.organizations || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segmentation" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.segmentation.throughput')}</CardTitle>
                <CardDescription>
                  {t('analytics.segmentation.imagesPerDay')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingSegmentation ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={segmentationStats?.throughput || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) => format(new Date(value), 'MMM d')}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => format(new Date(value), 'PPP')}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#8884d8"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.segmentation.cellCounts')}</CardTitle>
                <CardDescription>
                  {t('analytics.segmentation.distribution')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingSegmentation ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={segmentationStats?.cellDistribution || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#ffc658" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.segmentation.algorithms')}</CardTitle>
              <CardDescription>
                {t('analytics.segmentation.usage')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {segmentationStats?.algorithms?.map((algo: any) => (
                  <div key={algo.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{algo.name}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {algo.count} {t('analytics.segmentation.uses')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t('analytics.common.avgTime')}:</span>
                        <span className="ml-2 font-medium">{algo.avgTime.toFixed(1)}s</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t('analytics.common.successRate')}:</span>
                        <span className="ml-2 font-medium">{algo.successRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.performance.apiLatency')}</CardTitle>
                <CardDescription>
                  {t('analytics.performance.responseTime')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPerformance ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <PerformanceChart data={performance?.api || []} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.performance.pageLoad')}</CardTitle>
                <CardDescription>
                  {t('analytics.performance.loadTimes')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPerformance ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <PerformanceChart data={performance?.pageLoad || []} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.performance.metrics')}</CardTitle>
              <CardDescription>
                {t('analytics.performance.detailed')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performance?.detailed?.map((metric: PerformanceData) => (
                  <PerformanceMetricRow key={metric.metric} metric={metric} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.errors.overview')}</CardTitle>
              <CardDescription>
                {t('analytics.errors.last24h')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {errors?.total || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('analytics.errors.totalErrors')}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {errors?.warnings || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('analytics.errors.warnings')}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {errors?.errorRate || 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('analytics.errors.errorRate')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.errors.timeline')}</CardTitle>
              <CardDescription>
                {t('analytics.errors.overTime')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingErrors ? (
                <Skeleton className="h-[300px]" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={errors?.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) => format(new Date(value), 'MMM d HH:mm')}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => format(new Date(value), 'PPP p')}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#ef4444"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.errors.topErrors')}</CardTitle>
              <CardDescription>
                {t('analytics.errors.mostCommon')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {errors?.topErrors?.map((error: any, index: number) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Badge variant="destructive">{error.count}</Badge>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{error.message}</p>
                      <p className="text-sm text-muted-foreground">{error.stack}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.export.formats')}</CardTitle>
              <CardDescription>
                {t('analytics.export.usage')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'CSV', value: 45 },
                      { name: 'Excel', value: 30 },
                      { name: 'JSON', value: 15 },
                      { name: 'XML', value: 10 },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    label
                  >
                    {[0, 1, 2, 3].map((index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper components
interface OverviewCardProps {
  title: string;
  value: string | number;
  total?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}

function OverviewCard({ title, value, total, icon, trend, loading }: OverviewCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {total && (
              <p className="text-xs text-muted-foreground">
                {t('analytics.common.of')} {total} {t('analytics.common.total')}
              </p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-1">
                {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                {trend === 'down' && <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PerformanceChart({ data }: { data: PerformanceData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="metric" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="p50" fill="#8884d8" name="P50" />
        <Bar dataKey="p95" fill="#82ca9d" name="P95" />
        <Bar dataKey="p99" fill="#ffc658" name="P99" />
        <Legend />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PerformanceMetricRow({ metric }: { metric: PerformanceData }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{metric.metric}</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">P50:</span>
          <span className="ml-1 font-medium">{metric.p50}ms</span>
        </div>
        <div>
          <span className="text-muted-foreground">P95:</span>
          <span className="ml-1 font-medium">{metric.p95}ms</span>
        </div>
        <div>
          <span className="text-muted-foreground">P99:</span>
          <span className="ml-1 font-medium">{metric.p99}ms</span>
        </div>
        <div>
          <span className="text-muted-foreground">Avg:</span>
          <span className="ml-1 font-medium">{metric.avg}ms</span>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function calculateTrend(current: number, total: number): 'up' | 'down' | 'neutral' {
  const percentage = (current / total) * 100;
  if (percentage > 70) return 'up';
  if (percentage < 30) return 'down';
  return 'neutral';
}

// Chart colors
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f'];

// Mock API functions (replace with real API calls)
async function fetchAnalyticsOverview(dateRange: { from: Date; to: Date }): Promise<AnalyticsOverview> {
  // Simulate API call
  return {
    totalUsers: 1234,
    activeUsers: 892,
    totalProjects: 456,
    totalImages: 12345,
    totalSegmentations: 9876,
    avgSegmentationTime: 4.2,
    successRate: 97.5,
    errorRate: 2.5,
  };
}

async function fetchUserActivity(dateRange: { from: Date; to: Date }) {
  // Simulate API call
  return {
    timeline: Array.from({ length: 7 }, (_, i) => ({
      timestamp: subDays(new Date(), 6 - i).toISOString(),
      value: Math.floor(Math.random() * 100) + 50,
    })),
    features: [
      { category: 'Segmentation', count: 456 },
      { category: 'Export', count: 234 },
      { category: 'Upload', count: 189 },
      { category: 'Share', count: 123 },
      { category: 'Analysis', count: 98 },
    ],
    organizations: [
      { category: 'University A', count: 45, percentage: 35 },
      { category: 'Research Lab B', count: 30, percentage: 25 },
      { category: 'Hospital C', count: 25, percentage: 20 },
      { category: 'Others', count: 20, percentage: 20 },
    ],
  };
}

async function fetchSegmentationStats(dateRange: { from: Date; to: Date }) {
  return {
    throughput: Array.from({ length: 7 }, (_, i) => ({
      timestamp: subDays(new Date(), 6 - i).toISOString(),
      value: Math.floor(Math.random() * 200) + 100,
    })),
    cellDistribution: [
      { category: '0-50', count: 123 },
      { category: '51-100', count: 234 },
      { category: '101-200', count: 345 },
      { category: '201-500', count: 234 },
      { category: '500+', count: 89 },
    ],
    algorithms: [
      { name: 'ResUNet', count: 567, avgTime: 3.2, successRate: 98.5 },
      { name: 'U-Net', count: 234, avgTime: 2.8, successRate: 96.2 },
      { name: 'Mask R-CNN', count: 123, avgTime: 4.5, successRate: 94.8 },
    ],
  };
}

async function fetchPerformanceMetrics(dateRange: { from: Date; to: Date }) {
  return {
    api: [
      { metric: 'GET /api/images', p50: 45, p95: 123, p99: 234, avg: 67 },
      { metric: 'POST /api/segment', p50: 2100, p95: 4500, p99: 6700, avg: 2800 },
      { metric: 'GET /api/projects', p50: 34, p95: 89, p99: 145, avg: 56 },
    ],
    pageLoad: [
      { metric: 'Dashboard', p50: 234, p95: 567, p99: 890, avg: 345 },
      { metric: 'Project View', p50: 345, p95: 678, p99: 1234, avg: 456 },
      { metric: 'Image Editor', p50: 456, p95: 890, p99: 1567, avg: 678 },
    ],
    detailed: [
      { metric: 'API Response Time', p50: 45, p95: 123, p99: 234, avg: 67 },
      { metric: 'Database Query', p50: 12, p95: 34, p99: 56, avg: 23 },
      { metric: 'Image Processing', p50: 1234, p95: 2345, p99: 3456, avg: 1678 },
      { metric: 'File Upload', p50: 567, p95: 1234, p99: 2345, avg: 890 },
    ],
  };
}

async function fetchErrorStats(dateRange: { from: Date; to: Date }) {
  return {
    total: 156,
    warnings: 234,
    errorRate: 2.5,
    timeline: Array.from({ length: 24 }, (_, i) => ({
      timestamp: subDays(new Date(), 0).setHours(i),
      value: Math.floor(Math.random() * 10) + 1,
    })),
    topErrors: [
      {
        message: 'Failed to process image',
        stack: 'ImageProcessor.process() at line 123',
        count: 45,
      },
      {
        message: 'Network timeout',
        stack: 'APIClient.request() at line 45',
        count: 34,
      },
      {
        message: 'Invalid file format',
        stack: 'FileValidator.validate() at line 67',
        count: 23,
      },
    ],
  };
}