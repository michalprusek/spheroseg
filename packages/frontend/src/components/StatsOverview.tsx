import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Microscope, Image, FileUp, FileClock, FolderKanban, CheckCircle2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, FileImage, CheckCircle, CalendarDays } from "lucide-react";
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import { toast } from 'sonner';

interface StatCardProps {
  titleKey: string;
  value: string;
  descriptionKey?: string;
  descriptionOptions?: Record<string, string | number>;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

const StatCard = ({ titleKey, value, descriptionKey, descriptionOptions, icon, trend }: StatCardProps) => {
  const { t } = useLanguage();
  return (
    <Card className="transition-all duration-300 hover:shadow-md dark:bg-gray-800 dark:border-gray-700">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">{t(titleKey)}</CardTitle>
        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold dark:text-white">{value}</div>
        {descriptionKey && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t(descriptionKey, descriptionOptions)}
          </p>
        )}
        {trend && (
          <div className={`text-xs mt-2 flex items-center ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            <span>{trend.value}</span>
            <svg
              className={`h-3 w-3 ml-1 ${!trend.isPositive && 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface StatsData {
  totalProjects: number;
  totalImages: number;
  completedSegmentations: number;
  segmentationsToday: number;
}

interface OverviewStats {
  totalProjects: number;
  totalImages: number;
  completedSegmentations: number;
  segmentationsToday: number;
  projectsComparison?: number;
  imagesComparison?: number;
  completedComparison?: number;
  todayComparison?: number;
}

const StatsOverview = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        console.log(`Fetching overview stats for user: ${user.id}`);
        const response = await apiClient.get<OverviewStats>('/users/me/stats');
        setStats(response.data);
      } catch (error: unknown) {
        console.error("Error fetching overview stats:", error);
        let message = t('statsOverview.fetchError') || 'Failed to load statistics.';
        if (axios.isAxiosError(error) && error.response) {
          message = error.response.data?.message || message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        toast.error(message);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user?.id, t]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Card key={i} className="h-32 animate-pulse bg-gray-200 dark:bg-gray-700" />)}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        {t('statsOverview.loadError') || 'Could not load statistics.'}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        titleKey="statsOverview.totalProjects"
        value={String(stats.totalProjects)}
        icon={<FolderKanban />}
        trend={stats.projectsComparison ? { value: stats.projectsComparison > 0 ? `+${stats.projectsComparison}` : String(stats.projectsComparison), isPositive: stats.projectsComparison > 0 } : undefined}
      />
      <StatCard
        titleKey="statsOverview.totalImages"
        value={String(stats.totalImages)}
        icon={<Image />}
        trend={stats.imagesComparison ? { value: stats.imagesComparison > 0 ? `+${stats.imagesComparison}%` : String(stats.imagesComparison), isPositive: stats.imagesComparison > 0 } : undefined}
      />
      <StatCard
        titleKey="statsOverview.completedSegmentations"
        value={String(stats.completedSegmentations)}
        icon={<CheckCircle2 />}
        trend={stats.completedComparison ? { value: stats.completedComparison > 0 ? `+${stats.completedComparison}` : String(stats.completedComparison), isPositive: stats.completedComparison > 0 } : undefined}
      />
      <StatCard
        titleKey="statsOverview.segmentationsToday"
        value={String(stats.segmentationsToday)}
        icon={<Microscope />}
        trend={stats.todayComparison ? { value: stats.todayComparison > 0 ? `+${stats.todayComparison}` : String(stats.todayComparison), isPositive: stats.todayComparison > 0 } : undefined}
      />
    </div>
  );
};

export default StatsOverview;
