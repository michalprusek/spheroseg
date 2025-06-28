import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import logger from '@/utils/logger';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authCheckTimeElapsed, setAuthCheckTimeElapsed] = useState(false);

  useEffect(() => {
    logger.debug('ProtectedRoute rendering:', {
      user: !!user,
      loading,
      path: location.pathname,
      isRedirecting,
      authCheckTimeElapsed,
    });

    // Reduce the wait time to prevent 404 errors
    const timer = setTimeout(() => {
      setAuthCheckTimeElapsed(true);
    }, 500); // Reduced from 2000ms to 500ms

    return () => clearTimeout(timer);
  }, [user, loading, location.pathname, isRedirecting, authCheckTimeElapsed]); // Added dependencies to useEffect

  useEffect(() => {
    const isPageLoading = sessionStorage.getItem('spheroseg_page_loading') === 'true';

    if (isPageLoading) {
      logger.debug('Page is in loading state, blocking redirects...');
      return;
    }

    if (!loading && !user && !isRedirecting && authCheckTimeElapsed) {
      const hasStoredToken = localStorage.getItem('spheroseg_access_token') || document.cookie.includes('auth_token=');
      const hasStoredUser = localStorage.getItem('spheroseg_user') || document.cookie.includes('spheroseg_user=');

      if (!hasStoredToken && !hasStoredUser) {
        logger.debug('No authentication data found, redirecting to sign-in');
        setIsRedirecting(true);
        navigate(`/sign-in?returnTo=${encodeURIComponent(location.pathname)}`, {
          replace: true,
        });
      } else {
        logger.debug('Found auth data but no user state, waiting for auth initialization');
      }
    }
  }, [user, loading, navigate, location.pathname, isRedirecting, authCheckTimeElapsed]); // Added dependencies for clarity

  // Pokud probíhá načítání nebo ještě neuplynul čas pro kontrolu přihlášení
  if (loading || !authCheckTimeElapsed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-gray-600">Načítání vašeho účtu...</p>
        </div>
      </div>
    );
  }

  // Pokud máme uživatele a nenačítá se, vykreslíme obsah
  if (user) {
    return <>{children}</>;
  }

  // Pokud probíhá přesměrování nebo čekáme na autentizaci
  if (isRedirecting || !authCheckTimeElapsed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-gray-600">Přesměrování...</p>
        </div>
      </div>
    );
  }

  // Jako poslední možnost zobrazíme loading
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
        <p className="mt-4 text-gray-600">Kontrola přihlášení...</p>
      </div>
    </div>
  );
};

export default ProtectedRoute;
