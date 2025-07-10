import React, { useState, useEffect, memo, useMemo, useCallback } from 'react';
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
import { debounce } from 'lodash';

/**
 * Optimized Analytics Dashboard Component with React.memo and performance optimizations
 */

// Time range options
const TIME_RANGES = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  'custom': { label: 'Custom range', days: 0 },
} as const;

// Memoized sub-components
const StatCard = memo(({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend 
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {trend && (
        <div className={cn(
          "flex items-center text-xs mt-1",
          trend.isPositive ? "text-green-600" : "text-red-600"
        )}>
          <TrendingUp className="h-3 w-3 mr-1" />
          {trend.value}%
        </div>
      )}
    </CardContent>
  </Card>
));
StatCard.displayName = 'StatCard';

const ChartContainer = memo(({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        {children}
      </ResponsiveContainer>
    </CardContent>
  </Card>
));
ChartContainer.displayName = 'ChartContainer';

export const AnalyticsDashboard = memo(() => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<keyof typeof TIME_RANGES>('30d');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [refreshKey, setRefreshKey] = useState(0);

  // Memoize date range calculation
  const effectiveDateRange = useMemo(() => {
    if (timeRange === 'custom') {
      return dateRange;
    }
    const days = TIME_RANGES[timeRange].days;
    return {
      from: subDays(new Date(), days),
      to: new Date(),
    };
  }, [timeRange, dateRange]);

  // Debounced date range change handler
  const handleDateRangeChange = useCallback(
    debounce((newRange: { from: Date; to: Date }) => {
      setDateRange(newRange);
      setTimeRange('custom');
    }, 500),
    []
  );

  // Optimized data fetching with React Query
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ['analytics', effectiveDateRange, refreshKey],
    queryFn: async () => {
      // Simulated API call - replace with actual analytics endpoint
      const response = await fetch(`/api/analytics?from=${effectiveDateRange.from.toISOString()}&to=${effectiveDateRange.to.toISOString()}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  // Memoized chart data transformations
  const activityData = useMemo(() => {
    if (!analyticsData?.activity) return [];
    return analyticsData.activity.map((item: any) => ({
      ...item,
      date: format(new Date(item.date), 'MMM dd'),
    }));
  }, [analyticsData?.activity]);

  const segmentationData = useMemo(() => {
    if (!analyticsData?.segmentation) return [];
    return [
      { name: 'Completed', value: analyticsData.segmentation.completed, color: '#10b981' },
      { name: 'Processing', value: analyticsData.segmentation.processing, color: '#3b82f6' },
      { name: 'Queued', value: analyticsData.segmentation.queued, color: '#f59e0b' },
      { name: 'Failed', value: analyticsData.segmentation.failed, color: '#ef4444' },
    ];
  }, [analyticsData?.segmentation]);

  const performanceData = useMemo(() => {
    if (!analyticsData?.performance) return [];
    return analyticsData.performance.map((item: any) => ({
      ...item,
      time: format(new Date(item.timestamp), 'HH:mm'),
    }));
  }, [analyticsData?.performance]);

  // Memoized handlers
  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleExport = useCallback(() => {
    // Export logic here
    console.log('Exporting analytics data...');
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
            <p className="text-lg font-semibold">Failed to load analytics</p>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as keyof typeof TIME_RANGES)}>
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
              onDateChange={handleDateRangeChange}
            />
          )}
          
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={analyticsData?.stats?.totalProjects || 0}
          description="+12% from last period"
          icon={BarChart3}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Total Images"
          value={analyticsData?.stats?.totalImages || 0}
          description="+23% from last period"
          icon={Activity}
          trend={{ value: 23, isPositive: true }}
        />
        <StatCard
          title="Segmentations"
          value={analyticsData?.stats?.totalSegmentations || 0}
          description="85% completion rate"
          icon={Zap}
        />
        <StatCard
          title="Active Users"
          value={analyticsData?.stats?.activeUsers || 0}
          description="Last 24 hours"
          icon={Users}
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="segmentation">Segmentation</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <ChartContainer title="Daily Activity">
            <AreaChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="images"
                stackId="1"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="segmentations"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ChartContainer>
        </TabsContent>

        <TabsContent value="segmentation" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartContainer title="Segmentation Status Distribution">
              <PieChart>
                <Pie
                  data={segmentationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {segmentationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartContainer>

            <ChartContainer title="Processing Time Distribution">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgTime" fill="#8b5cf6" />
              </BarChart>
            </ChartContainer>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <ChartContainer title="System Performance Metrics">
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#8b5cf6"
                name="CPU %"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="memory"
                stroke="#3b82f6"
                name="Memory %"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke="#10b981"
                name="Response Time (ms)"
                strokeWidth={2}
              />
            </LineChart>
          </ChartContainer>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['Image Upload', 'Segmentation', 'Export', 'Sharing'].map((feature, i) => (
                    <div key={feature} className="flex items-center justify-between">
                      <span className="text-sm">{feature}</span>
                      <Badge variant="secondary">{100 - i * 20}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Storage Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used</span>
                    <span>7.2 GB / 10 GB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: '72%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    28% storage remaining
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

AnalyticsDashboard.displayName = 'AnalyticsDashboard';

export default AnalyticsDashboard;