import { Suspense, useEffect, useMemo } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createBrowserRouter,
  RouterProvider,
  useRouteError,
  isRouteErrorResponse,
  Route,
  createRoutesFromElements,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

// i18n
import './i18n';

// Debug i18next issue
import '@/utils/debugI18next';

// Import code splitting utilities
import {
  lazyWithRetry,
  prefetchRoutes,
  createCodeSplitComponent,
  setupVisibilityPrefetching,
  monitorChunkLoading,
  routeLoadingPriorities,
} from '@/utils/codeSplitting';

import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { SocketProvider } from '@/contexts/SocketContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingFallback from './components/LoadingFallback';
import ErrorBoundary from './components/ErrorBoundary';
import { SkipLink } from './components/a11y';
import ThemedFooter from './components/ThemedFooter';
import { toast, Toaster } from 'sonner';

// Import IndexedDB service for cleanup
import { cleanupOldData, getDBStats, clearEntireDatabase } from './utils/indexedDBService';

// Import accessibility CSS
import './components/a11y/SkipLink.css';

// Enhanced lazy loading with code splitting
const routeComponents = {
  // Critical routes (loaded immediately)
  Index: createCodeSplitComponent(() => import(/* webpackChunkName: "index" */ './pages/Index'), {
    chunkName: 'index',
    prefetch: true,
  }),
  SignIn: createCodeSplitComponent(() => import(/* webpackChunkName: "auth" */ './pages/SignIn'), {
    chunkName: 'auth',
    prefetch: true,
  }),
  SignUp: createCodeSplitComponent(() => import(/* webpackChunkName: "auth" */ './pages/SignUp'), {
    chunkName: 'auth',
  }),

  // High priority routes
  Dashboard: createCodeSplitComponent(() => import(/* webpackChunkName: "dashboard" */ './pages/Dashboard'), {
    chunkName: 'dashboard',
    prefetch: true,
  }),
  ProjectDetail: createCodeSplitComponent(() => import(/* webpackChunkName: "project" */ './pages/ProjectDetail'), {
    chunkName: 'project',
    prefetch: true,
  }),

  // Medium priority routes
  Settings: createCodeSplitComponent(() => import(/* webpackChunkName: "settings" */ './pages/Settings'), {
    chunkName: 'settings',
  }),
  Profile: createCodeSplitComponent(() => import(/* webpackChunkName: "profile" */ './pages/Profile'), {
    chunkName: 'profile',
  }),
  Documentation: createCodeSplitComponent(() => import(/* webpackChunkName: "docs" */ './pages/Documentation'), {
    chunkName: 'docs',
  }),

  // Low priority routes
  AboutPage: createCodeSplitComponent(() => import(/* webpackChunkName: "static" */ './pages/AboutPage'), {
    chunkName: 'static',
  }),
  TermsOfService: createCodeSplitComponent(() => import(/* webpackChunkName: "static" */ './pages/TermsOfService'), {
    chunkName: 'static',
  }),
  PrivacyPolicy: createCodeSplitComponent(() => import(/* webpackChunkName: "static" */ './pages/PrivacyPolicy'), {
    chunkName: 'static',
  }),
  RequestAccess: createCodeSplitComponent(() => import(/* webpackChunkName: "static" */ './pages/RequestAccess'), {
    chunkName: 'static',
  }),

  // Heavy components with separate chunks
  SegmentationPage: createCodeSplitComponent(
    () =>
      import(
        /* webpackChunkName: "segmentation" */
        /* webpackPreload: true */
        './pages/segmentation/SegmentationPage'
      ),
    { chunkName: 'segmentation' },
  ),
  ProjectExport: createCodeSplitComponent(
    () =>
      import(
        /* webpackChunkName: "export" */
        './pages/export/ProjectExport'
      ),
    { chunkName: 'export' },
  ),

  // Other routes
  VerifyEmail: lazyWithRetry(() => import('./pages/VerifyEmail')),
  NotFound: lazyWithRetry(() => import('./pages/NotFound')),
  ForgotPassword: lazyWithRetry(() => import('./pages/ForgotPassword')),
  SegmentationEditorRedirect: lazyWithRetry(() => import('./pages/segmentation/SegmentationEditorRedirect')),
  AcceptInvitation: lazyWithRetry(() => import('./pages/AcceptInvitation')),
};

// Route prefetching hook
function useRoutePrefetching() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Prefetch routes based on current location
    prefetchRoutes(location.pathname);

    // Prefetch on link hover
    const handleLinkHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href.startsWith(window.location.origin)) {
        const path = link.href.replace(window.location.origin, '');

        // Prefetch component based on route
        if (path.includes('/dashboard')) {
          routeComponents.Dashboard.prefetch();
        } else if (path.includes('/project')) {
          routeComponents.ProjectDetail.prefetch();
        } else if (path.includes('/segmentation')) {
          routeComponents.SegmentationPage.prefetch();
        }
      }
    };

    document.addEventListener('mouseover', handleLinkHover);
    return () => document.removeEventListener('mouseover', handleLinkHover);
  }, [location]);
}

// Create a client for React Query with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      onError: () => {
        toast.error('Failed to update data. Please try again.');
      },
    },
  },
});

// Router error boundary component
function RouterErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            {error.status} {error.statusText}
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            {error.data?.message || 'Something went wrong while loading this page.'}
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Unexpected Error</h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6">Something went wrong. Please try again later.</p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
}

// Layout component with enhanced performance
const AppLayout = () => {
  const location = useLocation();

  // Use route prefetching
  useRoutePrefetching();

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

  // Storage cleanup effect
  useEffect(() => {
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

    // Development helpers
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

    const cleanupInterval = setInterval(cleanupStorage, 24 * 60 * 60 * 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  // Setup visibility prefetching and monitoring
  useEffect(() => {
    setupVisibilityPrefetching();
    monitorChunkLoading();
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
                  <Suspense fallback={<LoadingFallback />}>
                    <div className="outlet-wrapper" style={{ minHeight: '50vh' }}>
                      <Outlet />
                    </div>
                  </Suspense>
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

// Create routes with code-split components
const routes = createRoutesFromElements(
  <Route element={<AppLayout />} errorElement={<RouterErrorBoundary />}>
    <Route
      path="/"
      element={
        <ErrorBoundary componentName="IndexPage">
          <routeComponents.Index.Component />
        </ErrorBoundary>
      }
    />
    <Route
      path="/sign-in"
      element={
        <ErrorBoundary componentName="SignInPage">
          <routeComponents.SignIn.Component />
        </ErrorBoundary>
      }
    />
    <Route
      path="/sign-up"
      element={
        <ErrorBoundary componentName="SignUpPage">
          <routeComponents.SignUp.Component />
        </ErrorBoundary>
      }
    />
    <Route
      path="/verify-email"
      element={
        <ErrorBoundary componentName="VerifyEmailPage">
          <routeComponents.VerifyEmail />
        </ErrorBoundary>
      }
    />
    <Route
      path="/documentation"
      element={
        <ErrorBoundary componentName="DocumentationPage">
          <routeComponents.Documentation.Component />
        </ErrorBoundary>
      }
    />
    <Route
      path="/about"
      element={
        <ErrorBoundary componentName="AboutPage">
          <routeComponents.AboutPage.Component />
        </ErrorBoundary>
      }
    />
    <Route
      path="/terms-of-service"
      element={
        <ErrorBoundary componentName="TermsOfServicePage">
          <routeComponents.TermsOfService.Component />
        </ErrorBoundary>
      }
    />
    <Route
      path="/privacy-policy"
      element={
        <ErrorBoundary componentName="PrivacyPolicyPage">
          <routeComponents.PrivacyPolicy.Component />
        </ErrorBoundary>
      }
    />
    <Route
      path="/request-access"
      element={
        <ErrorBoundary componentName="RequestAccessPage">
          <routeComponents.RequestAccess.Component />
        </ErrorBoundary>
      }
    />
    <Route
      path="/forgot-password"
      element={
        <ErrorBoundary componentName="ForgotPasswordPage">
          <Suspense fallback={<LoadingFallback />}>
            <routeComponents.ForgotPassword />
          </Suspense>
        </ErrorBoundary>
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="DashboardPage">
            <routeComponents.Dashboard.Component />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/project/:id"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="ProjectDetailPage">
            <routeComponents.ProjectDetail.Component />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/projects/:id"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="ProjectDetailPage">
            <routeComponents.ProjectDetail.Component />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/images/:imageId/segmentation"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="SegmentationPage">
            <routeComponents.SegmentationPage.Component />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/projects/:projectId/segmentation/:imageId"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="SegmentationPage">
            <routeComponents.SegmentationPage.Component />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/projects/:projectId/editor/:imageId"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="SegmentationEditorRedirect">
            <Suspense fallback={<LoadingFallback />}>
              <routeComponents.SegmentationEditorRedirect />
            </Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/project/:id/export"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="ProjectExportPage">
            <routeComponents.ProjectExport.Component />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="SettingsPage">
            <routeComponents.Settings.Component />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/profile"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="ProfilePage">
            <routeComponents.Profile.Component />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/accept-invitation/:token"
      element={
        <ErrorBoundary componentName="AcceptInvitationPage">
          <Suspense fallback={<LoadingFallback />}>
            <routeComponents.AcceptInvitation />
          </Suspense>
        </ErrorBoundary>
      }
    />
    <Route
      path="/invitation/:token"
      element={
        <ErrorBoundary componentName="AcceptInvitationPage">
          <Suspense fallback={<LoadingFallback />}>
            <routeComponents.AcceptInvitation />
          </Suspense>
        </ErrorBoundary>
      }
    />
    <Route
      path="*"
      element={
        <ErrorBoundary componentName="NotFoundPage">
          <Suspense fallback={<LoadingFallback />}>
            <routeComponents.NotFound />
          </Suspense>
        </ErrorBoundary>
      }
    />
  </Route>,
);

// Create the router with enhanced configuration
const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_normalizeFormMethod: true,
    v7_fetcherPersist: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});

// Prefetch critical routes on app load
if (typeof window !== 'undefined') {
  // Prefetch auth routes immediately
  routeComponents.SignIn.prefetch();

  // Prefetch dashboard after a delay
  setTimeout(() => {
    routeComponents.Dashboard.prefetch();
  }, 2000);
}

const App = () => (
  <ErrorBoundary componentName="App" resetOnPropsChange={true}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
