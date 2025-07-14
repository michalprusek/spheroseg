import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Microscope } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const { t } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm' : 'py-5 bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src="/favicon.svg" alt="SpheroSeg Logo" className="w-10 h-10" />
          </div>
          <span className="font-semibold text-lg dark:text-white">{t('common.appNameShort')}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            {t('navbar.home')}
          </Link>
          <Link
            to="/documentation"
            className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            {t('navbar.documentation')}
          </Link>
          <Link
            to="/terms-of-service"
            className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            {t('navbar.terms')}
          </Link>
          <Link
            to="/privacy-policy"
            className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            {t('navbar.privacy')}
          </Link>
          <Link
            to="/sign-in"
            className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            {t('navbar.login')}
          </Link>
          <Button asChild size="sm" className="rounded-md">
            <Link to="/request-access">{t('navbar.requestAccess')}</Link>
          </Button>

          {/* Language Selector */}
          <div className="ml-2">
            <LanguageSwitcher />
          </div>

          {/* Theme Toggle */}
          <div className="ml-1">
            <ThemeToggle variant="simple" />
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-gray-700 dark:text-gray-300"
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? t('navbar.closeMobileMenu') : t('navbar.openMobileMenu')}
        >
          {isMobileMenuOpen ? (
            <X size={24} className="animate-fade-in" />
          ) : (
            <Menu size={24} className="animate-fade-in" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg animate-fade-in">
          <div className="container mx-auto px-4 py-6 flex flex-col space-y-4">
            <Link
              to="/"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 py-2 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('navbar.home')}
            </Link>
            <Link
              to="/documentation"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 py-2 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('navbar.documentation')}
            </Link>
            <Link
              to="/terms-of-service"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 py-2 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('navbar.terms')}
            </Link>
            <Link
              to="/privacy-policy"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 py-2 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('navbar.privacy')}
            </Link>
            <Link
              to="/sign-in"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 py-2 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('navbar.login')}
            </Link>
            <Button asChild className="w-full rounded-md">
              <Link to="/request-access" onClick={() => setIsMobileMenuOpen(false)}>
                {t('navbar.requestAccess')}
              </Link>
            </Button>

            {/* Language Selector for Mobile */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('common.language')}</p>
              <LanguageSwitcher />
            </div>

            {/* Theme Selector for Mobile */}
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('settings.theme')}</p>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
