import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { SkipLink } from '@/components/a11y';
import ThemedFooter from '@/components/ThemedFooter';
import { Toaster, toast } from 'sonner';

// Import storage cleanup utilities
import { cleanupOldData, getDBStats, clearEntireDatabase } from '@/utils/indexedDBService';
import { cleanCorruptedLocalStorage, getLocalStorageStats, emergencyClearLocalStorage } from '@/utils/localStorageCleanup';
import { initPerformanceMonitoring } from '@/utils/performance';

export const AppLayout = () => {
  const location = useLocation();

  // Pages that should not have a footer
  const noFooterPages = [
    '/sign-in',
    '/sign-up',
    '/request-access',
    '/dashboard',
    '/project',
    '/projects',
    '/settings',
    '/profile',
  ];
  const shouldShowFooter = !noFooterPages.some((page) => location.pathname.startsWith(page));

  // Initialize performance monitoring and storage cleanup
  useEffect(() => {
    // Start performance monitoring
    initPerformanceMonitoring();
    
    // Clean corrupted localStorage
    const cleanupLocalStorage = () => {
      try {
        const statsBefore = getLocalStorageStats();
        console.log('localStorage stats before cleanup:', statsBefore);
        
        const cleanupResult = cleanCorruptedLocalStorage();
        console.log('localStorage cleanup result:', cleanupResult);
        
        const statsAfter = getLocalStorageStats();
        console.log('localStorage stats after cleanup:', statsAfter);
        
        if (cleanupResult.spaceFreed > 10 * 1024) {
          toast.success(`Cleaned up ${cleanupResult.cleaned.length} corrupted localStorage items, freed ${(cleanupResult.spaceFreed / 1024).toFixed(1)}KB`);
        }
        
        if (cleanupResult.errors.length > 0) {
          console.error('localStorage cleanup errors:', cleanupResult.errors);
        }
        
        if (statsAfter && statsAfter.usagePercent > 90) {
          console.warn('localStorage usage still critical after cleanup, performing emergency clear...');
          emergencyClearLocalStorage();
          toast.warning('Performed emergency localStorage cleanup. Some settings may have been reset.');
        }
      } catch (error) {
        console.error('Error during localStorage cleanup:', error);
      }
    };
    
    cleanupLocalStorage();
    
    // Clean up IndexedDB
    const cleanupStorage = async () => {
      try {
        const statsBefore = await getDBStats();
        console.log('IndexedDB stats before cleanup:', statsBefore);

        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        await cleanupOldData(THREE_DAYS_MS);

        const statsAfter = await getDBStats();
        console.log('IndexedDB stats after cleanup:', statsAfter);

        const freedSpace = statsBefore.totalSize - statsAfter.totalSize;
        if (freedSpace > 10 * 1024 * 1024) {
          toast.info(`Cleared ${(freedSpace / (1024 * 1024)).toFixed(1)} MB of old data from cache.`);
        }
      } catch (error) {
        console.error('Error during storage cleanup:', error);
      }
    };

    cleanupStorage();

    // Add debug function in dev mode
    if (import.meta.env.DEV) {
      (window as any).clearImageCache = async () => {
        try {
          await clearEntireDatabase();
          toast.success('Image cache cleared successfully. Please refresh the page.');
        } catch (error) {
          console.error('Error clearing cache:', error);
          toast.error('Failed to clear cache');
        }
      };
    }

    // Set up periodic cleanup
    const cleanupInterval = setInterval(cleanupStorage, 24 * 60 * 60 * 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <ProfileProvider>
            <SocketProvider>
              <SkipLink targetId="main-content" />
              <div className="app-container animate-fade-in flex flex-col min-h-screen">
                <main id="main-content" tabIndex={-1} className="flex-grow">
                  <div className="outlet-wrapper" style={{ minHeight: '50vh' }}>
                    <Outlet />
                  </div>
                </main>
                {shouldShowFooter && <ThemedFooter />}
              </div>
              <Toaster
                richColors
                position="bottom-right"
                closeButton
                expand={true}
                duration={4000}
                visibleToasts={3}
                toastOptions={{
                  className: 'custom-toast',
                  style: {
                    padding: 'var(--toast-padding)',
                    borderRadius: 'var(--toast-border-radius)',
                  },
                }}
              />
            </SocketProvider>
          </ProfileProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
};