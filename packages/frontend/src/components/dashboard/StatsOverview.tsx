import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Folder,
  Image as ImageIcon,
  HardDrive,
  Activity,
  Clock,
  ChevronRight,
  FileText,
  Calendar,
} from 'lucide-react';
import { useUserStatistics } from '@/hooks/useUserStatistics';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';

// Enhanced StatCard with animation and hover effects
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  onClick?: () => void;
  isLoading?: boolean;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  onClick,
  isLoading = false,
  className = '',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Card
      className={`overflow-hidden transition-all duration-300 hover:shadow-md ${
        onClick ? 'cursor-pointer hover:-translate-y-1' : ''
      } ${className}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">{icon}</div>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24 my-1" />
        ) : (
          <div className="text-2xl font-bold animate-fade-in">{value}</div>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && !isLoading && (
          <div className="flex items-center mt-2">
            {trend.isPositive ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-500 mr-1" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-500 mr-1" />
            )}
            <span className={`text-xs ${trend.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {trend.value}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Activity item component for recent activities
interface ActivityItemProps {
  type: string;
  description: string;
  timestamp: string;
  projectId?: string;
  projectName?: string;
  imageId?: string;
  imageName?: string;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  type,
  description,
  timestamp,
  projectId,
  projectName,
  imageId,
  imageName,
}) => {
  const { t } = useLanguage();
  const date = new Date(timestamp);
  const formattedDate = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Select icon based on activity type
  const getIcon = () => {
    switch (type) {
      case 'project_created':
        return <Folder className="h-4 w-4 text-blue-500" />;
      case 'image_uploaded':
        return <ImageIcon className="h-4 w-4 text-green-500" />;
      case 'segmentation_completed':
        return <BarChart3 className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="flex items-start space-x-3 py-2 border-b last:border-b-0">
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{t(`statsOverview.activityTypes.${type}`) || description}</p>
        <p className="text-xs text-muted-foreground truncate">
          {projectName && (
            <Link to={`/project/${projectId}`} className="hover:underline">
              {projectName}
            </Link>
          )}
          {imageName && <span> - {imageName}</span>}
        </p>
        <div className="flex items-center mt-1">
          <Clock className="w-3 h-3 text-muted-foreground mr-1" />
          <span className="text-xs text-muted-foreground">
            {formattedDate} • {formattedTime}
          </span>
        </div>
      </div>
    </div>
  );
};

// Comparison chart for month-to-month comparisons
interface ComparisonChartProps {
  title: string;
  currentValue: number;
  previousValue: number;
  isLoading?: boolean;
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({ title, currentValue, previousValue, isLoading = false }) => {
  const { t } = useLanguage();
  const maxValue = Math.max(currentValue, previousValue, 1);

  // Animation delay for progressive reveal
  const currentBarStyle = {
    width: `${(currentValue / maxValue) * 100}%`,
    transitionDelay: '0.2s',
  };

  const previousBarStyle = {
    width: `${(previousValue / maxValue) * 100}%`,
    transitionDelay: '0.4s',
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      {isLoading ? (
        <>
          <Skeleton className="h-4 w-full my-2" />
          <Skeleton className="h-4 w-3/4 my-2" />
        </>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{t('statsOverview.thisMonth')}</span>
              <span className="text-xs font-medium">{currentValue}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={currentBarStyle}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{t('statsOverview.lastMonth')}</span>
              <span className="text-xs font-medium">{previousValue}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-muted-foreground rounded-full transition-all duration-500 ease-out"
                style={previousBarStyle}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface UserStats {
  totalProjects: number;
  totalImages: number;
  completedSegmentations: number;
  storageUsedMB: number;
  recentActivity?: Array<{
    type: string;
    description: string;
    timestamp: string;
    project_id?: string;
    project_name?: string;
    image_id?: string;
    image_name?: string;
  }>;
  comparisons: {
    projectsThisMonth: number;
    projectsLastMonth: number;
    projectsChange: number;
    imagesThisMonth: number;
    imagesLastMonth: number;
    imagesChange: number;
  };
}

const StatsOverview: React.FC = () => {
  const { t } = useLanguage();
  const [showExtended, setShowExtended] = useState(false);

  // Use the updated useUserStatistics hook with unified cache
  const { data: rawStats, isLoading, error, refetch: fetchStatistics, invalidate: clearCache } = useUserStatistics();

  // Transform the data to match the expected format
  const stats: UserStats | undefined = rawStats
    ? {
        totalProjects: rawStats.totalProjects,
        totalImages: rawStats.totalImages,
        completedSegmentations: rawStats.segmentedImages,
        storageUsedMB: rawStats.storageUsed,
        recentActivity: [], // This would need to come from a separate endpoint
        comparisons: {
          projectsThisMonth: 0,
          projectsLastMonth: 0,
          projectsChange: 0,
          imagesThisMonth: 0,
          imagesLastMonth: 0,
          imagesChange: 0,
        },
      }
    : undefined;

  // Listen for statistics update events
  useEffect(() => {
    const handleStatisticsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Statistics update needed event received', customEvent.detail);

      // Clear cache and fetch fresh statistics
      clearCache();
      fetchStatistics();
    };

    const handleProjectDeleted = (event: Event) => {
      const customEvent = event as CustomEvent<{
        projectId: string;
        projectName?: string;
        updateStatistics?: boolean;
      }>;

      if (customEvent.detail.updateStatistics) {
        console.log('Project deleted, updating statistics', customEvent.detail);
        clearCache();
        fetchStatistics();
      }
    };

    const handleImageDeleted = (event: Event) => {
      const customEvent = event as CustomEvent<{
        imageId: string;
        projectId: string;
        forceRefresh?: boolean;
      }>;

      console.log('Image deleted, updating statistics', customEvent.detail);
      // Always refresh statistics when an image is deleted
      clearCache();
      fetchStatistics();
    };

    // Register event listeners
    window.addEventListener('statistics-update-needed', handleStatisticsUpdate);
    window.addEventListener('project-deleted', handleProjectDeleted);
    window.addEventListener('image-deleted', handleImageDeleted);

    // Clean up event listeners on unmount
    return () => {
      window.removeEventListener('statistics-update-needed', handleStatisticsUpdate);
      window.removeEventListener('project-deleted', handleProjectDeleted);
      window.removeEventListener('image-deleted', handleImageDeleted);
    };
  }, [fetchStatistics, clearCache]);

  const calculatePercentChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Format number with commas
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  // Toggle extended stats view
  const toggleExtendedView = () => {
    setShowExtended(!showExtended);
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Main stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('statsOverview.totalProjects') || 'Total Projects'}
          value={isLoading ? '' : formatNumber(stats?.totalProjects || 0)}
          icon={<Folder className="h-4 w-4" />}
          trend={
            stats?.comparisons
              ? {
                  value: calculatePercentChange(
                    stats.comparisons.projectsThisMonth,
                    stats.comparisons.projectsLastMonth,
                  ),
                  isPositive: stats.comparisons.projectsChange >= 0,
                  label: t('statsOverview.vsLastMonth') || 'vs. last month',
                }
              : undefined
          }
          isLoading={isLoading}
          onClick={toggleExtendedView}
        />

        <StatCard
          title={t('statsOverview.totalImages') || 'Total Images'}
          value={isLoading ? '' : formatNumber(stats?.totalImages || 0)}
          icon={<ImageIcon className="h-4 w-4" />}
          trend={
            stats?.comparisons
              ? {
                  value: calculatePercentChange(stats.comparisons.imagesThisMonth, stats.comparisons.imagesLastMonth),
                  isPositive: stats.comparisons.imagesChange >= 0,
                  label: t('statsOverview.vsLastMonth') || 'vs. last month',
                }
              : undefined
          }
          isLoading={isLoading}
          onClick={toggleExtendedView}
        />

        <StatCard
          title={t('statsOverview.completedSegmentations') || 'Completed Segmentations'}
          value={isLoading ? '' : formatNumber(stats?.completedSegmentations || 0)}
          icon={<BarChart3 className="h-4 w-4" />}
          description={
            stats && !isLoading
              ? `${
                  stats.totalImages > 0 ? Math.round((stats.completedSegmentations / stats.totalImages) * 100) : 0
                }% ${t('statsOverview.completion') || 'completion rate'}`
              : undefined
          }
          isLoading={isLoading}
          onClick={toggleExtendedView}
        />

        <StatCard
          title={t('statsOverview.storageUsed') || 'Storage Used'}
          value={isLoading ? '' : `${(stats?.storageUsedMB || 0.01).toFixed(1)} MB`}
          icon={<HardDrive className="h-4 w-4" />}
          description={
            stats?.totalImages ? `${stats.totalImages} ${stats.totalImages === 1 ? 'image' : 'images'}` : undefined
          }
          isLoading={isLoading}
          onClick={toggleExtendedView}
        />
      </div>

      {/* Extended stats (shown when toggled) */}
      {showExtended && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 animate-fade-in">
          {/* Left panel: Activity Timeline */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">{t('statsOverview.activityTitle') || 'Recent Activity'}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto pr-2">
                  {stats.recentActivity.map((activity, index) => (
                    <ActivityItem
                      key={index}
                      type={activity.type}
                      description={activity.item_name || activity.description || ''}
                      timestamp={activity.timestamp}
                      projectId={activity.project_id || activity.item_id}
                      projectName={activity.project_name || activity.item_name}
                      imageId={activity.image_id || (activity.type === 'image_uploaded' ? activity.item_id : undefined)}
                      imageName={
                        activity.image_name || (activity.type === 'image_uploaded' ? activity.item_name : undefined)
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>{t('statsOverview.noActivity') || 'No recent activity'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right panel: Comparison charts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('statsOverview.thisMonth') || 'This Month'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ComparisonChart
                title={t('statsOverview.projectsCreated') || 'Projects Created'}
                currentValue={stats?.comparisons?.projectsThisMonth || 0}
                previousValue={stats?.comparisons?.projectsLastMonth || 0}
                isLoading={isLoading}
              />

              <ComparisonChart
                title={t('statsOverview.imagesUploaded') || 'Images Uploaded'}
                currentValue={stats?.comparisons?.imagesThisMonth || 0}
                previousValue={stats?.comparisons?.imagesLastMonth || 0}
                isLoading={isLoading}
              />

              {/* Completion rate */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('statsOverview.completion') || 'Completion Rate'}</h4>
                {isLoading ? (
                  <Skeleton className="h-4 w-full" />
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {formatNumber(stats?.completedSegmentations || 0)} / {formatNumber(stats?.totalImages || 0)}
                      </span>
                      <span className="text-xs font-medium">
                        {stats?.totalImages ? Math.round((stats.completedSegmentations / stats.totalImages) * 100) : 0}%
                      </span>
                    </div>
                    <Progress
                      value={stats?.totalImages ? (stats.completedSegmentations / stats.totalImages) * 100 : 0}
                      className="h-2"
                    />
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full" onClick={toggleExtendedView}>
                {t('statsOverview.hide') || 'Hide'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StatsOverview;
