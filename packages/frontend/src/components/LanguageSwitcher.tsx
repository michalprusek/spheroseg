import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Define language names for display in the menu
const languageNames: Record<string, string> = {
  en: 'English',
  cs: 'Čeština',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  zh: '中文'
};

// Define language flags (emoji)
const languageFlags: Record<string, string> = {
  en: '🇬🇧',
  cs: '🇨🇿',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  zh: '🇨🇳'
};

// Type guard to check if a string is a valid Language
const isLanguage = (lang: string, available: ReadonlyArray<Language>): lang is Language => {
  return available.includes(lang as Language);
};

const LanguageSwitcher: React.FC = () => {
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [browserLanguage, setBrowserLanguage] = useState<Language | null>(null);

  // Function to get the display name of a language
  const getLanguageName = (code: Language) => {
    return languageNames[code] || code;
  };

  // Detect browser language on component mount
  useEffect(() => {
    const detectBrowserLanguage = () => {
      const fullBrowserLanguage = navigator.language;
      const baseLanguage = fullBrowserLanguage.split('-')[0];

      // Check if the browser language is supported using type guard
      if (isLanguage(baseLanguage, availableLanguages)) {
        setBrowserLanguage(baseLanguage); // Type is narrowed to Language
      } else {
        setBrowserLanguage(null);
      }
    };

    detectBrowserLanguage();
  }, [availableLanguages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLanguageChange = (lang: Language) => {
    console.log(`[LanguageSwitcher] handleLanguageChange called with: ${lang}`);
    setLanguage(lang); // Call the context's setLanguage function
    setOpen(false);
  };

  const handleUseBrowserLanguage = () => {
    if (browserLanguage) { // browserLanguage is already Language | null
      handleLanguageChange(browserLanguage);
    }
  };

  return (
    <div ref={dropdownRef}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-2 relative">
            <Globe className="h-4 w-4" />
            <span className="hidden md:inline">{t('common.language')}</span>
            <span className="md:hidden">{languageFlags[language]}</span>
            <Badge variant="outline" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {language.toUpperCase()}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
        >
          <DropdownMenuLabel>{t('settings.selectLanguage')}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {browserLanguage && browserLanguage !== language && (
            <>
              <DropdownMenuItem
                onSelect={(event) => {
                  console.log(`[LanguageSwitcher] onSelect triggered for browser language. Event:`, event);
                  handleUseBrowserLanguage();
                }}
                className="flex items-center justify-between"
                data-lang={browserLanguage}
              >
                <div className="flex items-center gap-2">
                  <span>{languageFlags[browserLanguage]}</span>
                  <span>{t('settings.useBrowserLanguage', {}, 'Use browser language')}</span>
                </div>
                <Badge variant="outline">{browserLanguage.toUpperCase()}</Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {availableLanguages.map((lang) => (
            <DropdownMenuItem
              key={lang}
              onSelect={(event) => {
                console.log(`[LanguageSwitcher] onSelect triggered for ${lang}. Event:`, event);
                handleLanguageChange(lang);
              }}
              data-lang={lang}
              className="flex items-center justify-between"
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
