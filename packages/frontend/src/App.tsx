import { Suspense, useEffect } from 'react';
import { createLazyComponent, lazy } from '@/types/lazyComponents';
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
} from 'react-router-dom';

// i18n
import './i18n';

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

// Lazy load components with improved error handling
const Index = lazy(() =>
  import('./pages/Index').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const SignIn = lazy(() =>
  import('./pages/SignIn').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const SignUp = lazy(() =>
  import('./pages/SignUp').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const VerifyEmail = lazy(() =>
  import('./pages/VerifyEmail').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const Dashboard = lazy(() =>
  import('./pages/Dashboard').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const ProjectDetail = lazy(() =>
  import('./pages/ProjectDetail').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const SegmentationPage = createLazyComponent(
  () => import('./pages/segmentation/SegmentationPage'),
  () => import('./pages/NotFound'),
);
const NotFound = lazy(() => import('./pages/NotFound'));
const Settings = lazy(() =>
  import('./pages/Settings').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const Profile = lazy(() =>
  import('./pages/Profile').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const TermsOfService = lazy(() =>
  import('./pages/TermsOfService').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const PrivacyPolicy = lazy(() =>
  import('./pages/PrivacyPolicy').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const RequestAccess = lazy(() =>
  import('./pages/RequestAccess').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const Documentation = lazy(() =>
  import('./pages/Documentation').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const ProjectExport = lazy(() =>
  import('./pages/export/ProjectExport').catch(() => {
    // Error handled by returning NotFound page
    return import('./pages/NotFound');
  }),
);
const ForgotPassword = lazy(() =>
  import('./pages/ForgotPassword')
    .then((module) => ({ default: module.default }))
    .catch(() => {
      // Error handled by returning NotFound page
      return import('./pages/NotFound');
    }),
);
const SegmentationEditorRedirect = createLazyComponent(
  () => import('./pages/segmentation/SegmentationEditorRedirect'),
  () => import('./pages/NotFound'),
);
const AcceptInvitation = createLazyComponent(
  () => import('./pages/AcceptInvitation'),
  () => import('./pages/NotFound'),
);

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes (reduces unnecessary refetches)
      gcTime: 10 * 60 * 1000, // 10 minutes (cache time)
    },
    mutations: {
      onError: () => {
        // Display error to the user via toast notification
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

// Layout component to wrap all routes
const AppLayout = () => {
  // Use location to conditionally render the footer
  const location = useLocation();

  // Pages that should not have a footer - includes all post-login pages
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

  // Automatické čištění starých dat při spuštění aplikace
  useEffect(() => {
    const cleanupStorage = async () => {
      try {
        // Získáme statistiky před čištěním
        const statsBefore = await getDBStats();
        console.log('IndexedDB stats before cleanup:', statsBefore);

        // Vyčistíme stará data (starší než 3 dny)
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        await cleanupOldData(THREE_DAYS_MS);

        // Získáme statistiky po čištění
        const statsAfter = await getDBStats();
        console.log('IndexedDB stats after cleanup:', statsAfter);

        // Pokud bylo vyčištěno hodně dat, informujeme uživatele
        const freedSpace = statsBefore.totalSize - statsAfter.totalSize;
        if (freedSpace > 10 * 1024 * 1024) {
          // Více než 10 MB
          toast.info(`Vyčištěno ${(freedSpace / (1024 * 1024)).toFixed(1)} MB starých dat z mezipaměti.`);
        }
      } catch (error) {
        console.error('Error during storage cleanup:', error);
      }
    };

    // Spustíme čištění po načtení aplikace
    cleanupStorage();

    // Add debug function to window for development
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

    // Nastavíme interval pro pravidelné čištění (každých 24 hodin)
    const cleanupInterval = setInterval(cleanupStorage, 24 * 60 * 60 * 1000);

    // Uklidíme interval při unmount
    return () => clearInterval(cleanupInterval);
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <ProfileProvider>
            <SocketProvider>
              <SkipLink targetId="main-content" />
              {/* Hot reload test - this comment should be updated when the file is saved */}
              <div className="app-container animate-fade-in flex flex-col min-h-screen">
                <main id="main-content" tabIndex={-1} className="flex-grow">
                  <Suspense fallback={<LoadingFallback />}>
                    {/* Frontend hot reload is working! */}
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

// Create routes using the createRoutesFromElements function
const routes = createRoutesFromElements(
  <Route element={<AppLayout />} errorElement={<RouterErrorBoundary />}>
    <Route
      path="/"
      element={
        <ErrorBoundary componentName="IndexPage">
          <Index />
        </ErrorBoundary>
      }
    />
    <Route
      path="/sign-in"
      element={
        <ErrorBoundary componentName="SignInPage">
          <SignIn />
        </ErrorBoundary>
      }
    />
    <Route
      path="/sign-up"
      element={
        <ErrorBoundary componentName="SignUpPage">
          <SignUp />
        </ErrorBoundary>
      }
    />
    <Route
      path="/verify-email"
      element={
        <ErrorBoundary componentName="VerifyEmailPage">
          <VerifyEmail />
        </ErrorBoundary>
      }
    />
    <Route
      path="/documentation"
      element={
        <ErrorBoundary componentName="DocumentationPage">
          <Documentation />
        </ErrorBoundary>
      }
    />
    <Route
      path="/about"
      element={
        <ErrorBoundary componentName="AboutPage">
          <AboutPage />
        </ErrorBoundary>
      }
    />
    <Route
      path="/terms-of-service"
      element={
        <ErrorBoundary componentName="TermsOfServicePage">
          <TermsOfService />
        </ErrorBoundary>
      }
    />
    <Route
      path="/privacy-policy"
      element={
        <ErrorBoundary componentName="PrivacyPolicyPage">
          <PrivacyPolicy />
        </ErrorBoundary>
      }
    />
    <Route
      path="/request-access"
      element={
        <ErrorBoundary componentName="RequestAccessPage">
          <RequestAccess />
        </ErrorBoundary>
      }
    />
    <Route
      path="/forgot-password"
      element={
        <ErrorBoundary componentName="ForgotPasswordPage">
          <Suspense fallback={<LoadingFallback />}>
            <ForgotPassword />
          </Suspense>
        </ErrorBoundary>
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="DashboardPage">
            <Dashboard />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    {/* Use unified ProjectDetail component with redirect capability */}
    <Route
      path="/project/:id"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="ProjectDetailPage">
            <ProjectDetail />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    {/* Ensure both URL formats work properly */}
    <Route
      path="/projects/:id"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="ProjectDetailPage">
            <ProjectDetail />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/images/:imageId/segmentation"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="SegmentationPage">
            <SegmentationPage />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/projects/:projectId/segmentation/:imageId"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="SegmentationPage">
            <SegmentationPage />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    {/* Add route for old segmentation editor path */}
    <Route
      path="/projects/:projectId/editor/:imageId"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="SegmentationEditorRedirect">
            <Suspense fallback={<LoadingFallback />}>
              <SegmentationEditorRedirect />
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
            <ProjectExport />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="SettingsPage">
            <Settings />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/profile"
      element={
        <ProtectedRoute>
          <ErrorBoundary componentName="ProfilePage">
            <Profile />
          </ErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/accept-invitation/:token"
      element={
        <ErrorBoundary componentName="AcceptInvitationPage">
          <Suspense fallback={<LoadingFallback />}>
            <AcceptInvitation />
          </Suspense>
        </ErrorBoundary>
      }
    />
    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route
      path="*"
      element={
        <ErrorBoundary componentName="NotFoundPage">
          <Suspense fallback={<LoadingFallback />}>
            <NotFound />
          </Suspense>
        </ErrorBoundary>
      }
    />
  </Route>,
);

// Create the router with future flags to remove warnings
const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_normalizeFormMethod: true,
    v7_fetcherPersist: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});

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
