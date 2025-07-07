import React, { useState } from 'react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useLocalization } from '@/hooks/useLocalization';
import type { SupportedLanguage, LanguageInfo } from '@/services/localizationService';
import { cn } from '@/utils/cn';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'list' | 'compact';
  showFlags?: boolean;
  showNativeNames?: boolean;
  className?: string;
  onChange?: (language: SupportedLanguage) => void;
}

/**
 * Enhanced Language Selector Component
 * Supports multiple display variants and RTL languages
 */
export function LanguageSelector({
  variant = 'dropdown',
  showFlags = true,
  showNativeNames = true,
  className,
  onChange,
}: LanguageSelectorProps) {
  const { language, setLanguage, getSupportedLanguages, isRTL } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const languages = getSupportedLanguages();
  const currentLang = languages.find(l => l.code === language);

  const handleLanguageChange = async (lang: LanguageInfo) => {
    await setLanguage(lang.code);
    onChange?.(lang.code);
    setIsOpen(false);
  };

  if (variant === 'list') {
    return (
      <div className={cn('space-y-1', className)}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors',
              language === lang.code
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            <div className="flex items-center gap-3">
              {showFlags && <span className="text-2xl">{lang.flag}</span>}
              <div className="text-left">
                <div className="font-medium">{lang.name}</div>
                {showNativeNames && lang.name !== lang.nativeName && (
                  <div className="text-sm opacity-70">{lang.nativeName}</div>
                )}
              </div>
            </div>
            {language === lang.code && <CheckIcon className="h-5 w-5" />}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang)}
            className={cn(
              'p-2 rounded-lg transition-colors text-2xl',
              language === lang.code
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
            title={`${lang.name} (${lang.nativeName})`}
          >
            {lang.flag}
          </button>
        ))}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border',
          'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
          'border-gray-300 dark:border-gray-700',
          isRTL && 'flex-row-reverse'
        )}
      >
        {showFlags && currentLang && (
          <span className="text-xl">{currentLang.flag}</span>
        )}
        <span className="font-medium">
          {showNativeNames ? currentLang?.nativeName : currentLang?.name}
        </span>
        <ChevronDownIcon 
          className={cn(
            'h-4 w-4 transition-transform',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div 
            className={cn(
              'absolute mt-2 w-64 bg-white dark:bg-gray-800',
              'rounded-lg shadow-xl border dark:border-gray-700 z-50',
              'max-h-96 overflow-y-auto',
              isRTL ? 'left-0' : 'right-0'
            )}
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3',
                  'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  'border-b dark:border-gray-700 last:border-0',
                  language === lang.code && 'bg-blue-50 dark:bg-blue-900/20',
                  lang.direction === 'rtl' && 'text-right flex-row-reverse'
                )}
              >
                {showFlags && <span className="text-2xl">{lang.flag}</span>}
                <div className={cn('flex-1', lang.direction === 'rtl' && 'text-right')}>
                  <div className="font-medium">{lang.name}</div>
                  {showNativeNames && lang.name !== lang.nativeName && (
                    <div className="text-sm opacity-70">{lang.nativeName}</div>
                  )}
                </div>
                {language === lang.code && (
                  <CheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}