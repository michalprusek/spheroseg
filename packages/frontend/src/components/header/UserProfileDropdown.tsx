import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Settings as SettingsIcon, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';

interface UserProfileDropdownProps {
  username: string;
}

const UserProfileDropdown = ({ username }: UserProfileDropdownProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Load avatar from localStorage or profile
  useEffect(() => {
    const storedAvatar = localStorage.getItem('userAvatar');
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    } else if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    } else {
      setAvatarUrl(null);
    }
  }, [profile]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 dark:text-gray-300">
          <Avatar className="w-6 h-6">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={username} /> : null}
            <AvatarFallback className="bg-gray-200">
              <UserIcon className="h-3 w-3 text-gray-600" />
            </AvatarFallback>
          </Avatar>
          <span className="text-sm">{profile?.username || username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dark:bg-gray-800 dark:border-gray-700">
        <DropdownMenuItem onClick={() => navigate('/profile')} className="dark:text-gray-300 dark:hover:bg-gray-700">
          <UserIcon className="mr-2 h-4 w-4" />
          <span>{t('common.profile')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/settings')} className="dark:text-gray-300 dark:hover:bg-gray-700">
          <SettingsIcon className="mr-2 h-4 w-4" />
          <span>{t('common.settings')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="dark:bg-gray-700" />
        <DropdownMenuItem onClick={handleSignOut} className="dark:text-gray-300 dark:hover:bg-gray-700">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('common.signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserProfileDropdown;
