import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Microscope, Github, Mail, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { appConfig } from '@/config/app.config';

// Import translation files directly
import enTranslations from '@/translations/en';
import csTranslations from '@/translations/cs';
import deTranslations from '@/translations/de';
import esTranslations from '@/translations/es';
import frTranslations from '@/translations/fr';
import zhTranslations from '@/translations/zh';

const ThemedFooter = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [forceUpdate, setForceUpdate] = useState(0);

  // Force component to re-render when language or theme changes
  useEffect(() => {
    setForceUpdate((prev) => prev + 1);
  }, [language, theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme === 'system') {
      const observer = new MutationObserver(() => {
        // Force re-render when dark class changes
        setForceUpdate((prev) => prev + 1);
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      return () => observer.disconnect();
    }
  }, [theme]);

  // Get translations based on current language
  const getTranslations = useCallback(() => {
    switch (language) {
      case 'cs':
        return csTranslations;
      case 'de':
        return deTranslations;
      case 'es':
        return esTranslations;
      case 'fr':
        return frTranslations;
      case 'zh':
        return zhTranslations;
      case 'en':
      default:
        return enTranslations;
    }
  }, [language]);

  // Get translation for a specific key
  const getTranslation = useCallback(
    (key: string) => {
      const translations = getTranslations();
      const parts = key.split('.');

      // Navigate through the translation object to find the value
      let value = translations;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          // If the key doesn't exist in the current language, fall back to English
          if (language !== 'en') {
            let englishValue = enTranslations;
            for (const p of parts) {
              if (englishValue && typeof englishValue === 'object' && p in englishValue) {
                englishValue = englishValue[p];
              } else {
                return key; // Key not found in English either
              }
            }
            return typeof englishValue === 'string' ? englishValue : key;
          }
          return key; // Key not found
        }
      }

      return typeof value === 'string' ? value : key;
    },
    [language, getTranslations],
  );

  // Get the resolved theme (handles system theme)
  const getResolvedTheme = () => {
    if (theme === 'system') {
      // Check if dark mode is active by looking at the root element
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return theme;
  };

  const resolvedTheme = getResolvedTheme();

  // Determine footer classes based on resolved theme
  const getFooterClasses = () => {
    if (resolvedTheme === 'dark') {
      return 'bg-gray-900 text-white';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };

  // Determine link hover classes based on resolved theme
  const getLinkHoverClasses = () => {
    if (resolvedTheme === 'dark') {
      return 'text-gray-400 hover:text-white transition-colors';
    } else {
      return 'text-gray-600 hover:text-gray-900 transition-colors';
    }
  };

  // Determine border color based on resolved theme
  const getBorderClasses = () => {
    if (resolvedTheme === 'dark') {
      return 'border-gray-800';
    } else {
      return 'border-gray-200';
    }
  };

  // Determine icon background based on resolved theme
  const getIconBgClasses = () => {
    if (resolvedTheme === 'dark') {
      return 'bg-blue-600';
    } else {
      return 'bg-blue-500';
    }
  };

  // Determine text color for muted text based on resolved theme
  const getMutedTextClasses = () => {
    if (resolvedTheme === 'dark') {
      return 'text-gray-400';
    } else {
      return 'text-gray-500';
    }
  };

  return (
    <footer className={`${getFooterClasses()} pt-16 pb-8`}>
      <div className="container mx-auto px-4">
        {/* Adjusted grid to 3 columns for better spacing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-md ${getIconBgClasses()} flex items-center justify-center`}>
                <Microscope className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold">{appConfig.app.name}</span>
            </div>
            <p className={`${getMutedTextClasses()} mb-6 max-w-md`}>{getTranslation('footer.description')}</p>
            <div className="flex items-center gap-4">
              <a
                href={appConfig.social.github.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${getLinkHoverClasses()} flex items-center gap-2`}
                aria-label={getTranslation('footer.githubRepository') || 'GitHub Repository'}
              >
                <Github className="w-5 h-5" />
                <span className="text-sm">{getTranslation('footer.githubRepository') || 'GitHub Repository'}</span>
              </a>
              <a
                href={`mailto:${appConfig.contact.email}`}
                className={`${getLinkHoverClasses()} flex items-center gap-2`}
                aria-label={getTranslation('footer.contactEmail') || 'Contact Email'}
              >
                <Mail className="w-5 h-5" />
                <span className="text-sm">{getTranslation('footer.contactEmail') || 'Contact Email'}</span>
              </a>
            </div>
          </div>

          {/* Information Section */}
          <div>
            <h3 className="text-lg font-semibold mb-6">{getTranslation('footer.informationTitle')}</h3>
            <ul className="space-y-4">
              <li>
                <Link to="/documentation" className={getLinkHoverClasses()}>
                  {getTranslation('footer.documentationLink')}
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className={getLinkHoverClasses()}>
                  {getTranslation('footer.termsLink')}
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className={getLinkHoverClasses()}>
                  {getTranslation('footer.privacyLink')}
                </Link>
              </li>
              <li>
                <Link to="/request-access" className={getLinkHoverClasses()}>
                  {getTranslation('footer.requestAccessLink') || 'Request Access'}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="text-lg font-semibold mb-6">{getTranslation('footer.contactTitle')}</h3>
            <ul className="space-y-4">
              <li>
                <a href={`mailto:${appConfig.contact.email}`} className={getLinkHoverClasses()}>
                  {appConfig.contact.email}
                </a>
              </li>
              <li>
                <a
                  href={appConfig.organization.primary.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getLinkHoverClasses()}
                >
                  {appConfig.organization.primary.name}
                </a>
              </li>
              <li>
                <a
                  href={appConfig.organization.supervisor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getLinkHoverClasses()}
                >
                  {appConfig.organization.supervisor.name}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className={`border-t ${getBorderClasses()} mt-12 pt-8 text-center ${getMutedTextClasses()}`}>
          <p>
            &copy; {new Date().getFullYear()} {getTranslation('footer.copyrightNotice')}
          </p>
          <p className="mt-2 text-sm flex items-center justify-center">
            {getTranslation('footer.madeWith') || 'Made with'} <Heart className="w-4 h-4 mx-1 text-red-500" />{' '}
            {getTranslation('footer.by') || 'by'} {appConfig.contact.developer.name}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ThemedFooter;
