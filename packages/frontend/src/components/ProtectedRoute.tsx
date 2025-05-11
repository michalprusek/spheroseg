import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authCheckTimeElapsed, setAuthCheckTimeElapsed] = useState(false);

  console.log('ProtectedRoute rendering:', {
    user: !!user,
    loading,
    path: location.pathname,
    isRedirecting,
    authCheckTimeElapsed,
  });

  // Přidáváme prodlevu pro kontrolu autentizace - dáváme více času na načtení tokenu
  // a obnovení přihlášení (zejména při refreshi stránky)
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthCheckTimeElapsed(true);
    }, 2000); // 2 sekundy prodleva před vyhodnocením přesměrování

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Zjistíme, zda jsme v procesu načítání stránky (první 3 sekundy po refreshi)
    const isPageLoading = sessionStorage.getItem('spheroseg_page_loading') === 'true';

    // Pokud stránka je v procesu načítání, ZABRÁNÍME jakémukoliv přesměrování
    if (isPageLoading) {
      // Necháme načítání dokončit, než provedeme jakékoliv rozhodnutí o přesměrování
      console.log('Page is in loading state, blocking redirects...');
      return;
    }

    // Pouze přesměrujeme, pokud:
    // 1. Není načítání
    // 2. Není přihlášený uživatel
    // 3. Nejsme již v procesu přesměrování
    // 4. Uplynul čas pro kontrolu autentizace (2s po načtení komponenty)
    if (!loading && !user && !isRedirecting && authCheckTimeElapsed) {
      // Zkontrolujeme, zda máme přístupový token nebo user objekt v localStorage nebo cookie
      const hasStoredToken = localStorage.getItem('spheroseg_access_token') || document.cookie.includes('auth_token=');
      const hasStoredUser = localStorage.getItem('spheroseg_user') || document.cookie.includes('spheroseg_user=');

      if (!hasStoredToken && !hasStoredUser) {
        console.log('No authentication data found, redirecting to sign-in');
        setIsRedirecting(true);
        navigate(`/sign-in?returnTo=${encodeURIComponent(location.pathname)}`, {
          replace: true,
        });
      } else {
        console.log('Found auth data but no user state, waiting for auth initialization');
      }
    }
  }, [user, loading, navigate, location.pathname, isRedirecting, authCheckTimeElapsed]);

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

  // Pokud se nenačítá, nemáme uživatele a ještě nepřesměrováváme
  // (mělo by být zpracováno v useEffect, ale jako záloha)
  return null;
};

export default ProtectedRoute;
