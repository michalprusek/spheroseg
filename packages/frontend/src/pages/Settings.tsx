import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import AccountSection from '@/components/settings/AccountSection';
import AppearanceSection from '@/components/settings/AppearanceSection';
import UserProfileSection from '@/components/settings/UserProfileSection';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import DashboardHeader from '@/components/DashboardHeader';
import apiClient from '@/lib/apiClient';
import { Loader2 } from 'lucide-react';

// Use the same UserProfile interface as in Profile.tsx
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

const Settings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        console.log('No user found, skipping profile fetch');
        setLoading(false);
        return;
      }

      console.log('Fetching profile for user:', user.id);
      setLoading(true);

      try {
        // Log the API request
        console.log('Making API request to /users/me');

        // Fetch profile using apiClient with explicit error handling
        const response = await apiClient.get<UserProfile>('/users/me');

        console.log('Profile fetch successful:', response.status);
        setProfile(response.data);
      } catch (error: unknown) {
        // Log detailed error information
        console.error('Error fetching profile:', error);

        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
          console.error('Error response headers:', error.response.headers);

          // Show more specific error message
          toast.error(
            `Error fetching profile: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`,
          );
        } else if (error.request) {
          // The request was made but no response was received
          console.error('Error request:', error.request);
          toast.error('No response received from server. Please check your connection.');
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error message:', error.message);
          toast.error(t('settings.fetchError') || 'Error fetching profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, t]);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center">
          <Button variant="ghost" size="sm" className="mr-4" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('settings.pageTitle')}</h1>
        </div>

        {loading && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-8 grid w-full grid-cols-3">
              <TabsTrigger value="profile">{t('settings.profile')}</TabsTrigger>
              <TabsTrigger value="account">{t('settings.account')}</TabsTrigger>
              <TabsTrigger value="appearance">{t('settings.appearance')}</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              {user && profile ? (
                <UserProfileSection userId={user.id} profile={profile} />
              ) : (
                !profile && <div>{t('settings.profileLoadError')}</div>
              )}
            </TabsContent>

            <TabsContent value="account">
              <AccountSection />
            </TabsContent>

            <TabsContent value="appearance">
              <AppearanceSection />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </motion.div>
  );
};

export default Settings;
