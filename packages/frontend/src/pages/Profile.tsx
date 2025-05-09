import React, { useEffect, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { Clock, Edit, ExternalLink, FileText, Github, Mail, MapPin, User, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { showSuccess, showError } from '@/utils/toastUtils';
import { tryCatch } from '@/utils/errorUtils';
import apiClient from "@/lib/apiClient";
import { useUserStatistics } from '@/hooks/useUserStatistics';
import { useRecentActivity, ActivityItem } from '@/hooks/useRecentActivity';

interface UserProfile {
  user_id: string;
  username: string | null;
  full_name: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
}

interface ProfileStats {
  totalProjects: number;
  totalImages: number;
  completedSegmentations: number;
  storageUsed?: string;
  recentActivity?: Activity[];
}

interface ActivityItem {
  action: string;
  date: string;
  daysAgo: number;
}

interface MockProject {
  id: string;
  name: string;
  createdAt: Date;
}

interface MockImage {
  id: string;
  name: string;
  createdAt: Date;
}

const Profile = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    totalProjects: 0,
    totalImages: 0,
    completedSegmentations: 0,
    storageUsed: '0 MB',
    recentActivity: []
  });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [recentImages, setRecentImages] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const { profile: contextProfile, loading: contextLoading } = useProfile();
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Use the new hooks for statistics and activities
  const {
    statistics,
    loading: statsLoading,
    error: statsError
  } = useUserStatistics({
    showToasts: false,
    useCache: true,
    autoFetch: true
  });

  const {
    activities,
    loading: activitiesLoading,
    error: activitiesError
  } = useRecentActivity({
    limit: 10,
    showToasts: false,
    useCache: true,
    autoFetch: true
  });

  // Load profile data from context
  useEffect(() => {
    if (contextProfile && !contextLoading) {
      // Convert contextProfile to UserProfile format
      const profile: UserProfile = {
        user_id: user?.id || '',
        username: contextProfile.username || null,
        full_name: contextProfile.full_name || null,
        title: contextProfile.title || null,
        organization: contextProfile.organization || null,
        bio: contextProfile.bio || null,
        location: contextProfile.location || null,
        avatar_url: contextProfile.avatar_url || null,
      };
      setProfileData(profile);

      // Enhanced avatar loading with multiple fallback options
      const storedAvatar = localStorage.getItem('userAvatar');
      const contextAvatar = contextProfile.avatar_url;

      if (storedAvatar && storedAvatar.startsWith('data:image')) {
        // If we have a data URL in localStorage, use it directly
        console.log("Using avatar from localStorage (data URL)");
        setAvatarUrl(storedAvatar);
      } else if (contextAvatar) {
        // If context has an avatar URL (could be a path), check if it's a full URL or path
        if (contextAvatar.startsWith('data:image')) {
          // It's already a data URL
          console.log("Using avatar from context (data URL)");
          setAvatarUrl(contextAvatar);
        } else if (contextAvatar.startsWith('http')) {
          // It's a full URL
          console.log("Using avatar from context (full URL)");
          setAvatarUrl(contextAvatar);
        } else {
          // It's likely a path, construct a full URL
          // This assumes your API is at the same origin as the frontend
          const baseUrl = window.location.origin;
          const fullAvatarUrl = contextAvatar.startsWith('/')
            ? `${baseUrl}${contextAvatar}`
            : `${baseUrl}/${contextAvatar}`;
          console.log("Using constructed avatar URL:", fullAvatarUrl);
          setAvatarUrl(fullAvatarUrl);
        }
      } else {
        // No avatar available
        console.log("No avatar available");
        setAvatarUrl(null);
      }

      // Load cached statistics while waiting for fresh API data
      try {
        const cachedStats = localStorage.getItem('userStatistics');
        if (cachedStats) {
          const parsedStats = JSON.parse(cachedStats);
          console.log("Loaded cached statistics", parsedStats);

          setProfileStats({
            totalProjects: parsedStats.totalProjects || 0,
            totalImages: parsedStats.totalImages || 0,
            completedSegmentations: parsedStats.completedSegmentations || 0,
            storageUsed: `${parsedStats.storageUsedMB || 0} MB`,
            recentActivity: []
          });
        }
      } catch (error) {
        console.error("Error loading cached statistics:", error);
      }

      setLoading(false);
    } else if (!contextLoading) {
      // Fallback to API if context is empty but not loading
      const fetchProfileData = async () => {
        if (!user) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const response = await apiClient.get<UserProfile>('/users/me');
          setProfileData(response.data);

          // Process avatar URL from API response
          if (response.data.avatar_url) {
            const apiAvatar = response.data.avatar_url;

            if (apiAvatar.startsWith('data:image')) {
              // Data URL format
              setAvatarUrl(apiAvatar);
            } else if (apiAvatar.startsWith('http')) {
              // Full URL format
              setAvatarUrl(apiAvatar);
            } else {
              // Path format - construct full URL
              const baseUrl = window.location.origin;
              const fullAvatarUrl = apiAvatar.startsWith('/')
                ? `${baseUrl}${apiAvatar}`
                : `${baseUrl}/${apiAvatar}`;
              setAvatarUrl(fullAvatarUrl);

              // Store in localStorage for persistence
              localStorage.setItem('userAvatar', fullAvatarUrl);
            }
          } else {
            // No avatar in API response
            setAvatarUrl(null);
          }

          // Fetch real statistics from API
          try {
            console.log("Fetching user statistics from API...");
            const statsResponse = await apiClient.get('/users/me/statistics');
            const stats = statsResponse.data;
            console.log("Received statistics:", stats);

            // Store in profileStats object for primary access
            setProfileStats({
              totalProjects: stats.totalProjects || 0,
              totalImages: stats.totalImages || 0,
              completedSegmentations: stats.completedSegmentations || 0,
              storageUsed: `${stats.storageUsedMB || 0} MB`,
              recentActivity: []
            });

            // Store statistics in localStorage for offline/fallback access
            localStorage.setItem('userStatistics', JSON.stringify({
              totalProjects: stats.totalProjects || 0,
              totalImages: stats.totalImages || 0,
              completedSegmentations: stats.completedSegmentations || 0,
              storageUsedMB: stats.storageUsedMB || 0, // Keep original key for backwards compatibility
              lastUpdated: new Date().toISOString()
            }));

            // Fetch recent activity
            if (stats.recentActivity && stats.recentActivity.length > 0) {
              const formattedActivity = stats.recentActivity.map(item => ({
                type: item.type,
                description: item.description,
                timestamp: new Date(item.timestamp),
                projectId: item.project_id || item.projectId,
                projectName: item.project_name || item.projectName,
                imageId: item.image_id || item.imageId,
                imageName: item.image_name || item.imageName
              }));
              setRecentActivity(formattedActivity);
              console.log("Set recent activity:", formattedActivity);
            } else {
              setRecentActivity([]);
            }

            // Set recent projects if available
            if (stats.recentProjects && stats.recentProjects.length > 0) {
              setRecentProjects(stats.recentProjects);
              console.log("Set recent projects:", stats.recentProjects);
            } else {
              setRecentProjects([]);
            }

            // Set recent images if available
            if (stats.recentImages && stats.recentImages.length > 0) {
              setRecentImages(stats.recentImages);
              console.log("Set recent images:", stats.recentImages);
            } else {
              setRecentImages([]);
            }

            // Set comparison data if available
            if (stats.comparisons) {
              console.log("Setting comparison data:", stats.comparisons);
              // You can add UI elements to display this data
            }
          } catch (statsError) {
            console.error("Failed to fetch user statistics:", statsError);

            // Try to load statistics from localStorage as a fallback
            const cachedStats = localStorage.getItem('userStatistics');

            if (cachedStats) {
              try {
                const parsedStats = JSON.parse(cachedStats);
                const cacheAge = new Date().getTime() - new Date(parsedStats.lastUpdated).getTime();
                const cacheAgeHours = cacheAge / (1000 * 60 * 60);

                // Use cached data if it's less than 24 hours old
                if (cacheAgeHours < 24) {
                  console.log("Using cached statistics", parsedStats);

                  setProfileStats({
                    totalProjects: parsedStats.totalProjects || 0,
                    totalImages: parsedStats.totalImages || 0,
                    completedSegmentations: parsedStats.completedSegmentations || 0,
                  });

                  // We don't have cached activity data, so keep it empty
                  return;
                }
              } catch (cacheError) {
                console.error("Error parsing cached statistics:", cacheError);
              }
            }

            // Set default values if statistics fetch fails and no valid cache exists
            setProfileStats({
              totalProjects: 0,
              totalImages: 0,
              completedSegmentations: 0,
            });
            // Default values were already set in profileStats state initialization
          }
        } catch (error) {
          console.error("Failed to fetch profile data:", error);
          showError(t('profile.fetchError'));
        } finally {
          setLoading(false);
        }
      };

      fetchProfileData();
    }
  }, [user, t, contextProfile, contextLoading]);

  // Sync statistics from the hook to local state
  useEffect(() => {
    if (statistics && !statsLoading) {
      setProfileStats(prev => ({
        ...prev,
        totalProjects: statistics.totalProjects || 0,
        totalImages: statistics.totalImages || 0,
        completedSegmentations: statistics.completedSegmentations || 0,
        storageUsed: `${statistics.storageUsedMB || 0} MB`
      }));

      // Also sync any recent data from the statistics hook
      if (statistics.recentProjects && Array.isArray(statistics.recentProjects)) {
        setRecentProjects(statistics.recentProjects);
      }

      if (statistics.recentImages && Array.isArray(statistics.recentImages)) {
        setRecentImages(statistics.recentImages);
      }
    }
  }, [statistics, statsLoading]);

  // Sync activities from the activities hook
  useEffect(() => {
    if (activities && !activitiesLoading && Array.isArray(activities)) {
      setRecentActivity(activities);
    }
  }, [activities, activitiesLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 relative flex justify-center items-center">
        {/* Background elements */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-blue-200/30 dark:bg-blue-400/10 rounded-full filter blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-300/20 dark:bg-blue-500/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-2s" }} />
          <div className="absolute top-2/3 left-1/3 w-40 h-40 bg-blue-400/20 dark:bg-blue-600/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-4s" }} />
        </div>
        <Loader2 className="h-16 w-16 animate-spin text-blue-500 dark:text-blue-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 relative flex justify-center items-center">
        {/* Background elements */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-blue-200/30 dark:bg-blue-400/10 rounded-full filter blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-300/20 dark:bg-blue-500/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-2s" }} />
          <div className="absolute top-2/3 left-1/3 w-40 h-40 bg-blue-400/20 dark:bg-blue-600/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-4s" }} />
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          {t('common.pleaseLogin')}
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 relative flex justify-center items-center">
        {/* Background elements */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-blue-200/30 dark:bg-blue-400/10 rounded-full filter blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-300/20 dark:bg-blue-500/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-2s" }} />
          <div className="absolute top-2/3 left-1/3 w-40 h-40 bg-blue-400/20 dark:bg-blue-600/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-4s" }} />
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-red-500 dark:text-red-400">
          {t('profile.fetchError')}
        </div>
      </div>
    );
  }

  const joinedDate = user.created_at ? new Date(user.created_at) : new Date();
  const month = joinedDate.toLocaleString('default', { month: 'long' });
  const year = joinedDate.getFullYear();
  const formattedJoinedDate = `${month} ${year}`;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 relative">
      {/* Background elements */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-blue-200/30 dark:bg-blue-400/10 rounded-full filter blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-300/20 dark:bg-blue-500/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-2/3 left-1/3 w-40 h-40 bg-blue-400/20 dark:bg-blue-600/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: "-4s" }} />
      </div>

      <DashboardHeader />
      <main className="flex-1 p-4 md:p-6 lg:p-8 relative z-10">
        <h1 className="text-2xl font-bold mb-6">{t('profile.pageTitle')}</h1>
        <div className="grid gap-8 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="p-6 text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <Avatar className="w-24 h-24 border-2 border-white dark:border-gray-800 shadow-md">
                  {(avatarUrl || profileData.avatar_url) ? (
                    <AvatarImage
                      src={avatarUrl || profileData.avatar_url || undefined}
                      alt={profileData.full_name || profileData.username || "User Avatar"}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-blue-100 dark:bg-blue-900">
                    <User className="h-12 w-12 text-blue-500 dark:text-blue-300" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <h2 className="text-xl font-semibold mb-1">{profileData.full_name || profileData.username || user.email?.split('@')[0]}</h2>
              <p className="text-muted-foreground mb-1">{profileData.title || '-'}</p>
              <p className="text-muted-foreground mb-4 text-sm">{profileData.organization || '-'}</p>
              <Link to="/settings#user-profile">
                <Button size="sm" variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  {t('profile.editProfile')}
                </Button>
              </Link>
            </CardContent>
            <Separator />
            <CardContent className="p-6 space-y-3 text-sm">
              <div className="flex items-center">
                <Mail className="mr-3 h-4 w-4 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center">
                <MapPin className="mr-3 h-4 w-4 text-muted-foreground" />
                <span>{profileData.location || t('common.notSpecified')}</span>
              </div>
              <div className="flex items-center">
                <Clock className="mr-3 h-4 w-4 text-muted-foreground" />
                <span>{t('profile.joined')} {formattedJoinedDate}</span>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">{t('profile.aboutMe')}</h3>
                <p className="text-muted-foreground text-sm">
                  {profileData.bio || t('profile.noBio')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">{t('profile.statistics')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{profileStats.totalProjects}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.projects')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{profileStats.totalImages}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.images')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{profileStats.completedSegmentations}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.analyses')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{profileStats.storageUsed}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.storageUsed')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">{t('profile.recentActivity')}</h3>
                {activitiesLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : activities && activities.length > 0 ? (
                  <ul className="space-y-4">
                    {activities.map((activity, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {activity.type === 'project_created' && <FileText className="h-5 w-5 text-blue-500" />}
                          {activity.type === 'image_uploaded' && <ExternalLink className="h-5 w-5 text-green-500" />}
                          {activity.type === 'segmentation_completed' && <Github className="h-5 w-5 text-purple-500" />}
                          {!activity.type && <Clock className="h-5 w-5 text-gray-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {activity.description || t('profile.activityDescription')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.timestamp).toLocaleDateString()} {new Date(activity.timestamp).toLocaleTimeString()}
                          </p>
                          {activity.project_name && (
                            <Link
                              to={`/project/${activity.project_id}`}
                              className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                            >
                              {activity.project_name}
                            </Link>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('profile.noRecentActivity')}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
