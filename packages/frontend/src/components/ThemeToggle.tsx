import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Moon, Sun, MonitorSmartphone } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ThemeToggleProps {
  variant?: 'default' | 'simple';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'default' }) => {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    setTheme(value);
    toast.success(t('settings.themeUpdated'), { id: 'theme-update' });
  };

  // Simple variant just shows a button with current theme icon
  if (variant === 'simple') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">{t('settings.toggleTheme')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleThemeChange('light')}>
            <Sun className="h-4 w-4 mr-2" />
            {t('settings.light')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleThemeChange('dark')}>
            <Moon className="h-4 w-4 mr-2" />
            {t('settings.dark')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleThemeChange('system')}>
            <MonitorSmartphone className="h-4 w-4 mr-2" />
            {t('settings.system')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default variant shows three buttons
  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={theme === 'light' ? 'default' : 'outline'}
        size="sm"
        className="w-24"
        onClick={() => handleThemeChange('light')}
      >
        <Sun className="h-4 w-4 mr-2" />
        {t('settings.light')}
      </Button>
      <Button
        variant={theme === 'dark' ? 'default' : 'outline'}
        size="sm"
        className="w-24"
        onClick={() => handleThemeChange('dark')}
      >
        <Moon className="h-4 w-4 mr-2" />
        {t('settings.dark')}
      </Button>
      <Button
        variant={theme === 'system' ? 'default' : 'outline'}
        size="sm"
        className="w-24"
        onClick={() => handleThemeChange('system')}
      >
        <MonitorSmartphone className="h-4 w-4 mr-2" />
        {t('settings.system')}
      </Button>
    </div>
  );
};

export default ThemeToggle;