import React, { useState } from 'react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import logger from '@/utils/logger';

// Define language names for display in the menu
const languageNames: Record<string, string> = {
  en: 'English',
  cs: 'Čeština',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  zh: '中文',
};

// Define language flags (emoji)
const languageFlags: Record<string, string> = {
  en: '🇬🇧',
  cs: '🇨🇿',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  zh: '🇨🇳',
};

const LanguageSwitcher: React.FC = () => {
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const [open, setOpen] = useState(false);

  // Language change handler without page reload
  const handleLanguageChange = (lang: Language) => {
    logger.debug(`[LanguageSwitcher] Changing language to: ${lang}`);
    setLanguage(lang);
    setOpen(false);
  };

  return (
    <div>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-2 relative">
            <Globe className="h-4 w-4" />
            <span className="hidden md:inline">{t('common.language')}</span>
            <span className="md:hidden">{languageFlags[language]}</span>
            <Badge
              variant="outline"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {language.toUpperCase()}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t('settings.selectLanguage')}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {availableLanguages.map((lang) => (
            <DropdownMenuItem
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span>{languageFlags[lang]}</span>
                <span>{languageNames[lang]}</span>
              </div>
              {language === lang && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default LanguageSwitcher;
